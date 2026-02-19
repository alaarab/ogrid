import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BaseInlineCellEditorComponent, INLINE_CELL_EDITOR_TEMPLATE, INLINE_CELL_EDITOR_STYLES } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-radix-inline-cell-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: INLINE_CELL_EDITOR_TEMPLATE,
  styles: [INLINE_CELL_EDITOR_STYLES],
})
export class InlineCellEditorComponent<T = unknown> extends BaseInlineCellEditorComponent<T> {}
