import { useCallback, useRef, useState } from 'react';

export interface UseOGridFullScreenResult {
  isFullScreen: boolean;
  setFullScreen: (next: boolean) => void;
}

/**
 * Fullscreen state for OGrid, controlled by `isFullScreen` or kept here. It
 * lives above the layout so the toolbar button, the header corner menu, the
 * column menu and the keyboard shortcut all drive the same state.
 */
export function useOGridFullScreen(
  controlled: boolean | undefined,
  onFullScreenChange: ((isFullScreen: boolean) => void) | undefined,
): UseOGridFullScreenResult {
  const [internal, setInternal] = useState(false);
  const isFullScreen = controlled ?? internal;
  const currentRef = useRef(isFullScreen);
  currentRef.current = isFullScreen;
  const onChangeRef = useRef(onFullScreenChange);
  onChangeRef.current = onFullScreenChange;
  const isControlled = controlled !== undefined;
  const setFullScreen = useCallback((next: boolean) => {
    if (next === currentRef.current) return;
    // Controlled: only ask. The state moves when the parent passes it back.
    if (!isControlled) {
      currentRef.current = next;
      setInternal(next);
    }
    onChangeRef.current?.(next);
  }, [isControlled]);
  return { isFullScreen, setFullScreen };
}
