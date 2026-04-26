import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePopoverCellEditorComponent, POPOVER_CELL_EDITOR_TEMPLATE } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-radix-popover-cell-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: POPOVER_CELL_EDITOR_TEMPLATE,
  styles: [`
    :host { display: contents; }
    .ogrid-popover-editor-overlay {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    }
    .ogrid-popover-editor-content {
      background: var(--ogrid-bg, #ffffff); border-radius: 4px; padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-width: 90vw; max-height: 90vh; overflow: auto;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-popover-anchor {
      width: 100%; height: 100%; display: flex; align-items: center; min-width: 0;
      padding: 6px 10px; box-sizing: border-box; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; user-select: none;
      outline: 2px solid var(--ogrid-selection-color, #217346); outline-offset: -1px;
      z-index: 2; position: relative;
    }
  `],
})
export class PopoverCellEditorComponent<T = unknown> extends BasePopoverCellEditorComponent<T> {}
