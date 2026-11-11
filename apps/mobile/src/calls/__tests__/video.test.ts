import type { Room } from 'livekit-client';
import { setCameraEnabled } from '../media';
import { shouldStartCamera } from '../state';
import type { CallSnapshot } from '@dologram/shared';

const acceptedVideoSnapshot = (callerId: string): CallSnapshot => ({
  call: {
    callId: 'call',
    chatId: 'chat',
    callerId,
    calleeId: 'callee',
    mediaType: 'video',
    status: 'accepted',
    createdAt: '2026-11-11T00:00:00.000Z',
    ringExpiresAt: '2026-11-11T00:01:00.000Z',
    acceptedAt: '2026-11-11T00:00:10.000Z',
    connectExpiresAt: '2026-11-11T00:00:40.000Z',
    connectedAt: null,
    endedAt: null,
    endedBy: null,
    endReason: null,
    revision: '2',
  },
  participants: [],
  capabilities: { canAnswer: false, canCancel: false, canJoin: true, canEnd: true, belongsToThisSession: true },
  availability: { callingEnabled: true },
  serverTime: '2026-11-11T00:00:00.000Z',
  cleanupState: 'not_required',
});

describe('foreground video calling', () => {
  it('starts the caller camera only after video acceptance', () => {
    const snapshot = acceptedVideoSnapshot('caller');
    expect(shouldStartCamera(snapshot, 'caller')).toBe(true);
    expect(shouldStartCamera(snapshot, 'callee')).toBe(false);
    const voiceSnapshot: CallSnapshot = {
      ...snapshot,
      call: snapshot.call ? { ...snapshot.call, mediaType: 'voice' } : null,
    };
    expect(shouldStartCamera(voiceSnapshot, 'caller')).toBe(false);
  });

  it('unpublishes and stops the camera capture when camera is turned off', async () => {
    const track = {};
    const publication = { track };
    const unpublishTrack = jest.fn(() => Promise.resolve(undefined));
    const setCameraEnabledNative = jest.fn(() => Promise.resolve(undefined));
    const room = {
      localParticipant: {
        getTrackPublication: () => publication,
        unpublishTrack,
        setCameraEnabled: setCameraEnabledNative,
      },
    } as unknown as Room;

    await setCameraEnabled(room, false);

    expect(unpublishTrack).toHaveBeenCalledWith(track, true);
    expect(setCameraEnabledNative).not.toHaveBeenCalled();
  });
});
