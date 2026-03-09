import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BaseInlineCellEditorComponent, INLINE_CELL_EDITOR_TEMPLATE } from '@alaarab/ogrid-angular';

@Component({
  selector: 'ogrid-primeng-inline-cell-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: INLINE_CELL_EDITOR_TEMPLATE,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class InlineCellEditorComponent<T = unknown> extends BaseInlineCellEditorComponent<T> {}
