/**
 * FormulaRefOverlayComponent -- Renders colored border overlays on cells
 * referenced by the active formula, like Excel's reference highlighting.
 *
 * Port of React's FormulaRefOverlay component.
 */

import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  input,
  signal,
  effect,
} from '@angular/core';
import { FORMULA_REF_COLORS, type FormulaReference } from '@alaarab/ogrid-core/formula';

interface RefRect {
  top: number;
  left: number;
  width: number;
  height: number;
  color: string;
}

function measureRef(
  container: HTMLElement,
  ref: FormulaReference,
  colOffset: number,
): RefRect | null {
  const startCol = ref.col + colOffset;
  const endCol = (ref.endCol ?? ref.col) + colOffset;
  const endRow = ref.endRow ?? ref.row;

  const tl = container.querySelector(
    `[data-row-index="${ref.row}"][data-col-index="${startCol}"]`
  ) as HTMLElement | null;
  const br = container.querySelector(
    `[data-row-index="${endRow}"][data-col-index="${endCol}"]`
  ) as HTMLElement | null;

  if (!tl || !br) return null;

  const cRect = container.getBoundingClientRect();
  const tlRect = tl.getBoundingClientRect();
  const brRect = br.getBoundingClientRect();

  return {
    top: Math.round(tlRect.top - cRect.top),
    left: Math.round(tlRect.left - cRect.left),
    width: Math.round(brRect.right - tlRect.left),
    height: Math.round(brRect.bottom - tlRect.top),
    color: FORMULA_REF_COLORS[ref.colorIndex % FORMULA_REF_COLORS.length],
  };
}

@Component({
  selector: 'ogrid-formula-ref-overlay',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (r of rects(); track $index) {
      <svg
        [style.position]="'absolute'"
        [style.top.px]="r.top"
        [style.left.px]="r.left"
        [style.width.px]="r.width"
        [style.height.px]="r.height"
        [style.pointerEvents]="'none'"
        [style.zIndex]="3"
        [style.overflow]="'visible'"
        aria-hidden="true"
      >
        <rect
          x="1" y="1"
          [attr.width]="max0(r.width - 2)"
          [attr.height]="max0(r.height - 2)"
          fill="none"
          [attr.stroke]="r.color"
          stroke-width="2"
          style="shape-rendering: crispEdges"
        />
      </svg>
    }
  `,
})
export class FormulaRefOverlayComponent {
  /** The positioned container that wraps the table. */
  readonly containerEl = input<HTMLElement | null>(null);
  /** References to highlight. */
  readonly references = input<FormulaReference[]>([]);
  /** Column offset (1 when checkbox/row-number columns are present). */
  readonly colOffset = input<number>(0);

  readonly rects = signal<RefRect[]>([]);

  private rafId = 0;

  constructor() {
    effect(() => {
      const refs = this.references();
      const container = this.containerEl();
      const colOff = this.colOffset();

      cancelAnimationFrame(this.rafId);

      if (!container || refs.length === 0) {
        this.rects.set([]);
        return;
      }

      this.rafId = requestAnimationFrame(() => {
        const measured: RefRect[] = [];
        for (const ref of refs) {
          const r = measureRef(container, ref, colOff);
          if (r) measured.push(r);
        }
        this.rects.set(measured);
      });
    });
  }

  max0(v: number): number {
    return Math.max(0, v);
  }
}
