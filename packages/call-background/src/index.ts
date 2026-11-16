export type CallBackgroundNativeAction = {
  callId: string;
  action: 'answer' | 'decline' | 'end';
};
