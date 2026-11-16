import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// All auth/REST/Realtime traffic terminates in runner-owned local fixtures; no backend is touched.
const A = 'a0a0a0a0-1111-4111-8111-111111111111';
const B = 'b0b0b0b0-2222-4222-8222-222222222222';
const G = 'c0c0c0c0-3333-4333-8333-333333333333';
const SAVED = 'chat-saved-01';
const DIRECT = 'chat-direct-01';
const GROUP = 'chat-group-01';
const OTHER_GROUP = 'chat-group-02';

type Member = { chat_id: string; user_id: string; joined_at: string; role: string; last_read_seq: number; archived: boolean; muted_until: string | null; nickname: string | null };
type Chat = { chat_id: string; created_by: string; type: string; title: string | null; direct_key: string | null; created_at: string; next_seq: number; avatar_url: string | null };
type Message = { message_id: string; chat_id: string; sender_id: string; content: string; attachment_count: number; reply_to: string | null; seq: number; sync_seq: number; created_at: string; edited_at: string | null; deleted_at: string | null };
type Profile = { user_id: string; username: string; display_name: string; avatar_url: string | null; premium_flags: null; roles: 'user' };

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const user = { id: A, aud: 'authenticated', role: 'authenticated', email: 'list@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

function member(chatId: string, userId: string, lastRead = 100, archived = false): Member {
  return { chat_id: chatId, user_id: userId, joined_at: '2026-11-01T00:00:00Z', role: 'member', last_read_seq: lastRead, archived, muted_until: null, nickname: null };
}
function message(chatId: string, id: string, sender: string, content: string, seq: number, syncSeq: number, createdAt: string): Message {
  return { message_id: id, chat_id: chatId, sender_id: sender, content, attachment_count: 0, reply_to: null, seq, sync_seq: syncSeq, created_at: createdAt, edited_at: null, deleted_at: null };
}

/** One account's fixture cache: Saved Messages, a direct chat, a group with A+B and one with A+B+G. */
function fixture() {
  const chats: Chat[] = [
    { chat_id: SAVED, created_by: A, type: 'direct', title: null, direct_key: A, created_at: '2026-11-01T00:00:00Z', next_seq: 9, avatar_url: null },
    { chat_id: DIRECT, created_by: A, type: 'direct', title: null, direct_key: `${A}:${B}`, created_at: '2026-11-01T00:00:00Z', next_seq: 9, avatar_url: null },
    { chat_id: GROUP, created_by: A, type: 'group', title: 'Beach Trip', direct_key: null, created_at: '2026-11-01T00:00:00Z', next_seq: 9, avatar_url: null },
    { chat_id: OTHER_GROUP, created_by: A, type: 'group', title: 'Book Club', direct_key: null, created_at: '2026-11-01T00:00:00Z', next_seq: 9, avatar_url: null },
  ];
  const members: Member[] = [
    member(SAVED, A),
    member(DIRECT, A, 1),
    member(DIRECT, B),
    member(GROUP, A),
    member(GROUP, B),
    member(OTHER_GROUP, A),
    member(OTHER_GROUP, B),
    member(OTHER_GROUP, G),
  ];
  const profiles: Profile[] = [
    { user_id: A, username: 'alice_chen', display_name: 'Alice Chen', avatar_url: null, premium_flags: null, roles: 'user' },
    { user_id: B, username: 'bruno_diaz', display_name: 'Bruno Diaz', avatar_url: null, premium_flags: null, roles: 'user' },
    { user_id: G, username: 'grace_kim', display_name: 'Grace Kim', avatar_url: null, premium_flags: null, roles: 'user' },
  ];
  const messages: Message[] = [
    message(SAVED, 'msg-saved-1', A, 'Remember the keys', 1, 1, '2026-11-16T13:00:00Z'),
    message(DIRECT, 'msg-direct-1', B, '**Hello** there', 1, 1, '2026-11-16T12:00:00Z'),
    message(GROUP, 'msg-group-1', B, 'Group hello', 1, 1, '2026-11-16T11:00:00Z'),
    message(OTHER_GROUP, 'msg-other-1', G, 'Chapter one', 1, 1, '2026-11-16T10:00:00Z'),
  ];
  let nextSync = 50;
  return {
    chats,
    members,
    profiles,
    messages,
    media: [] as { chat_id: string; sync_seq: number }[],
    reactions: [] as { chat_id: string; sync_seq: number }[],
    /** Stands in for B sending through the API: the row lands in the cache on the next catch-up. */
    send(chatId: string, senderId: string, content: string) {
      nextSync += 1;
      const seq = messages.filter((row) => row.chat_id === chatId).length + 1;
      // Later than every cached message, so the chat takes the top of the D-94 order.
      const newest = Math.max(...messages.map((row) => Date.parse(row.created_at)));
      const createdAt = new Date(newest + 60_000).toISOString();
      const row = message(chatId, `msg-${nextSync}`, senderId, content, seq, nextSync, createdAt);
      messages.push(row);
      return row;
    },
  };
}
type Fixture = ReturnType<typeof fixture>;

type Target = { origin: string; websocket: string };

/** The origin the running build embedded, so the fixtures intercept exactly the app's target. */
async function resolveTarget(baseURL: string): Promise<Target> {
  const response = await fetch(new URL('/sign-in', baseURL), { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`The app did not serve /sign-in (${response.status}).`);
  const match = /<meta name="dg-supabase-url" content="([^"]*)"/.exec(await response.text());
  const url = new URL(match?.[1] ?? '');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('The app must embed an HTTP(S) Supabase origin.');
  }
  return { origin: url.origin, websocket: `wss://${url.host}/**` };
}

async function install(context: BrowserContext, api: Fixture, target: Target) {
  await context.routeWebSocket(target.websocket, (socket) => {
    socket.onMessage((input) => {
      if (typeof input !== 'string') return;
      const frame: unknown = JSON.parse(input);
      if (!Array.isArray(frame) || frame.length !== 5) return;
      const [join, ref, topic, event] = frame;
      if (event === 'phx_join') socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'error', response: { reason: 'Local fixture' } }]));
      if (event === 'heartbeat') socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
  });
  await context.route('https://**/*', async (route) => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe(target.origin);
    // Fixtures are mutable, so a catch-up must never read a cached earlier page.
    const reply = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'X-Supabase-Api-Version': '2024-01-01', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
    const single = route.request().headers().accept?.includes('vnd.pgrst.object') ?? false;
    const path = url.pathname;

    if (path === '/auth/v1/token') {
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: A, exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;
      return reply({ access_token: token, refresh_token: 'local-list-refresh', expires_in: 3600, token_type: 'bearer', user });
    }
    if (path === '/auth/v1/user') return reply(user);
    if (path === '/auth/v1/logout') return reply({});

    if (path === '/rest/v1/rpc/get_chat_member_snapshot') {
      const body: unknown = route.request().postDataJSON();
      const chatId = body && typeof body === 'object' && 'p_chat_id' in body && typeof body.p_chat_id === 'string' ? body.p_chat_id : '';
      const rows = api.members.filter((row) => row.chat_id === chatId);
      return reply({ members: rows, total_count: rows.length });
    }
    if (path === '/rest/v1/chats') {
      const filter = url.searchParams.get('chat_id');
      if (filter?.startsWith('eq.')) {
        const found = api.chats.find((row) => row.chat_id === filter.slice(3)) ?? null;
        return reply(single ? found : found === null ? [] : [found]);
      }
      // listMyChats pages by chat_id; an empty continuation ends the loop.
      if (filter?.startsWith('gt.')) return reply([]);
      const owner = url.searchParams.get('chat_members.user_id')?.replace(/^eq\./, '') ?? null;
      const rows = api.chats
        .filter((row) => owner === null || api.members.some((entry) => entry.chat_id === row.chat_id && entry.user_id === owner))
        .sort((left, right) => (left.chat_id < right.chat_id ? -1 : left.chat_id > right.chat_id ? 1 : 0));
      return reply(rows);
    }
    if (path === '/rest/v1/profiles') {
      const filter = url.searchParams.get('user_id');
      let rows = api.profiles;
      if (filter?.startsWith('in.(')) {
        const ids = filter.slice(4, -1).split(',');
        rows = api.profiles.filter((row) => ids.includes(row.user_id));
      } else if (filter?.startsWith('eq.')) {
        rows = api.profiles.filter((row) => row.user_id === filter.slice(3));
      }
      return reply(single ? rows[0] ?? null : rows);
    }
    if (['/rest/v1/messages', '/rest/v1/message_media', '/rest/v1/reactions'].includes(path)) {
      const chatId = url.searchParams.get('chat_id')?.replace(/^eq\./, '') ?? '';
      const after = Number(url.searchParams.get('sync_seq')?.replace(/^gt\./, '') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 500);
      const table = path === '/rest/v1/messages' ? api.messages : path === '/rest/v1/message_media' ? api.media : api.reactions;
      const rows = table
        .filter((row) => row.chat_id === chatId && row.sync_seq > after)
        .sort((left, right) => left.sync_seq - right.sync_seq)
        .slice(0, limit);
      return reply(rows);
    }
    if (path === '/rest/v1/folders' || path === '/rest/v1/folder_chats') return reply([]);
    throw new Error(`Unexpected chat list fixture API: ${path}`);
  });
}

function watch(page: Page, problems: string[]) {
  page.on('pageerror', (error) => problems.push(error.message));
  // HTTP/offline transport failures are expected fault cases; application warnings/errors are not.
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type()) && !message.text().startsWith('Failed to load resource:')) problems.push(message.text());
  });
}

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email or username', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('local-list-password12');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Chat list', exact: true })).toBeVisible();
}

function rows(page: Page) {
  return page.getByRole('region', { name: 'Chat list', exact: true }).locator('ul li a');
}
async function rowTitles(page: Page) {
  return rows(page).evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('aria-label') ?? '').split(',')[0] ?? ''));
}

test.describe('chat list and archive', () => {
  test('lists cached chats in D-94 order, reorders on catch-up and matches a second context', async ({ browser, baseURL }) => {
    if (!baseURL) throw new Error('A base URL is required.');
    const target = await resolveTarget(baseURL);
    const api = fixture();
    const problems: string[] = [];
    const first = await browser.newContext();
    const second = await browser.newContext();
    try {
      await install(first, api, target);
      await install(second, api, target);
      const page = await first.newPage();
      watch(page, problems);
      await page.setViewportSize({ width: 1280, height: 900 });
      await signIn(page);
      await expect(page.locator('meta[name="dg-supabase-url"]')).toHaveAttribute('content', target.origin);

      await expect.poll(() => rowTitles(page)).toEqual(['Saved Messages', 'Bruno Diaz', 'Beach Trip', 'Book Club']);
      await expect(rows(page).first()).toHaveAccessibleName(/^Saved Messages/);
      await expect(rows(page).first().locator('xpath=..')).toHaveCSS('height', '72px');
      await expect(page.getByRole('link', { name: /^Bruno Diaz/ })).toHaveAccessibleName(/Hello there/);

      // B sends to the direct chat; the returning-connection catch-up merges the row (D-40).
      api.send(DIRECT, B, 'Ping from B');
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(rows(page).first()).toHaveAccessibleName(/^Bruno Diaz, 1 unread, Ping from B/, { timeout: 2000 });
      await expect(rows(page).first().getByText('1', { exact: true })).toBeVisible();
      await expect(page).toHaveTitle('(1) DoloGram');
      expect(await rowTitles(page)).toEqual(['Bruno Diaz', 'Saved Messages', 'Beach Trip', 'Book Club']);

      // T-04: a second browser context signed in as the same account shows the same list.
      const other = await second.newPage();
      watch(other, problems);
      await other.setViewportSize({ width: 1280, height: 900 });
      await signIn(other);
      await expect.poll(() => rowTitles(other)).toEqual(['Bruno Diaz', 'Saved Messages', 'Beach Trip', 'Book Club']);
      await expect(other).toHaveTitle('(1) DoloGram');
      expect(problems).toEqual([]);
    } finally {
      await first.close();
      await second.close();
    }
  });

  test('offline banner follows the browser and the cached list stays visible offline', async ({ browser, baseURL }) => {
    if (!baseURL) throw new Error('A base URL is required.');
    const target = await resolveTarget(baseURL);
    const api = fixture();
    const problems: string[] = [];
    const context = await browser.newContext();
    try {
      await install(context, api, target);
      const page = await context.newPage();
      watch(page, problems);
      await page.setViewportSize({ width: 1280, height: 900 });
      await signIn(page);
      await expect.poll(() => rowTitles(page)).toEqual(['Saved Messages', 'Bruno Diaz', 'Beach Trip', 'Book Club']);

      await page.getByRole('link', { name: /^Beach Trip/ }).click();
      await expect(page).toHaveURL(new RegExp(`/chat/${GROUP}$`));
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      const banner = page.getByRole('status').filter({ hasText: 'Offline: messages send when connected' });
      await expect(banner).toBeVisible();
      await expect(banner).toHaveCSS('height', '40px');
      await expect(rows(page)).toHaveCount(4);

      // The cached list is still rendered after a history navigation, without a reload.
      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
      await expect.poll(() => rowTitles(page)).toEqual(['Saved Messages', 'Bruno Diaz', 'Beach Trip', 'Book Club']);

      await context.setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(banner).toHaveCount(0);

      // A row opens the chat route full screen below 768 px.
      await page.setViewportSize({ width: 767, height: 900 });
      await page.getByRole('link', { name: /^Book Club/ }).click();
      await expect(page).toHaveURL(new RegExp(`/chat/${OTHER_GROUP}$`));
      await expect(page.getByRole('region', { name: 'Chat', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Chat list' })).toBeHidden();
      expect(problems).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
