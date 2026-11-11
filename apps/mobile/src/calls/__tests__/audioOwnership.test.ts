import { acquireCallAudio, isCallAudioOwned, registerPlaybackPause, registerRecorderStop } from '../audioOwnership';

describe('call audio ownership', () => {
  it('stops recorders and pauses playback before ownership is granted', async () => {
    const events: string[] = [];
    const unregisterRecorder = registerRecorderStop(() => { events.push('recording-stopped'); });
    const unregisterPlayback = registerPlaybackPause(() => { events.push('playback-paused'); });

    const release = await acquireCallAudio();

    expect(events).toEqual(['recording-stopped', 'playback-paused']);
    expect(isCallAudioOwned()).toBe(true);
    release();
    expect(isCallAudioOwned()).toBe(false);
    unregisterRecorder();
    unregisterPlayback();
  });

  it('does not leave ownership set when a consumer cannot stop cleanly', async () => {
    const unregister = registerRecorderStop(() => { throw new Error('stop failed'); });

    await expect(acquireCallAudio()).rejects.toThrow('stop failed');
    expect(isCallAudioOwned()).toBe(false);
    unregister();
  });
});
