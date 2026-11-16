import type { CallBackgroundNativeAction } from '@dologram/call-background';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type NativeCallBackgroundModule = {
  isSupported: () => boolean;
  start: (callId: string, displayName: string, mediaType: 'voice' | 'video', incoming: boolean) => Promise<boolean>;
  stop: (callId: string) => Promise<boolean>;
  consumePendingAction: () => Promise<unknown>;
};

export type CallBackgroundAction = CallBackgroundNativeAction;

function getNativeModule(): NativeCallBackgroundModule | null {
  return Platform.OS === 'android'
    ? requireOptionalNativeModule<NativeCallBackgroundModule>('DoloGramCallBackground')
    : null;
}

export function isCallBackgroundNativeAvailable(): boolean {
  const nativeModule = getNativeModule();
  return nativeModule?.isSupported() === true;
}

export async function startCallBackground(
  callId: string,
  displayName: string,
  mediaType: 'voice' | 'video',
  incoming: boolean,
): Promise<boolean> {
  const nativeModule = getNativeModule();
  if (!nativeModule?.isSupported()) return false;
  try {
    return await nativeModule.start(callId, displayName, mediaType, incoming);
  } catch {
    return false;
  }
}

export async function stopCallBackground(callId: string | null): Promise<void> {
  const nativeModule = getNativeModule();
  if (!callId || !nativeModule?.isSupported()) return;
  await nativeModule.stop(callId).catch(() => false);
}

export function parseCallBackgroundAction(value: unknown): CallBackgroundAction | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.callId !== 'string' || candidate.callId.trim().length === 0) return null;
  if (candidate.action !== 'answer' && candidate.action !== 'decline' && candidate.action !== 'end') return null;
  return { callId: candidate.callId, action: candidate.action };
}

export async function consumeCallBackgroundAction(): Promise<CallBackgroundAction | null> {
  const nativeModule = getNativeModule();
  if (!nativeModule?.isSupported()) return null;
  try {
    const action = await nativeModule.consumePendingAction();
    return parseCallBackgroundAction(action);
  } catch {
    return null;
  }
}
