import { parseCallBackgroundAction } from '../background';

describe('native call background action validation', () => {
  it('accepts only durable actions from the Android receiver', () => {
    expect(parseCallBackgroundAction({ callId: 'call-1', action: 'answer' })).toEqual({ callId: 'call-1', action: 'answer' });
    expect(parseCallBackgroundAction({ callId: 'call-1', action: 'decline' })).toEqual({ callId: 'call-1', action: 'decline' });
    expect(parseCallBackgroundAction({ callId: 'call-1', action: 'end' })).toEqual({ callId: 'call-1', action: 'end' });
  });

  it('rejects malformed, empty and unsupported actions', () => {
    expect(parseCallBackgroundAction(null)).toBeNull();
    expect(parseCallBackgroundAction({ callId: '', action: 'answer' })).toBeNull();
    expect(parseCallBackgroundAction({ callId: '   ', action: 'answer' })).toBeNull();
    expect(parseCallBackgroundAction({ callId: 'call-1', action: 'cancel' })).toBeNull();
    expect(parseCallBackgroundAction({ callId: 'call-1', action: 1 })).toBeNull();
  });
});
