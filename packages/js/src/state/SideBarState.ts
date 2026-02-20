import type { SideBarPanelId, ISideBarDef } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

const DEFAULT_PANELS: SideBarPanelId[] = ['columns', 'filters'];

export class SideBarState {
  private emitter = new EventEmitter<{ change: undefined }>();
  private _isEnabled: boolean;
  private _panels: SideBarPanelId[];
  private _position: 'left' | 'right';
  private _activePanel: SideBarPanelId | null;

  constructor(config: boolean | ISideBarDef | undefined) {
    this._isEnabled = config != null && config !== false;

    if (!this._isEnabled || config === true) {
      this._panels = DEFAULT_PANELS;
      this._position = 'right';
      this._activePanel = null;
    } else {
      const def = config as ISideBarDef;
      this._panels = def.panels ?? DEFAULT_PANELS;
      this._position = def.position ?? 'right';
      this._activePanel = def.defaultPanel ?? null;
    }
  }

  get isEnabled(): boolean { return this._isEnabled; }
  get panels(): SideBarPanelId[] { return this._panels; }
  get position(): 'left' | 'right' { return this._position; }
  get activePanel(): SideBarPanelId | null { return this._activePanel; }
  get isOpen(): boolean { return this._activePanel !== null; }

  setActivePanel(panel: SideBarPanelId | null): void {
    this._activePanel = panel;
    this.emitter.emit('change');
  }

  toggle(panel: SideBarPanelId): void {
    this.setActivePanel(this._activePanel === panel ? null : panel);
  }

  close(): void {
    this.setActivePanel(null);
  }

  onChange(handler: () => void): () => void {
    this.emitter.on('change', handler);
    return () => this.emitter.off('change', handler);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
