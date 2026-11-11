import { supabase } from '../lib/supabase';

let channelCounter = 0;

export type CallRealtimeHandle = { stop: () => Promise<void> };

export function startCallRealtime(onChange: () => void): CallRealtimeHandle {
  const channel = supabase
    .channel(`dologram:calls:${++channelCounter}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'call_participants' }, onChange);

  void channel.subscribe();

  return {
    async stop() {
      await supabase.removeChannel(channel);
    },
  };
}
