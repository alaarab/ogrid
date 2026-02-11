import type { OGridOptions, OGridEvents } from './types/gridTypes';
import type { IOGridApi } from '@alaarab/ogrid-core';
import { GridState } from './state/GridState';
import { TableRenderer } from './renderer/TableRenderer';
import { PaginationControls } from './components/PaginationControls';
import { StatusBar } from './components/StatusBar';
import { ColumnChooser } from './components/ColumnChooser';
import { EventEmitter } from './state/EventEmitter';

export class OGrid<T> {
  private state: GridState<T>;
  private renderer: TableRenderer<T>;
  private pagination: PaginationControls<T>;
  private statusBar: StatusBar<T>;
  private columnChooser: ColumnChooser<T>;
  private events = new EventEmitter<OGridEvents<T>>();
  private unsubscribe: () => void;
  private containerEl: HTMLElement;
  private tableContainer: HTMLElement;
  private toolbarEl: HTMLElement;
  private paginationContainer: HTMLElement;
  private statusBarContainer: HTMLElement;

  /** The imperative grid API (same interface as React's IOGridApi). */
  readonly api: IOGridApi<T>;

  constructor(container: HTMLElement, options: OGridOptions<T>) {
    this.state = new GridState<T>(options);
    this.api = this.state.getApi();

    // Build layout
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'ogrid-container';

    // Toolbar
    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'ogrid-toolbar';
    this.containerEl.appendChild(this.toolbarEl);

    // Table container
    this.tableContainer = document.createElement('div');
    this.tableContainer.className = 'ogrid-table-container';
    this.containerEl.appendChild(this.tableContainer);

    // Status bar container
    this.statusBarContainer = document.createElement('div');
    this.statusBarContainer.className = 'ogrid-status-bar-container';
    this.containerEl.appendChild(this.statusBarContainer);

    // Pagination container
    this.paginationContainer = document.createElement('div');
    this.paginationContainer.className = 'ogrid-pagination-container';
    this.containerEl.appendChild(this.paginationContainer);

    container.appendChild(this.containerEl);

    // Create sub-components
    this.renderer = new TableRenderer<T>(this.tableContainer, this.state);
    this.pagination = new PaginationControls<T>(this.paginationContainer, this.state);
    this.statusBar = new StatusBar<T>(this.statusBarContainer);
    this.columnChooser = new ColumnChooser<T>(this.toolbarEl, this.state);

    // Subscribe to state changes
    this.unsubscribe = this.state.onStateChange(() => {
      this.renderAll();
    });

    // Initial render
    this.renderAll();
  }

  private renderAll(): void {
    this.renderer.update();
    const { totalCount } = this.state.getProcessedItems();
    this.pagination.render(totalCount);
    this.statusBar.render({ totalCount });
    this.columnChooser.render();
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
    this.pagination.destroy();
    this.statusBar.destroy();
    this.columnChooser.destroy();
    this.state.destroy();
    this.events.removeAllListeners();
    this.containerEl.remove();
  }
}
