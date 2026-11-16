type StopHandler = () => Promise<void> | void;

const recorderStops = new Set<StopHandler>();
const playbackPauses = new Set<StopHandler>();
const alarmReconciles = new Set<StopHandler>();
let callAudioOwned = false;

export function isCallAudioOwned(): boolean {
  return callAudioOwned;
}

export function registerRecorderStop(handler: StopHandler): () => void {
  recorderStops.add(handler);
  return () => recorderStops.delete(handler);
}

export function registerPlaybackPause(handler: StopHandler): () => void {
  playbackPauses.add(handler);
  return () => playbackPauses.delete(handler);
}

export function registerAlarmReconcile(handler: StopHandler): () => void {
  alarmReconciles.add(handler);
  return () => alarmReconciles.delete(handler);
}

export async function acquireCallAudio(): Promise<() => void> {
  if (callAudioOwned) return () => undefined;

  callAudioOwned = true;
  try {
    await Promise.all([...recorderStops, ...playbackPauses].map((handler) => Promise.resolve(handler())));
  } catch (error) {
    callAudioOwned = false;
    throw error;
  }

  return () => {
    callAudioOwned = false;
    void Promise.all([...alarmReconciles].map((handler) => Promise.resolve(handler())));
  };
}
