import { supabase } from '../lib/supabase';

let channelCounter = 0;

export type CallRealtimeHandle = { stop: () => Promise<void> };

export type CallRealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

export function startCallRealtime(onChange: () => void, onStatus?: (status: CallRealtimeStatus) => void): CallRealtimeHandle {
  const channel = supabase
    .channel(`dologram:calls:${++channelCounter}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'call_participants' }, onChange);

  void channel.subscribe((status) => {
    if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      onStatus?.(status);
    }
  });

  return {
    async stop() {
      await supabase.removeChannel(channel);
    },
  };
}
