import { getStatusBarParts } from '@alaarab/ogrid-core';
import type { IStatusBarProps, StatusBarPartsInput } from '@alaarab/ogrid-core';

type JSStatusBarProps = IStatusBarProps & Pick<StatusBarPartsInput, 'selectedCellCount'>;

export class StatusBar {
  private container: HTMLElement;
  private el: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(props: JSStatusBarProps): void {
    if (this.el) this.el.remove();

    const parts = getStatusBarParts(props);
    if (parts.length === 0 && !props.aggregation) return;

    this.el = document.createElement('div');
    this.el.className = 'ogrid-status-bar';

    for (const part of parts) {
      const span = document.createElement('span');
      span.className = 'ogrid-status-part';
      span.textContent = `${part.label}: ${part.value}`;
      this.el.appendChild(span);
    }

    if (props.aggregation) {
      const agg = props.aggregation;
      const aggSpan = document.createElement('span');
      aggSpan.className = 'ogrid-status-aggregation';
      aggSpan.textContent = `Sum: ${agg.sum.toLocaleString()} | Avg: ${agg.avg.toFixed(2)} | Min: ${agg.min} | Max: ${agg.max} | Count: ${agg.count}`;
      this.el.appendChild(aggSpan);
    }

    this.container.appendChild(this.el);
  }

  destroy(): void {
    this.el?.remove();
    this.el = null;
  }
}
