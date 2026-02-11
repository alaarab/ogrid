import { useState, useCallback, useMemo } from 'react';
import type { SideBarPanelId, ISideBarDef } from '../types';

export interface UseSideBarStateParams {
  config: boolean | ISideBarDef | undefined;
}

export interface UseSideBarStateResult {
  isEnabled: boolean;
  activePanel: SideBarPanelId | null;
  setActivePanel: (panel: SideBarPanelId | null) => void;
  panels: SideBarPanelId[];
  position: 'left' | 'right';
  isOpen: boolean;
  toggle: (panel: SideBarPanelId) => void;
  close: () => void;
}

const DEFAULT_PANELS: SideBarPanelId[] = ['columns', 'filters'];

/**
 * Manages side bar panel state: enabled panels, active panel, position, and toggle/close handlers.
 * @param params - Side bar config (boolean, ISideBarDef, or undefined).
 * @returns Enabled flag, active panel, setters, panel list, position, open state, toggle, and close.
 */
export function useSideBarState(params: UseSideBarStateParams): UseSideBarStateResult {
  const { config } = params;
  const isEnabled = config != null && config !== false;

  const parsed = useMemo(() => {
    if (!isEnabled || config === true) {
      return { panels: DEFAULT_PANELS, position: 'right' as const, defaultPanel: null as SideBarPanelId | null };
    }
    const def = config as ISideBarDef;
    return {
      panels: def.panels ?? DEFAULT_PANELS,
      position: def.position ?? 'right',
      defaultPanel: def.defaultPanel ?? null,
    };
  }, [isEnabled, config]);

  const [activePanel, setActivePanel] = useState<SideBarPanelId | null>(parsed.defaultPanel);

  const toggle = useCallback((panel: SideBarPanelId) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const close = useCallback(() => {
    setActivePanel(null);
  }, []);

  return {
    isEnabled,
    activePanel,
    setActivePanel,
    panels: parsed.panels,
    position: parsed.position,
    isOpen: activePanel !== null,
    toggle,
    close,
  };
}
