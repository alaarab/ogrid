import { getStatusBarParts } from '@alaarab/ogrid-core';
import type { IStatusBarProps } from '@alaarab/ogrid-core';

export class StatusBar<T> {
  private container: HTMLElement;
  private el: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(props: IStatusBarProps): void {
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
