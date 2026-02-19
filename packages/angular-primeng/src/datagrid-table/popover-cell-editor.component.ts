import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePopoverCellEditorComponent, POPOVER_CELL_EDITOR_TEMPLATE, POPOVER_CELL_EDITOR_OVERLAY_STYLES } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-primeng-popover-cell-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: POPOVER_CELL_EDITOR_TEMPLATE,
  styles: [`
    ${POPOVER_CELL_EDITOR_OVERLAY_STYLES}
    .ogrid-popover-anchor {
      padding: 6px 10px; min-height: 20px; cursor: default; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
      outline: 2px solid var(--ogrid-selection, #217346); outline-offset: -2px;
    }
  `],
})
export class PopoverCellEditorComponent<T = unknown> extends BasePopoverCellEditorComponent<T> {}
