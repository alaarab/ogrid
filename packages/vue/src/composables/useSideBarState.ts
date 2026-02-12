import { ref, computed, type Ref } from 'vue';
import type { SideBarPanelId, ISideBarDef } from '../types';

export interface UseSideBarStateParams {
  config: boolean | ISideBarDef | undefined;
}

export interface UseSideBarStateResult {
  isEnabled: boolean;
  activePanel: Ref<SideBarPanelId | null>;
  setActivePanel: (panel: SideBarPanelId | null) => void;
  panels: SideBarPanelId[];
  position: 'left' | 'right';
  isOpen: Ref<boolean>;
  toggle: (panel: SideBarPanelId) => void;
  close: () => void;
}

const DEFAULT_PANELS: SideBarPanelId[] = ['columns', 'filters'];

/**
 * Manages side bar panel state: enabled panels, active panel, position, and toggle/close handlers.
 */
export function useSideBarState(params: UseSideBarStateParams): UseSideBarStateResult {
  const { config } = params;
  const isEnabled = config != null && config !== false;

  const parsed = (() => {
    if (!isEnabled || config === true) {
      return { panels: DEFAULT_PANELS, position: 'right' as const, defaultPanel: null as SideBarPanelId | null };
    }
    const def = config as ISideBarDef;
    return {
      panels: def.panels ?? DEFAULT_PANELS,
      position: def.position ?? 'right',
      defaultPanel: def.defaultPanel ?? null,
    };
  })();

  const activePanel = ref<SideBarPanelId | null>(parsed.defaultPanel);

  const setActivePanel = (panel: SideBarPanelId | null) => {
    activePanel.value = panel;
  };

  const toggle = (panel: SideBarPanelId) => {
    activePanel.value = activePanel.value === panel ? null : panel;
  };

  const close = () => {
    activePanel.value = null;
  };

  const isOpen = computed(() => activePanel.value !== null);

  return {
    isEnabled,
    activePanel,
    setActivePanel,
    panels: parsed.panels,
    position: parsed.position,
    isOpen,
    toggle,
    close,
  };
}
