import { type Ref } from 'vue';
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
/**
 * Manages side bar panel state: enabled panels, active panel, position, and toggle/close handlers.
 */
export declare function useSideBarState(params: UseSideBarStateParams): UseSideBarStateResult;
