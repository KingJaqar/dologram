import { useEffect, useRef, type RefObject } from 'react';
import { Easing, type TextInput } from 'react-native';
import type { StackNavigationOptions, StackNavigationProp } from 'expo-router/js-stack';

export const SEARCH_TRANSITION_MS = 250;

const timing = {
  animation: 'timing',
  config: { duration: SEARCH_TRANSITION_MS, easing: Easing.out(Easing.cubic) },
} as const;

export const searchCrossfade: StackNavigationOptions = {
  animation: 'fade',
  transitionSpec: { open: timing, close: timing },
  // Fade the top card over the opaque card below it. Both screens stay
  // visible during the handoff without exposing the navigator background.
  cardStyleInterpolator: ({ current }) => ({ cardStyle: { opacity: current.progress } }),
  cardOverlayEnabled: false,
  cardShadowEnabled: false,
};

export type SearchFocusState = { hasFocused: boolean };

/**
 * Focus the search input only for a completed, currently visible entry.
 * Keeping the state outside React state makes rerenders and cover/uncover events inert.
 */
export function focusSearchInputOnce(
  state: SearchFocusState,
  closing: boolean,
  navigationFocused: boolean,
  focus: () => void,
): boolean {
  if (closing || !navigationFocused || state.hasFocused) return false;
  state.hasFocused = true;
  focus();
  return true;
}

export type SearchNavigation = Pick<StackNavigationProp<ReactNavigation.RootParamList>, 'addListener' | 'isFocused'>;

export function useSearchInputFocus(
  navigation: SearchNavigation,
  inputRef: RefObject<TextInput | null>,
  focused: boolean,
  reduceMotion: boolean,
): void {
  const state = useRef<SearchFocusState>({ hasFocused: false });

  useEffect(() => {
    if (!focused || state.current.hasFocused) return;

    const focus = () => inputRef.current?.focus();
    if (reduceMotion) {
      focusSearchInputOnce(state.current, false, navigation.isFocused(), focus);
      return;
    }

    return navigation.addListener('transitionEnd', ({ data }) => {
      focusSearchInputOnce(state.current, data.closing, navigation.isFocused(), focus);
    });
  }, [focused, inputRef, navigation, reduceMotion]);
}

export function isSearchRoute(name: string | undefined): boolean {
  return name === 'search' || name === 'chat/[chatId]/search';
}
