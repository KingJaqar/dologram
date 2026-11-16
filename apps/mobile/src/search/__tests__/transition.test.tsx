import React, { type RefObject } from 'react';
import { act, render } from '@testing-library/react-native';
import type { TextInput } from 'react-native';
import { focusSearchInputOnce, SEARCH_TRANSITION_MS, searchCrossfade, useSearchInputFocus, type SearchFocusState, type SearchNavigation } from '../transition';

test('uses one 250ms native crossfade strategy', () => {
  expect(SEARCH_TRANSITION_MS).toBe(250);
  expect(searchCrossfade.animation).toBe('fade');
  expect(searchCrossfade.cardOverlayEnabled).toBe(false);
  expect(searchCrossfade.cardShadowEnabled).toBe(false);
});

test('does not focus on a closing or interrupted transition', () => {
  const state: SearchFocusState = { hasFocused: false };
  const focus = jest.fn();

  expect(focusSearchInputOnce(state, true, true, focus)).toBe(false);
  expect(focusSearchInputOnce(state, false, false, focus)).toBe(false);
  expect(focus).not.toHaveBeenCalled();
  expect(state.hasFocused).toBe(false);
});

test('focuses once after entry and ignores rerender or cover/uncover events', () => {
  const state: SearchFocusState = { hasFocused: false };
  const focus = jest.fn();

  expect(focusSearchInputOnce(state, false, true, focus)).toBe(true);
  expect(focusSearchInputOnce(state, false, true, focus)).toBe(false);
  expect(focusSearchInputOnce(state, false, true, focus)).toBe(false);
  expect(focus).toHaveBeenCalledTimes(1);
});

test('focus hook waits for transition end, ignores cover/uncover, and handles reduced motion', () => {
  const focus = jest.fn();
  const inputRef: RefObject<TextInput | null> = { current: { focus } as unknown as TextInput };
  const listeners: ((event: { data: { closing: boolean } }) => void)[] = [];
  const navigation = {
    isFocused: () => true,
    addListener: (_event: 'transitionEnd', listener: (event: { data: { closing: boolean } }) => void) => {
      listeners.push(listener);
      return () => undefined;
    },
  };
  const focusNavigation = navigation as unknown as SearchNavigation;
  function Probe({ reduceMotion }: { reduceMotion: boolean }) {
    useSearchInputFocus(focusNavigation, inputRef, true, reduceMotion);
    return null;
  }

  const screen = render(<Probe reduceMotion={false} />);
  expect(focus).not.toHaveBeenCalled();
  act(() => listeners[0]?.({ data: { closing: false } }));
  expect(focus).toHaveBeenCalledTimes(1);
  screen.rerender(<Probe reduceMotion={false} />);
  act(() => listeners[0]?.({ data: { closing: false } }));
  expect(focus).toHaveBeenCalledTimes(1);
  screen.unmount();

  const reducedRef: RefObject<TextInput | null> = { current: { focus } as unknown as TextInput };
  function ReducedProbe() {
    useSearchInputFocus(focusNavigation, reducedRef, true, true);
    return null;
  }
  render(<ReducedProbe />);
  expect(focus).toHaveBeenCalledTimes(2);
});

