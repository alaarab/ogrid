import { Component, Input, signal, DestroyRef, inject, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import type { ISelectionRange } from '../types';
import { measureRange, injectGlobalStyles, type OverlayRect } from '@alaarab/ogrid-core';

@Component({
  selector: 'ogrid-marching-ants-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .ogrid-marching-ants-svg { position: absolute; pointer-events: none; overflow: visible; }
    .ogrid-marching-ants-svg--selection { z-index: 4; }
    .ogrid-marching-ants-svg--clip { z-index: 5; }
  `],
  template: `
    @if (selRect() && !clipRangeMatchesSel() && !isSingleCellSelection()) {
      <svg
        class="ogrid-marching-ants-svg ogrid-marching-ants-svg--selection"
        [style.top.px]="selRect()!.top"
        [style.left.px]="selRect()!.left"
        [style.width.px]="selRect()!.width"
        [style.height.px]="selRect()!.height"
        aria-hidden="true"
      >
        <rect
          x="1" y="1"
          [attr.width]="max0(selRect()!.width - 2)"
          [attr.height]="max0(selRect()!.height - 2)"
          fill="none"
          stroke="var(--ogrid-selection-color, #217346)"
          stroke-width="2"
        />
      </svg>
    }
    @if (clipRect()) {
      <svg
        class="ogrid-marching-ants-svg ogrid-marching-ants-svg--clip"
        [style.top.px]="clipRect()!.top"
        [style.left.px]="clipRect()!.left"
        [style.width.px]="clipRect()!.width"
        [style.height.px]="clipRect()!.height"
        aria-hidden="true"
      >
        <rect
          x="1" y="1"
          [attr.width]="max0(clipRect()!.width - 2)"
          [attr.height]="max0(clipRect()!.height - 2)"
          fill="none"
          stroke="var(--ogrid-selection-color, #217346)"
          stroke-width="2"
          stroke-dasharray="4 4"
          style="animation: ogrid-marching-ants 0.5s linear infinite"
        />
      </svg>
    }
  `,
})
export class MarchingAntsOverlayComponent implements OnChanges {
  private destroyRef = inject(DestroyRef);

  @Input({ required: true }) containerEl!: HTMLElement | null;
  @Input() selectionRange: ISelectionRange | null = null;
  @Input() copyRange: ISelectionRange | null = null;
  @Input() cutRange: ISelectionRange | null = null;
  @Input() colOffset: number = 0;
  @Input() columnSizingVersion: number = 0;
  @Input() items: readonly unknown[] = [];
  @Input() visibleColumns: readonly string[] | undefined = undefined;
  @Input() columnOrder: readonly string[] | undefined = undefined;

  readonly selRect = signal<OverlayRect | null>(null);
  readonly clipRect = signal<OverlayRect | null>(null);

  private rafId = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    injectGlobalStyles('ogrid-marching-ants-keyframes', '@keyframes ogrid-marching-ants{to{stroke-dashoffset:-8}}');

    this.destroyRef.onDestroy(() => {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.resizeObserver) this.resizeObserver.disconnect();
    });
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.recalculate();
  }

  private recalculate(): void {
    const container = this.containerEl;
    const selRange = this.selectionRange;
    const clipRange = this.copyRange ?? this.cutRange;
    const colOff = this.colOffset;
    void this.columnSizingVersion; // Track column resize changes
    void this.items; // Track data changes (sorting)
    void this.visibleColumns; // Track column visibility changes
    void this.columnOrder; // Track column reordering

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (!selRange && !clipRange) {
      this.selRect.set(null);
      this.clipRect.set(null);
      return;
    }

    const measureAll = () => {
      if (!container) {
        this.selRect.set(null);
        this.clipRect.set(null);
        return;
      }
      this.selRect.set(selRange ? measureRange(container, selRange, colOff) : null);
      this.clipRect.set(clipRange ? measureRange(container, clipRange, colOff) : null);
    };

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(measureAll);

    if (container) {
      this.resizeObserver = new ResizeObserver(measureAll);
      this.resizeObserver.observe(container);
    }
  }

  isSingleCellSelection(): boolean {
    const r = this.selectionRange;
    return r != null && r.startRow === r.endRow && r.startCol === r.endCol;
  }

  clipRangeMatchesSel(): boolean {
    const selRange = this.selectionRange;
    const clipRange = this.copyRange ?? this.cutRange;
    return selRange != null && clipRange != null &&
      selRange.startRow === clipRange.startRow &&
      selRange.startCol === clipRange.startCol &&
      selRange.endRow === clipRange.endRow &&
      selRange.endCol === clipRange.endCol;
  }

  max0(n: number): number {
    return Math.max(0, n);
  }
}
