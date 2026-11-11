import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { Gesture as NativeGesture } from 'react-native-gesture-handler';

type PanHandlers = ReturnType<typeof NativeGesture.Pan>['handlers'];

type GestureBuilder = {
  handlers: Partial<PanHandlers>;
  minDistance: () => GestureBuilder;
  activeOffsetY: () => GestureBuilder;
  failOffsetX: () => GestureBuilder;
  onBegin: (callback: NonNullable<PanHandlers['onBegin']>) => GestureBuilder;
  onUpdate: (callback: NonNullable<PanHandlers['onUpdate']>) => GestureBuilder;
  onEnd: (callback: NonNullable<PanHandlers['onEnd']>) => GestureBuilder;
};

const createGesture = (): GestureBuilder => {
  const gesture = {} as GestureBuilder;
  gesture.handlers = {};
  gesture.minDistance = () => gesture;
  gesture.activeOffsetY = () => gesture;
  gesture.failOffsetX = () => gesture;
  gesture.onBegin = (callback) => { gesture.handlers.onBegin = callback; return gesture; };
  gesture.onUpdate = (callback) => { gesture.handlers.onUpdate = callback; return gesture; };
  gesture.onEnd = (callback) => { gesture.handlers.onEnd = callback; return gesture; };
  return gesture;
};

export const Gesture = { Pan: createGesture };

export function GestureDetector({ children }: { gesture: GestureBuilder; children: React.ReactNode }) {
  return <>{children}</>;
}

export function GestureHandlerRootView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}
