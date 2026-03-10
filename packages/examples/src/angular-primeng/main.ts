import '@angular/compiler';
import 'primeicons/primeicons.css';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnInit, OnDestroy, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { OGridComponent } from '@alaarab/ogrid-angular-primeng';
import type { IOGridProps } from '@alaarab/ogrid-angular-primeng';
import { makeDemoProjects, makeDemoColumns, getRowId, handleCellValueChanged } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle } from '../shared/themeToggle';
import { shouldEnableCellReferences } from '../shared/queryFlags';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import type { BridgeConnection } from '@alaarab/ogrid-mcp/bridge-client';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();
const enableCellReferences = typeof window !== 'undefined'
  && shouldEnableCellReferences(window.location.search);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OGridComponent],
  template: `
    <div class="app-container">
      <h1>OGrid - Angular PrimeNG Example</h1>
      <p class="app-subtitle">
        A fully featured data table powered by <code>@alaarab/ogrid-angular-primeng</code>.
        Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
      </p>
      <div style="flex: 1; min-height: 0;">
        <ogrid-primeng [props]="gridProps" />
      </div>
    </div>
  `,
  styles: [`
    .app-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--ogrid-bg, #fff);
      color: var(--ogrid-fg, rgba(0,0,0,0.87));
    }
    .app-subtitle {
      color: var(--ogrid-fg-secondary, #666);
      margin-bottom: 16px;
    }
    :host {
      display: block;
    }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  private bridge: BridgeConnection | null = null;
  private data = projects;
  private pinnedColumns: Record<string, 'left' | 'right'> = {};

  gridProps: IOGridProps<Project> = {
    data: projects,
    columns: columns,
    getRowId: getRowId,
    entityLabelPlural: 'projects',
    defaultPageSize: 25,
    editable: true,
    cellSelection: true,
    cellReferences: enableCellReferences,
    pinnedColumns: this.pinnedColumns,
    statusBar: true,
    onCellValueChanged: (e) => handleCellValueChanged(projects, e),
    onColumnPinned: (columnId, pinned) => this.handleColumnPinned(columnId, pinned),
  };

  private handleColumnPinned(columnId: string, pinned: 'left' | 'right' | null) {
    if (pinned) {
      this.pinnedColumns = { ...this.pinnedColumns, [columnId]: pinned };
    } else {
      const { [columnId]: _, ...next } = this.pinnedColumns;
      this.pinnedColumns = next;
    }
    this.gridProps = { ...this.gridProps, pinnedColumns: this.pinnedColumns };
  }

  ngOnInit() {
    this.bridge = connectGridToBridge({
      gridId: 'angular-primeng-demo',
      getData: () => this.data,
      getColumns: () => columns.map((c) => ({
        columnId: c.columnId,
        headerName: c.name ?? c.columnId,
        type: c.type,
      })),
      getSort: () => [],
      getFilters: () => ({}),
      onCellUpdate: (rowIndex, columnId, value) => {
        if (this.data[rowIndex]) {
          (this.data[rowIndex] as Record<string, unknown>)[columnId] = value;
        }
      },
    });
  }

  ngOnDestroy() {
    this.bridge?.disconnect();
  }
}

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection(), provideAnimations()],
}).then(() => {
  createThemeToggle();
}).catch((err) => console.error(err));
