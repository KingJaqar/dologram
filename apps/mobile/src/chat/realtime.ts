/** One private per-chat Broadcast channel for typing and read hints (D-43, D-57, D-92, D-118). */
import {
  chatTopic,
  realtimeEvents,
  type ReadBroadcast,
  type TypingBroadcast,
} from '@dologram/shared';
import { supabase } from '../lib/supabase';

export type ChatRealtimeCallbacks = {
  onTyping: (payload: TypingBroadcast) => void;
  onRead: (payload: ReadBroadcast) => void;
};

export type ChatRealtimeHandle = {
  sendTyping: (payload: TypingBroadcast) => Promise<boolean>;
  sendRead: (payload: ReadBroadcast) => Promise<boolean>;
  stop: () => void;
};

const removingChannels = new Map<string, Promise<unknown>>();

function isTypingPayload(value: unknown): value is TypingBroadcast {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<TypingBroadcast>;
  return typeof payload.user_id === 'string' && typeof payload.active === 'boolean';
}

function isReadPayload(value: unknown): value is ReadBroadcast {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<ReadBroadcast>;
  return typeof payload.user_id === 'string'
    && payload.user_id.length > 0
    && typeof payload.last_read_seq === 'number'
    && Number.isSafeInteger(payload.last_read_seq)
    && payload.last_read_seq >= 0;
}

export function startChatRealtime(
  chatId: string,
  callbacks: ChatRealtimeCallbacks,
): ChatRealtimeHandle {
  let stopped = false;
  let subscribed = false;
  const topic = chatTopic(chatId);
  let channel: ReturnType<typeof supabase.channel> | null = null;

  function subscribe(): void {
    if (stopped) return;
    channel = supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: realtimeEvents.typing }, (event) => {
        if (!stopped && isTypingPayload(event.payload)) callbacks.onTyping(event.payload);
      })
      .on('broadcast', { event: realtimeEvents.read }, (event) => {
        if (!stopped && isReadPayload(event.payload)) callbacks.onRead(event.payload);
      });
    channel.subscribe((status) => {
      subscribed = !stopped && status === 'SUBSCRIBED';
    });
  }

  // Supabase reuses the existing channel for the same topic until its leave completes.
  const removing = removingChannels.get(topic);
  if (removing) void removing.then(subscribe);
  else subscribe();

  async function send(event: string, payload: TypingBroadcast | ReadBroadcast): Promise<boolean> {
    if (stopped || !subscribed || !channel) return false;
    try {
      return (await channel.send({ type: 'broadcast', event, payload })) === 'ok';
    } catch {
      return false;
    }
  }

  return {
    sendTyping: (payload) => send(realtimeEvents.typing, payload),
    sendRead: (payload) => send(realtimeEvents.read, payload),
    stop: () => {
      if (stopped) return;
      stopped = true;
      subscribed = false;
      if (!channel) return;
      const leaving = channel;
      const removal = supabase.removeChannel(leaving).then((status) => {
        if (status !== 'ok') leaving.teardown();
      }, () => leaving.teardown());
      removingChannels.set(topic, removal);
      void removal.finally(() => {
        if (removingChannels.get(topic) === removal) removingChannels.delete(topic);
      });
    },
  };
}
