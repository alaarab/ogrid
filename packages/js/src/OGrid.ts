import type { OGridOptions, OGridEvents } from './types/gridTypes';
import type { IOGridApi } from '@alaarab/ogrid-core';
import { GridState } from './state/GridState';
import { TableRenderer } from './renderer/TableRenderer';
import { EventEmitter } from './state/EventEmitter';

export class OGrid<T> {
  private state: GridState<T>;
  private renderer: TableRenderer<T>;
  private events = new EventEmitter<OGridEvents<T>>();
  private unsubscribe: () => void;

  /** The imperative grid API (same interface as React's IOGridApi). */
  readonly api: IOGridApi<T>;

  constructor(container: HTMLElement, options: OGridOptions<T>) {
    this.state = new GridState<T>(options);
    this.renderer = new TableRenderer<T>(container, this.state);
    this.api = this.state.getApi();

    // Subscribe to state changes and re-render
    this.unsubscribe = this.state.onStateChange(() => {
      this.renderer.update();
    });

    // Initial render
    this.renderer.render();
  }

  /** Subscribe to grid events. */
  on<K extends keyof OGridEvents<T>>(event: K, handler: (data: OGridEvents<T>[K]) => void): void {
    this.events.on(event, handler);
  }

  /** Unsubscribe from grid events. */
  off<K extends keyof OGridEvents<T>>(event: K, handler: (data: OGridEvents<T>[K]) => void): void {
    this.events.off(event, handler);
  }

  /** Clean up all event listeners and DOM. */
  destroy(): void {
    this.unsubscribe();
    this.renderer.destroy();
    this.state.destroy();
    this.events.removeAllListeners();
  }
}
