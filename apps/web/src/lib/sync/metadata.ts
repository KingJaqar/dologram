import type { DgClient } from '@dologram/shared';
import type { IndexedDbStore, Records } from '../store/IndexedDbStore';

/** No pruning until every ordered page of both account-owned tables has completed. */
export async function refreshMetadata(client: DgClient, store: IndexedDbStore, signal: AbortSignal, current: () => boolean) {
  const folders: Records['folders'][] = [];
  const links: Records['folder_chats'][] = [];
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
  let after: string | undefined;
  for (let page = 0; ; page++) {
    if (!current() || page >= 1000) throw new Error('Folder snapshot incomplete. Cached folders retained.');
    const query = client.from('folders').select('*').eq('user_id', store.owner).order('folder_id').limit(500).abortSignal(deadline).retry(false);
    if (after) query.gt('folder_id', after);
    const { data, error } = await query;
    if (error) throw new Error('Could not refresh folders. Cached folders retained.');
    if (data.length === 0) break;
    const next = data.at(-1)?.folder_id;
    if (!next || (after && next <= after)) throw new Error('Invalid folder continuation.');
    folders.push(...data); after = next;
  }
  // Per-folder keyset pagination avoids unsafe composite offset paging.
  for (const folder of folders) {
    let chat: string | undefined;
    for (let page = 0; ; page++) {
      if (!current() || page >= 1000) throw new Error('Folder membership snapshot incomplete.');
      const query = client.from('folder_chats').select('*').eq('folder_id', folder.folder_id).order('chat_id').limit(500).abortSignal(deadline).retry(false);
      if (chat) query.gt('chat_id', chat);
      const { data, error } = await query;
      if (error) throw new Error('Could not refresh folder memberships. Cached folders retained.');
      if (data.length === 0) break;
      const next = data.at(-1)?.chat_id;
      if (!next || (chat && next <= chat)) throw new Error('Invalid folder membership continuation.');
      links.push(...data); chat = next;
    }
  }
  deadline.throwIfAborted();
  await store.replaceFolders(folders, links, current);
}
