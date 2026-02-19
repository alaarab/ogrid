import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePopoverCellEditorComponent, POPOVER_CELL_EDITOR_TEMPLATE, POPOVER_CELL_EDITOR_OVERLAY_STYLES } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-mat-popover-cell-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: POPOVER_CELL_EDITOR_TEMPLATE,
  styles: [`
    ${POPOVER_CELL_EDITOR_OVERLAY_STYLES}
    .ogrid-popover-anchor {
      width: 100%; height: 100%; display: flex; align-items: center; min-width: 0;
      padding: 6px 10px; box-sizing: border-box; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; user-select: none;
      outline: 2px solid var(--ogrid-selection, #217346); outline-offset: -1px;
      z-index: 2; position: relative;
    }
  `],
})
export class PopoverCellEditorComponent<T = unknown> extends BasePopoverCellEditorComponent<T> {}
