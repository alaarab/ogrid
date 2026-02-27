import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnInit, OnDestroy, provideZonelessChangeDetection } from '@angular/core';
import { OGridComponent } from '@alaarab/ogrid-angular-radix';
import type { IOGridProps } from '@alaarab/ogrid-angular-radix';
import { makeDemoProjects, makeDemoColumns, getRowId, handleCellValueChanged } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle } from '../shared/themeToggle';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import type { BridgeConnection } from '@alaarab/ogrid-mcp/bridge-client';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OGridComponent],
  template: `
    <div class="app-container">
      <h1>OGrid - Angular Radix Example</h1>
      <p class="app-subtitle">
        A fully featured data table powered by <code>@alaarab/ogrid-angular-radix</code>.
        Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
      </p>
      <div style="flex: 1; min-height: 0;">
        <ogrid [props]="gridProps" />
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

  gridProps: IOGridProps<Project> = {
    data: projects,
    columns: columns,
    getRowId: getRowId,
    entityLabelPlural: 'projects',
    defaultPageSize: 25,
    editable: true,
    cellSelection: true,
    statusBar: true,
    onCellValueChanged: (e) => handleCellValueChanged(projects, e),
  };

  ngOnInit() {
    this.bridge = connectGridToBridge({
      gridId: 'angular-radix-demo',
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
  providers: [provideZonelessChangeDetection()],
}).then(() => {
  createThemeToggle();
}).catch((err) => console.error(err));
