import { injectGlobalStyles, measureRange as measureRangeCore, type ISelectionRange, type OverlayRect } from '@alaarab/ogrid-core';

/**
 * Measure the bounding rect of a range within a container, with scroll offsets.
 * This variant adds scroll offsets for the JS implementation's scrollable container.
 */
function measureRange(
  container: HTMLElement,
  range: ISelectionRange,
  colOffset: number
): OverlayRect | null {
  const rect = measureRangeCore(container, range, colOffset);
  if (!rect) return null;

  // Add scroll offsets for JS implementation's scrollable container
  return {
    top: rect.top + container.scrollTop,
    left: rect.left + container.scrollLeft,
    width: rect.width,
    height: rect.height,
  };
}

function rangesEqual(a: ISelectionRange | null, b: ISelectionRange | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.startRow === b.startRow && a.endRow === b.endRow &&
         a.startCol === b.startCol && a.endCol === b.endCol;
}

/**
 * MarchingAntsOverlay — renders SVG overlays on top of the grid:
 * 1. Selection range: solid green border
 * 2. Copy/Cut range: animated dashed border (marching ants)
 *
 * Vanilla JS equivalent of React's MarchingAntsOverlay component.
 */
export class MarchingAntsOverlay {
  private container: HTMLElement;
  private colOffset: number;
  private selSvg: SVGSVGElement | null = null;
  private clipSvg: SVGSVGElement | null = null;
  private selectionRange: ISelectionRange | null = null;
  private copyRange: ISelectionRange | null = null;
  private cutRange: ISelectionRange | null = null;
  private rafHandle = 0;
  private layoutVersion = 0; // Tracks layout changes to force re-measurement

  constructor(container: HTMLElement, colOffset = 0) {
    this.container = container;
    this.colOffset = colOffset;
    injectGlobalStyles('ogrid-marching-ants-keyframes', '@keyframes ogrid-marching-ants{to{stroke-dashoffset:-8}}');

    // The container must be positioned for absolute SVGs
    const pos = getComputedStyle(container).position;
    if (pos === 'static' || pos === '') {
      container.style.position = 'relative';
    }
  }

  update(
    selectionRange: ISelectionRange | null,
    copyRange: ISelectionRange | null,
    cutRange: ISelectionRange | null,
    layoutVersion?: number
  ): void {
    // Track layout changes separately from range changes
    const layoutChanged = layoutVersion !== undefined && layoutVersion !== this.layoutVersion;
    if (layoutChanged && layoutVersion !== undefined) {
      this.layoutVersion = layoutVersion;
    }

    // Skip if nothing changed (ranges or layout)
    if (
      !layoutChanged &&
      rangesEqual(this.selectionRange, selectionRange) &&
      rangesEqual(this.copyRange, copyRange) &&
      rangesEqual(this.cutRange, cutRange)
    ) {
      return;
    }

    this.selectionRange = selectionRange;
    this.copyRange = copyRange;
    this.cutRange = cutRange;

    // Delay one frame so cells are rendered
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = 0;
      this.render();
    });
  }

  private render(): void {
    const clipRange = this.copyRange ?? this.cutRange;

    // Selection range SVG
    const selRect = this.selectionRange
      ? measureRange(this.container, this.selectionRange, this.colOffset)
      : null;

    // When clipboard range matches selection, hide selection border so marching ants show
    const clipRangeMatchesSel =
      this.selectionRange != null &&
      clipRange != null &&
      rangesEqual(this.selectionRange, clipRange);

    if (selRect && !clipRangeMatchesSel) {
      if (!this.selSvg) {
        this.selSvg = this.createSvg(4);
        this.container.appendChild(this.selSvg);
      }
      this.positionSvg(this.selSvg, selRect);
      const rect = this.selSvg.querySelector('rect');
      if (rect) {
        rect.setAttribute('width', String(Math.max(0, selRect.width - 2)));
        rect.setAttribute('height', String(Math.max(0, selRect.height - 2)));
        rect.setAttribute('stroke', 'var(--ogrid-selection, #217346)');
        rect.setAttribute('stroke-width', '2');
        rect.removeAttribute('stroke-dasharray');
        rect.style.animation = '';
      }
    } else {
      this.removeSvg('sel');
    }

    // Copy/Cut range SVG (marching ants)
    const clipRect = clipRange
      ? measureRange(this.container, clipRange, this.colOffset)
      : null;

    if (clipRect) {
      if (!this.clipSvg) {
        this.clipSvg = this.createSvg(5);
        this.container.appendChild(this.clipSvg);
      }
      this.positionSvg(this.clipSvg, clipRect);
      const rect = this.clipSvg.querySelector('rect');
      if (rect) {
        rect.setAttribute('width', String(Math.max(0, clipRect.width - 2)));
        rect.setAttribute('height', String(Math.max(0, clipRect.height - 2)));
        rect.setAttribute('stroke', 'var(--ogrid-selection, #217346)');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('stroke-dasharray', '4 4');
        rect.style.animation = 'ogrid-marching-ants 0.5s linear infinite';
      }
    } else {
      this.removeSvg('clip');
    }
  }

  private createSvg(zIndex: number): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = String(zIndex);
    svg.style.overflow = 'visible';

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '1');
    rect.setAttribute('y', '1');
    rect.setAttribute('fill', 'none');
    svg.appendChild(rect);

    return svg;
  }

  private positionSvg(svg: SVGSVGElement, rect: OverlayRect): void {
    svg.style.top = `${rect.top}px`;
    svg.style.left = `${rect.left}px`;
    svg.style.width = `${rect.width}px`;
    svg.style.height = `${rect.height}px`;
  }

  private removeSvg(which: 'sel' | 'clip'): void {
    if (which === 'sel' && this.selSvg) {
      this.selSvg.remove();
      this.selSvg = null;
    } else if (which === 'clip' && this.clipSvg) {
      this.clipSvg.remove();
      this.clipSvg = null;
    }
  }

  destroy(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.removeSvg('sel');
    this.removeSvg('clip');
  }
}
