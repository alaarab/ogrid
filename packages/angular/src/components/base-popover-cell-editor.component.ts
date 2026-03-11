import { AfterViewInit, Directive, Input, ViewChild, ElementRef, Injector, EnvironmentInjector, inject, signal, effect, createComponent } from '@angular/core';
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
@Directive()
export abstract class BasePopoverCellEditorComponent<T = unknown> implements AfterViewInit {
  @Input({ required: true }) item!: T;
  @Input({ required: true }) column!: IColumnDef<T>;
  @Input({ required: true }) rowIndex!: number;
  @Input({ required: true }) globalColIndex!: number;
  @Input({ required: true }) displayValue!: unknown;
  @Input({ required: true }) editorProps!: ICellEditorProps<T>;
  @Input({ required: true }) onCancel!: () => void;

  @ViewChild('editorContainer')
  private set editorContainerRef(ref: ElementRef<HTMLElement> | undefined) {
    this.editorContainerRefSig.set(ref);
  }

  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly editorContainerRefSig = signal<ElementRef<HTMLElement> | undefined>(undefined);

  protected readonly showEditor = signal(false);

  ngAfterViewInit(): void {
    // Defer until after the anchor has painted; the editor container is gated by
    // `showEditor()`, so the container ViewChild signal will fire on the next render.
    setTimeout(() => this.showEditor.set(true), 0);
  }

  constructor() {
    // Render custom editor component when container is available.
    // Angular's effect() ignores return values  -  use onCleanup() for cleanup.
    effect((onCleanup) => {
      const container = this.editorContainerRefSig();
      const props = this.editorProps;
      const col = this.column;
      if (!container || !this.showEditor() || typeof col.cellEditor !== 'function') return;

      const EditorComponent = col.cellEditor as unknown as new (...args: unknown[]) => unknown;
      const componentRef = createComponent(EditorComponent, {
        environmentInjector: this.envInjector,
        elementInjector: this.injector,
      });

      // Pass props to component instance
      Object.assign(componentRef.instance as Record<string, unknown>, props);
      componentRef.changeDetectorRef.detectChanges();

      // Append to DOM
      container.nativeElement.appendChild(componentRef.location.nativeElement);

      // Cleanup when effect re-runs or component is destroyed
      onCleanup(() => componentRef.destroy());
    });
  }

  protected handleOverlayClick(): void {
    this.onCancel();
  }
}
