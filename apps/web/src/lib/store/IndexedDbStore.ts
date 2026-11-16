import type { LocalQueueStore, QueueItem } from '@dologram/shared/src/queue/types';
import type { SyncCacheStore } from '@dologram/shared/src/sync/types';
import type { Database } from '@dologram/shared';

type Tables = Database['public']['Tables'];
export type Records = {
  queue: QueueItem;
  chats: Tables['chats']['Row'];
  members: Tables['chat_members']['Row'];
  messages: Tables['messages']['Row'];
  media: Tables['message_media']['Row'];
  reactions: Tables['reactions']['Row'];
  profiles: Tables['profiles']['Row'];
  folders: Tables['folders']['Row'];
  folder_chats: Tables['folder_chats']['Row'];
  sync_state: { chat_id: string; cursor: number };
  pending_reads: { chat_id: string; seq: number };
  blobs: { id: string; message_id: string; body: Blob | ArrayBuffer; mime: string; name: string };
};
type Table = keyof Records;
type Envelope<T> = { owner: string; key: string; chat: string; message: string; status: string; order: number; seq: number; time: string | number; value: T };
type Identity = { owner: string; epoch: string };
const tables: Table[] = ['queue', 'chats', 'members', 'messages', 'media', 'reactions', 'profiles', 'folders', 'folder_chats', 'sync_state', 'pending_reads', 'blobs'];
const allStores = [...tables, 'metadata'];
export const storageMessage = 'Could not save on this browser. Your draft has been kept. Free some storage or enable browser storage, then retry.';
export class QueueCapacityError extends Error { constructor() { super('The queue is full. Send or discard pending messages, then retry.'); } }
export class StoreUnavailableError extends Error {}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error(storageMessage)); tx.onerror = () => { /* onabort reports transaction failure */ }; });
}
function identity(value: unknown): value is Identity {
  return typeof value === 'object' && value !== null && 'owner' in value && typeof value.owner === 'string' && 'epoch' in value && typeof value.epoch === 'string';
}

/** Account and epoch are checked inside every transaction, including reads. */
export class IndexedDbStore implements LocalQueueStore, SyncCacheStore {
  readonly owner: string;
  private db: IDBDatabase | undefined;
  private epoch = '';
  private closed = false;
  private channel: BroadcastChannel | undefined;
  private listeners = new Set<() => void>();
  private transactions = new Set<IDBTransaction>();
  private opening: Promise<void> | undefined;
  onQuiesce: (() => void) | undefined;
  onClosed: (() => void) | undefined;

  constructor(owner: string, private readonly factory: IDBFactory = indexedDB, private readonly name = 'dologram') {
    if (!owner.trim()) throw new StoreUnavailableError('A resolved account is required.');
    this.owner = owner;
  }
  get sessionEpoch() { return this.epoch; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify = () => { this.listeners.forEach((listener) => listener()); };
  private broadcast(kind: 'changed' | 'quiesce') { this.channel?.postMessage({ kind, owner: this.owner, epoch: this.epoch }); }
  /** Other tabs only: the caller has already stopped its own delivery and sync work. */
  quiesce() { this.broadcast('quiesce'); }
  init(): Promise<void> {
    if (this.closed) return Promise.reject(new StoreUnavailableError('This account store has closed.'));
    return this.opening ??= this.lifecycle(() => this.open());
  }
  private lifecycle<T>(work: () => Promise<T>): Promise<T> {
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('dg-store-lifecycle', { signal: AbortSignal.timeout(10000) }, work) : work();
  }
  private async open() {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      let expired = false;
      const timer = setTimeout(() => { expired = true; reject(new StoreUnavailableError('Browser storage is blocked. Close other DoloGram tabs and retry.')); }, 5000);
      const req = this.factory.open(this.name, 2);
      req.onupgradeneeded = (event) => {
        if (event.oldVersion === 1) return;
        if (event.oldVersion !== 0) { req.transaction?.abort(); return; }
        for (const table of tables) {
          const store = req.result.createObjectStore(table, { keyPath: ['owner', 'key'] });
          for (const field of ['chat', 'message', 'status', 'order', 'seq', 'time']) store.createIndex(field, ['owner', field]);
          store.createIndex('owner', 'owner');
        }
        req.result.createObjectStore('metadata');
      };
      req.onerror = () => { clearTimeout(timer); reject(new StoreUnavailableError(req.error?.name === 'VersionError' ? 'This browser has newer DoloGram data. Update the app to access it.' : storageMessage)); };
      req.onsuccess = () => {
        clearTimeout(timer);
        if (expired || this.closed) { req.result.close(); reject(new StoreUnavailableError('Storage opening was cancelled.')); }
        else resolve(req.result);
      };
    });
    this.db = db;
    db.onversionchange = () => { this.close(); this.onClosed?.(); };
    try {
      const tx = db.transaction(allStores, 'readwrite', { durability: 'strict' });
      const done = completed(tx);
      try {
        const metadata = tx.objectStore('metadata');
        const current: unknown = await request(metadata.get('identity'));
        if (!identity(current)) {
          const counts = await Promise.all(tables.map((table) => request(tx.objectStore(table).count())));
          if (counts.some((count) => count > 0)) throw new StoreUnavailableError('Unrecognized local data is quarantined. Use a separate browser profile or restore with a compatible app.');
        }
        const next = identity(current) && current.owner === this.owner ? current : { owner: this.owner, epoch: crypto.randomUUID() };
        if (identity(current) && current.owner !== this.owner && typeof BroadcastChannel !== 'undefined') {
          const previous = new BroadcastChannel('dg-store');
          previous.postMessage({ kind: 'quiesce', owner: current.owner, epoch: current.epoch });
          previous.close();
        }
        metadata.put(next, 'identity');
        this.epoch = next.epoch;
        await done;
      } catch (error) { try { tx.abort(); } catch { /* already settled */ } await done.catch(() => undefined); throw error; }
      if (this.closed) throw new StoreUnavailableError('Storage opening was cancelled.');
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('dg-store');
        this.channel.onmessage = (event: MessageEvent<unknown>) => {
          const data = event.data;
          if (!data || typeof data !== 'object' || !('owner' in data) || !('epoch' in data) || !('kind' in data) || data.owner !== this.owner || data.epoch !== this.epoch) return;
          if (data.kind === 'changed') this.notify();
          if (data.kind === 'quiesce') { this.onQuiesce?.(); this.close(); this.onClosed?.(); }
        };
      }
    } catch (error) { this.close(); throw error; }
  }
  close() {
    this.closed = true;
    for (const tx of this.transactions) { try { tx.abort(); } catch { /* already committed */ } }
    this.transactions.clear();
    this.channel?.close(); this.channel = undefined;
    this.db?.close(); this.db = undefined;
    this.notify();
  }
  private async transaction<T>(names: Table[], write: boolean, body: (tx: IDBTransaction) => Promise<T>, current?: () => boolean): Promise<T> {
    await this.init();
    if (!this.db || this.closed) throw new StoreUnavailableError('This account store has closed.');
    const tx = this.db.transaction([...new Set([...names, 'metadata'])], write ? 'readwrite' : 'readonly', { durability: 'strict' });
    this.transactions.add(tx);
    const done = completed(tx);
    try {
      const stored: unknown = await request(tx.objectStore('metadata').get('identity'));
      if (!identity(stored) || stored.owner !== this.owner || stored.epoch !== this.epoch || this.closed) throw new StoreUnavailableError('The account changed. Reload before continuing.');
      if (current && !current()) throw new StoreUnavailableError('Worker ownership changed.');
      const result = await body(tx);
      if (current && !current()) throw new StoreUnavailableError('Worker ownership changed.');
      await done;
      if (this.closed) throw new StoreUnavailableError('This account store has closed.');
      if (write) { this.notify(); this.broadcast('changed'); }
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* already settled */ }
      await done.catch(() => undefined);
      throw error instanceof StoreUnavailableError || error instanceof QueueCapacityError ? error : new StoreUnavailableError(storageMessage);
    } finally { this.transactions.delete(tx); }
  }
  private envelope<T>(key: string, value: T, fields: Partial<Envelope<T>> = {}): Envelope<T> {
    return { owner: this.owner, key, chat: '', message: '', status: '', order: 0, seq: 0, time: 0, ...fields, value };
  }
  private async rows<K extends Table>(tx: IDBTransaction, table: K): Promise<Envelope<Records[K]>[]> {
    return request(tx.objectStore(table).index('owner').getAll(this.owner)) as Promise<Envelope<Records[K]>[]>;
  }
  list<K extends Table>(table: K): Promise<Records[K][]> {
    return this.transaction([table], false, async (tx) => (await this.rows(tx, table)).map((row) => row.value));
  }
  private put<K extends Table>(table: K, key: string, value: Records[K], fields: Partial<Envelope<Records[K]>> = {}, current?: () => boolean) {
    return this.transaction([table], true, async (tx) => { tx.objectStore(table).put(this.envelope(key, value, fields)); }, current);
  }
  async tryInsert(item: QueueItem, maxUnsent: number, blobs: readonly Records['blobs'][] = [], current?: () => boolean): Promise<boolean> {
    if (item.payload.sender_id !== this.owner || item.chat_id !== item.payload.chat_id || !item.temp_id || !Number.isSafeInteger(maxUnsent) || maxUnsent < 1) throw new StoreUnavailableError('Invalid queue owner or envelope.');
    const attachments = item.payload.attachments;
    if (item.payload.attachment_count !== attachments.length || attachments.length !== blobs.length || new Set(blobs.map((blob) => blob.id)).size !== blobs.length || blobs.some((blob) => blob.message_id !== item.temp_id || !attachments.some((attachment) => attachment.local_uri === blob.id && attachment.size_bytes === (blob.body instanceof Blob ? blob.body.size : blob.body.byteLength)))) throw new StoreUnavailableError('Attachments must be persisted with their queue item.');
    return this.transaction(['queue', 'blobs'], true, async (tx) => {
      const rows = await this.rows(tx, 'queue');
      if (rows.some((row) => row.key === item.temp_id)) throw new StoreUnavailableError('This message is already queued.');
      if (rows.filter((row) => row.value.status !== 'sent').length >= Math.min(maxUnsent, 200)) return false;
      const metadata = tx.objectStore('metadata');
      const previous: unknown = await request(metadata.get(['order', this.owner]));
      const order = typeof previous === 'number' && Number.isSafeInteger(previous) ? previous + 1 : 1;
      if (!Number.isSafeInteger(order)) throw new StoreUnavailableError('Queue order is exhausted.');
      metadata.put(order, ['order', this.owner]);
      tx.objectStore('queue').add(this.envelope(item.temp_id, item, { chat: item.chat_id, status: item.status, order, time: item.created_at }));
      for (const blob of blobs) tx.objectStore('blobs').add(this.envelope(blob.id, blob, { chat: item.chat_id, message: item.temp_id }));
      return true;
    }, current);
  }
  async insert(item: QueueItem, current?: () => boolean) { if (!await this.tryInsert(item, 200, [], current)) throw new QueueCapacityError(); }
  async update(item: QueueItem, current?: () => boolean) {
    if (item.payload.sender_id !== this.owner || item.chat_id !== item.payload.chat_id) throw new StoreUnavailableError('Invalid queue owner.');
    return this.transaction(['queue'], true, async (tx) => {
      const store = tx.objectStore('queue');
      const old = await request(store.get([this.owner, item.temp_id])) as Envelope<QueueItem> | undefined;
      if (!old) throw new StoreUnavailableError('The queued message no longer exists.');
      if ((current && !current()) || ((item.status === 'sending' || item.status === 'sent' || old.value.status === 'sending') && !current?.())) throw new StoreUnavailableError('Worker ownership changed.');
      store.put({ ...old, value: item, status: item.status });
    }, current);
  }
  get(tempId: string): Promise<QueueItem | null> { return this.transaction(['queue'], false, async (tx) => ((await request(tx.objectStore('queue').get([this.owner, tempId]))) as Envelope<QueueItem> | undefined)?.value ?? null); }
  private queueRows() { return this.transaction(['queue'], false, async (tx) => (await this.rows(tx, 'queue')).sort((a, b) => a.order - b.order).map((row) => row.value)); }
  async listUnsent() { return (await this.queueRows()).filter((item) => item.status !== 'sent'); }
  async listSent() { return (await this.queueRows()).filter((item) => item.status === 'sent'); }
  async countUnsent(senderId?: string) { return senderId !== undefined && senderId !== this.owner ? 0 : (await this.listUnsent()).length; }
  /** Bind each worker to its immutable lease, never to the tab's next leadership generation. */
  workerStore(current: () => boolean): LocalQueueStore {
    const check = () => { if (!current()) throw new StoreUnavailableError('Worker ownership changed.'); };
    return {
      init: async () => { check(); await this.init(); check(); },
      insert: async (item) => { check(); await this.insert(item, current); },
      tryInsert: async (item, max) => { check(); return this.tryInsert(item, max, [], current); },
      update: (item) => this.update(item, current),
      get: async (id) => { check(); const result = await this.get(id); check(); return result; },
      listUnsent: async () => { check(); const result = await this.listUnsent(); check(); return result; },
      countUnsent: async (sender) => { check(); const result = await this.countUnsent(sender); check(); return result; },
      resetSending: () => this.resetSending(current),
      makeAllDue: async (now, sender) => { check(); await this.makeAllDue(now, sender, current); },
      delete: async (id) => { check(); await this.delete(id, current); },
      deleteSent: async () => { check(); await this.deleteSent(current); },
      listSent: async () => { check(); const result = await this.listSent(); check(); return result; },
    };
  }
  async resetSending(current?: () => boolean) {
    if (!current?.()) throw new StoreUnavailableError('Queue recovery requires exclusive visible ownership.');
    await this.mutateQueue((row) => row.status === 'sending' ? { ...row, status: 'queued' } : row, current);
  }
  async makeAllDue(now: number, senderId?: string, current?: () => boolean) {
    if (senderId !== undefined && senderId !== this.owner) return;
    await this.mutateQueue((row) => row.status === 'queued' ? { ...row, next_attempt_at: now } : row, current);
  }
  private mutateQueue(change: (row: QueueItem) => QueueItem, current?: () => boolean) {
    return this.transaction(['queue'], true, async (tx) => {
      const rows = await this.rows(tx, 'queue');
      if (current && !current()) throw new StoreUnavailableError('Queue ownership changed.');
      for (const row of rows) { const value = change(row.value); tx.objectStore('queue').put({ ...row, value, status: value.status }); }
    }, current);
  }
  delete(tempId: string, current?: () => boolean) {
    return this.transaction(['queue', 'blobs'], true, async (tx) => {
      tx.objectStore('queue').delete([this.owner, tempId]);
      for (const row of await this.rows(tx, 'blobs')) if (row.message === tempId) tx.objectStore('blobs').delete([this.owner, row.key]);
    }, current);
  }
  async deleteSent(current?: () => boolean) { for (const item of await this.listSent()) await this.delete(item.temp_id, current); }
  /** Called by the exclusive visible worker. Schema v2 excludes legacy v1 writers. */
  upgradeCheckpoints(current?: () => boolean) {
    if (!current?.()) return Promise.reject(new StoreUnavailableError('Sync checkpoint recovery requires exclusive visible ownership.'));
    return this.transaction(['sync_state'], true, async (tx) => {
      const metadata = tx.objectStore('metadata');
      const version: unknown = await request(metadata.get(['sync-version', this.owner]));
      if (typeof version === 'number' && version > 1) throw new StoreUnavailableError('Update DoloGram to read newer sync checkpoints.');
      if (version === 1) return;
      const rows = await this.rows(tx, 'sync_state');
      metadata.put(rows, ['sync-checkpoint-backup', this.owner]);
      for (const row of rows) tx.objectStore('sync_state').delete([this.owner, row.key]);
      metadata.put(1, ['sync-version', this.owner]);
    }, current);
  }
  /** Every sync transaction checks the immutable lease before committing. */
  syncStore(current: () => boolean): SyncCacheStore {
    return {
      init: () => this.init(), upgradeCheckpoints: () => this.upgradeCheckpoints(current),
      getCursor: (id) => this.getCursor(id), setCursor: (id, seq) => this.setCursor(id, seq, current),
      hasChat: (id) => this.hasChat(id), listChatIds: () => this.listChatIds(),
      upsertChat: (row) => this.upsertChat(row, current), upsertMember: (row) => this.upsertMember(row, current),
      upsertMessage: (row) => this.upsertMessage(row, current), upsertMedia: (row) => this.upsertMedia(row, current),
      upsertReaction: (row) => this.upsertReaction(row, current), upsertProfile: (row) => this.upsertProfile(row, current),
      replaceMembers: (id, rows) => this.replaceMembers(id, rows, current), deleteChat: (id) => this.deleteChat(id, current),
    };
  }
  getCursor(chatId: string) { return this.transaction(['sync_state'], false, async (tx) => ((await request(tx.objectStore('sync_state').get([this.owner, chatId]))) as Envelope<Records['sync_state']> | undefined)?.value.cursor ?? 0); }
  setCursor(chatId: string, cursor: number, current?: () => boolean) {
    if (!Number.isSafeInteger(cursor) || cursor < 0) return Promise.reject(new StoreUnavailableError('Invalid sync cursor.'));
    return this.transaction(['sync_state'], true, async (tx) => {
      const store = tx.objectStore('sync_state');
      const old = await request(store.get([this.owner, chatId])) as Envelope<Records['sync_state']> | undefined;
      store.put(this.envelope(chatId, { chat_id: chatId, cursor: Math.max(cursor, old?.value.cursor ?? 0) }, { chat: chatId }));
    }, current);
  }
  async hasChat(chatId: string) { return (await this.listChatIds()).includes(chatId); }
  async listChatIds() { return (await this.list('chats')).map((row) => row.chat_id); }
  upsertChat(row: Records['chats'], current?: () => boolean) { return this.put('chats', row.chat_id, row, { chat: row.chat_id }, current); }
  upsertMember(row: Records['members'], current?: () => boolean) {
    return this.transaction(['members'], true, async (tx) => {
      const key = JSON.stringify([row.chat_id, row.user_id]);
      const old = await request(tx.objectStore('members').get([this.owner, key])) as Envelope<Records['members']> | undefined;
      if (old && Date.parse(old.value.joined_at) > Date.parse(row.joined_at)) return;
      const value = old?.value.joined_at === row.joined_at ? { ...row, last_read_seq: Math.max(old.value.last_read_seq, row.last_read_seq) } : row;
      tx.objectStore('members').put(this.envelope(key, value, { chat: row.chat_id }));
    }, current);
  }
  upsertMessage(row: Records['messages'], current?: () => boolean) {
    return this.transaction(['messages'], true, async (tx) => {
      const table = tx.objectStore('messages');
      const old = await request(table.get([this.owner, row.message_id])) as Envelope<Records['messages']> | undefined;
      if (!old || old.value.sync_seq < row.sync_seq) table.put(this.envelope(row.message_id, row, { chat: row.chat_id, seq: row.seq, time: row.created_at }));
    }, current);
  }
  private sequenced<K extends 'media' | 'reactions'>(table: K, key: string, row: Records[K], current?: () => boolean) {
    return this.transaction([table], true, async (tx) => {
      const store = tx.objectStore(table);
      const old = await request(store.get([this.owner, key])) as Envelope<Records[K]> | undefined;
      if (!old || old.value.sync_seq < row.sync_seq) store.put(this.envelope(key, row, { chat: row.chat_id, message: row.message_id }));
    }, current);
  }
  upsertMedia(row: Records['media'], current?: () => boolean) { return this.sequenced('media', row.media_id, row, current); }
  upsertReaction(row: Records['reactions'], current?: () => boolean) { return this.sequenced('reactions', JSON.stringify([row.message_id, row.user_id, row.emoji]), row, current); }
  upsertProfile(row: Records['profiles'], current?: () => boolean) { return this.put('profiles', row.user_id, row, {}, current); }
  replaceMembers(chatId: string, rows: readonly Records['members'][], current?: () => boolean) {
    if (rows.length === 0 || rows.some((row) => row.chat_id !== chatId) || new Set(rows.map((row) => row.user_id)).size !== rows.length) return Promise.reject(new StoreUnavailableError('Invalid member snapshot.'));
    return this.transaction(['members', 'pending_reads'], true, async (tx) => {
      const store = tx.objectStore('members');
      const oldRows = (await this.rows(tx, 'members')).filter((row) => row.chat === chatId);
      for (const row of oldRows) store.delete([this.owner, row.key]);
      for (const row of rows) {
        const old = oldRows.find((entry) => entry.value.user_id === row.user_id)?.value;
        const value = old && Date.parse(old.joined_at) > Date.parse(row.joined_at) ? old
          : old?.joined_at === row.joined_at ? { ...row, last_read_seq: Math.max(old.last_read_seq, row.last_read_seq) } : row;
        if (row.user_id === this.owner && old && old.joined_at !== value.joined_at) tx.objectStore('pending_reads').delete([this.owner, chatId]);
        store.put(this.envelope(JSON.stringify([chatId, row.user_id]), value, { chat: chatId }));
      }
    }, current);
  }
  deleteChat(chatId: string, current?: () => boolean) {
    const scoped: Table[] = ['chats', 'members', 'messages', 'media', 'reactions', 'sync_state', 'pending_reads', 'folder_chats', 'blobs'];
    return this.transaction([...scoped, 'queue'], true, async (tx) => {
      const queued = new Set((await this.rows(tx, 'queue')).map((row) => row.message || row.key));
      for (const table of scoped) for (const row of await this.rows(tx, table)) if (row.chat === chatId && !(table === 'blobs' && queued.has(row.message))) tx.objectStore(table).delete([this.owner, row.key]);
    }, current);
  }
  replaceFolders(folders: Records['folders'][], links: Records['folder_chats'][], current: () => boolean) {
    if (folders.some((row) => row.user_id !== this.owner) || new Set(folders.map((row) => row.folder_id)).size !== folders.length
      || links.some((row) => !folders.some((folder) => folder.folder_id === row.folder_id))) throw new StoreUnavailableError('Invalid folder snapshot.');
    return this.transaction(['folders', 'folder_chats'], true, async (tx) => {
      for (const table of ['folders', 'folder_chats'] as const) for (const row of await this.rows(tx, table)) tx.objectStore(table).delete([this.owner, row.key]);
      for (const row of folders) tx.objectStore('folders').put(this.envelope(row.folder_id, row));
      for (const row of links) tx.objectStore('folder_chats').put(this.envelope(JSON.stringify([row.folder_id, row.chat_id]), row, { chat: row.chat_id }));
    }, current);
  }
  /** Caller stops its leader before entering; the database epoch fences even unresponsive siblings. */
  async clearAccount() {
    this.quiesce();
    await this.transaction(tables, true, async (tx) => {
      for (const table of tables) for (const row of await this.rows(tx, table)) tx.objectStore(table).delete([this.owner, row.key]);
      tx.objectStore('metadata').put({ owner: '', epoch: crypto.randomUUID() }, 'identity');
      tx.objectStore('metadata').delete(['order', this.owner]);
      tx.objectStore('metadata').delete(['sync-version', this.owner]);
      tx.objectStore('metadata').delete(['sync-checkpoint-backup', this.owner]);
    });
    this.close();
  }
  async wipe(): Promise<'deleted' | 'retained'> {
    await this.init();
    return this.lifecycle(async () => { await this.clearAccount(); return this.deleteDatabase(); });
  }
  private async deleteDatabase(): Promise<'deleted' | 'retained'> {
    this.close();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve('retained'), 5000);
      const req = this.factory.deleteDatabase(this.name);
      req.onsuccess = () => { clearTimeout(timer); resolve('deleted'); };
      req.onerror = () => { clearTimeout(timer); reject(new StoreUnavailableError('Local records were cleared, but browser database deletion failed. Close other tabs and retry cleanup.')); };
    });
  }
}
