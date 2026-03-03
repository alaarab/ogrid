import { useState, useCallback, useRef, useEffect } from 'react';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface UseContextMenuResult {
  contextMenuPosition: ContextMenuPosition | null;
  setContextMenuPosition: (pos: ContextMenuPosition | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  closeContextMenu: () => void;
  /** Attach to an element's onPointerDown to enable long-press context menu on touch. */
  handleLongPressStart: (e: React.PointerEvent) => void;
  /** Attach to an element's onPointerUp/onPointerCancel/onPointerLeave to cancel long press. */
  handleLongPressEnd: () => void;
}

const LONG_PRESS_DELAY = 500; // ms

/**
 * Manages context menu position state for right-click and long-press (touch) menus.
 * @returns Menu position, setter, right-click/long-press handlers, and close handler.
 */
export function useContextMenu(): UseContextMenuResult {
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<ContextMenuPosition | null>(null);

  const handleCellContextMenu = useCallback((e: { clientX: number; clientY: number; preventDefault?: () => void }) => {
    e.preventDefault?.();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuPosition(null);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPosRef.current = null;
  }, []);

  const handleLongPressStart = useCallback((e: React.PointerEvent) => {
    // Only activate long-press on touch (coarse pointer) to avoid interfering with mouse
    if (e.pointerType !== 'touch') return;
    cancelLongPress();
    const pos = { x: e.clientX, y: e.clientY };
    longPressPosRef.current = pos;
    longPressTimerRef.current = setTimeout(() => {
      const savedPos = longPressPosRef.current;
      if (savedPos) {
        setContextMenuPosition(savedPos);
      }
      longPressTimerRef.current = null;
      longPressPosRef.current = null;
    }, LONG_PRESS_DELAY);
  }, [cancelLongPress]);

  const handleLongPressEnd = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  return {
    contextMenuPosition,
    setContextMenuPosition,
    handleCellContextMenu,
    closeContextMenu,
    handleLongPressStart,
    handleLongPressEnd,
  };
}
