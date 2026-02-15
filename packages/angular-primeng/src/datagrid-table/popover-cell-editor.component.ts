import { Component, ChangeDetectionStrategy, signal, effect, ViewChild, ElementRef, Injector, createComponent, EnvironmentInjector, inject, Input } from '@angular/core';
import type { IColumnDef, ICellEditorProps } from '@alaarab/ogrid-core';

/**
 * PopoverCellEditor component for Angular PrimeNG.
 * Renders custom popover editor when anchor element is set.
 */
@Component({
  selector: 'ogrid-primeng-popover-cell-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #anchorEl
      class="ogrid-popover-anchor"
      [attr.data-row-index]="rowIndex"
      [attr.data-col-index]="globalColIndex"
    >
      {{ displayValue }}
    </div>
    @if (showEditor()) {
      <div class="ogrid-popover-editor-overlay" (click)="handleOverlayClick()">
        <div class="ogrid-popover-editor-content" #editorContainer></div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .ogrid-popover-anchor {
      padding: 6px 10px; min-height: 20px; cursor: default; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
      outline: 2px solid var(--ogrid-selection, #217346); outline-offset: -2px;
    }
    .ogrid-popover-editor-overlay {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    }
    .ogrid-popover-editor-content {
      background: #fff; border-radius: 4px; padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 90vw; max-height: 90vh; overflow: auto;
    }
  `],
})
export class PopoverCellEditorComponent<T> {
  @Input({ required: true }) item!: T;
  @Input({ required: true }) column!: IColumnDef<T>;
  @Input({ required: true }) rowIndex!: number;
  @Input({ required: true }) globalColIndex!: number;
  @Input({ required: true }) displayValue!: unknown;
  @Input({ required: true }) editorProps!: ICellEditorProps<T>;
  @Input({ required: true }) onCancel!: () => void;

  @ViewChild('anchorEl') private anchorRef?: ElementRef<HTMLElement>;
  @ViewChild('editorContainer') private editorContainerRef?: ElementRef<HTMLElement>;
  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);

  protected readonly showEditor = signal(false);

  constructor() {
    // Show editor after anchor is rendered
    effect(() => {
      const anchor = this.anchorRef;
      if (anchor) {
        setTimeout(() => this.showEditor.set(true), 0);
      }
    });

    // Render custom editor component when container is available
    effect(() => {
      const container = this.editorContainerRef;
      const props = this.editorProps;
      const col = this.column;
      if (!container || !this.showEditor() || typeof col.cellEditor !== 'function') return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const EditorComponent = col.cellEditor as unknown as any; // ComponentType
      const componentRef = createComponent(EditorComponent, {
        environmentInjector: this.envInjector,
        elementInjector: this.injector,
      });

      // Pass props to component instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.assign(componentRef.instance as any, props);
      componentRef.changeDetectorRef.detectChanges();

      // Append to DOM
      container.nativeElement.appendChild(componentRef.location.nativeElement);

      // Cleanup on destroy
      return () => componentRef.destroy();
    });
  }

  protected handleOverlayClick(): void {
    this.onCancel();
  }
}
