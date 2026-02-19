import { Input, ViewChild, ElementRef, Injector, EnvironmentInjector, inject, signal, effect, createComponent } from '@angular/core';
import type { IColumnDef, ICellEditorProps } from '../types';

/**
 * Shared popover cell editor template used by all Angular UI packages.
 */
export const POPOVER_CELL_EDITOR_TEMPLATE = `
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
`;

/**
 * Shared overlay + content styles for popover cell editors.
 * Subclasses provide their own .ogrid-popover-anchor styles.
 */
export const POPOVER_CELL_EDITOR_OVERLAY_STYLES = `
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
`;

/**
 * Abstract base class for Angular popover cell editors.
 * Contains all shared inputs, ViewChild refs, effects, and overlay click handling.
 *
 * Subclasses only need a @Component decorator with selector, template, and
 * framework-specific .ogrid-popover-anchor CSS styles.
 */
export abstract class BasePopoverCellEditorComponent<T = unknown> {
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
