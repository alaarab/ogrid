import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { OGridComponent } from '@alaarab/ogrid-angular-radix';
import type { IOGridProps } from '@alaarab/ogrid-angular-radix';
import { makeDemoProjects, makeDemoColumns, getRowId, handleCellValueChanged } from '../shared/demoData';
import type { Project } from '../shared/demoData';
import { createThemeToggle } from '../shared/themeToggle';

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
export class AppComponent {
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
}

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
}).then(() => {
  createThemeToggle();
}).catch((err) => console.error(err));
