/** Immediate, account-scoped star feedback while serialized device writes finish. */
type Change = { enabled: boolean };
// Keep saved feedback until cache cleanup so an older list read cannot undo it.
type State = { confirmed?: boolean; pending: Change[] };
const states = new Map<string, Map<string, State>>();
let snapshot: ReadonlyMap<string, ReadonlyMap<string, boolean>> = new Map();
const listeners = new Set<() => void>();

function publish() {
  snapshot = new Map([...states].map(([userId, chats]) => [userId, new Map(
    [...chats].flatMap(([chatId, state]) => {
      const enabled = state.pending.at(-1)?.enabled ?? state.confirmed;
      return enabled === undefined ? [] : [[chatId, enabled] as const];
    }),
  )]));
  listeners.forEach((listener) => listener());
}

export function subscribeStarredState(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getStarredState() { return snapshot; }

/** Later requests stay visible even when an earlier write succeeds or fails. */
export function beginStarChange(userId: string, chatId: string, enabled: boolean) {
  const chats = states.get(userId) ?? new Map<string, State>();
  states.set(userId, chats);
  const state: State = chats.get(chatId) ?? { pending: [] };
  chats.set(chatId, state);
  const change = { enabled };
  state.pending.push(change);
  publish();
  return (saved: boolean) => {
    if (states.get(userId)?.get(chatId) !== state) return;
    if (saved) state.confirmed = enabled;
    state.pending = state.pending.filter((candidate) => candidate !== change);
    if (state.pending.length === 0 && state.confirmed === undefined) chats.delete(chatId);
    publish();
  };
}

export function clearStarredState() {
  states.clear();
  publish();
}
