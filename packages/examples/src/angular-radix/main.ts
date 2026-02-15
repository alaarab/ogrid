import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { OGridComponent } from '@alaarab/ogrid-angular-radix';
import type { IOGridProps } from '@alaarab/ogrid-angular-radix';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OGridComponent],
  template: `
    <div style="padding: 24px; max-width: 1200px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column;">
      <h1>OGrid - Angular Radix Example</h1>
      <p style="color: #666; margin-bottom: 16px;">
        A fully featured data table powered by <code>@alaarab/ogrid-angular-radix</code>.
        Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
      </p>
      <div style="flex: 1; min-height: 0;">
        <ogrid [props]="gridProps" />
      </div>
    </div>
  `,
})
export class AppComponent {
  gridProps: IOGridProps<Project> = {
    data: projects,
    columns: columns,
    getRowId: getRowId,
    entityLabelPlural: 'projects',
    defaultPageSize: 25,
  };
}

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
}).catch((err) => console.error(err));
