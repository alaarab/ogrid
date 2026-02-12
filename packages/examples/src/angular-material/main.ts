import { bootstrapApplication } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { OGridComponent } from '@alaarab/ogrid-angular-material';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';

const projects = makeDemoProjects(75);
const columns = makeDemoColumns<Project>();

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OGridComponent],
  template: `
    <div style="padding: 24px; max-width: 1200px; margin: 0 auto;">
      <h1>OGrid - Angular Material Example</h1>
      <p style="color: #666; margin-bottom: 16px;">
        A fully featured data table powered by <code>@alaarab/ogrid-angular-material</code>.
        Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
      </p>
      <ogrid
        [data]="projects"
        [columns]="columns"
        [getRowId]="getRowId"
        entityLabelPlural="projects"
        [defaultPageSize]="25"
      />
    </div>
  `,
})
export class AppComponent {
  projects = projects;
  columns = columns;
  getRowId = getRowId;
}

bootstrapApplication(AppComponent, {
  providers: [provideAnimations()],
}).catch((err) => console.error(err));
