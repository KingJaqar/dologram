import React from 'react';
import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';
import { useDelayedFlag } from '../hooks/useDelayedFlag';

type DelayedActivityIndicatorProps = ActivityIndicatorProps & {
  active?: boolean;
};

/** Shows a native spinner only when a wait reaches the 300 ms loading threshold. */
export function DelayedActivityIndicator({ active = true, ...props }: DelayedActivityIndicatorProps) {
  const visible = useDelayedFlag(active);
  return visible ? <ActivityIndicator {...props} /> : null;
}
