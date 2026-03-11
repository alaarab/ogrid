import '@angular/compiler';
import 'primeicons/primeicons.css';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnInit, OnDestroy, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { OGridComponent } from '@alaarab/ogrid-angular-primeng';
import type { IOGridProps } from '@alaarab/ogrid-angular-primeng';
import {
  DatePickerEditorComponent,
  RatingEditorComponent,
  ColorPickerEditorComponent,
  SliderEditorComponent,
  TagsEditorComponent,
} from '@alaarab/ogrid-angular-inputs';
import { handleCellValueChanged } from '../shared/demoData';
import { createThemeToggle } from '../shared/themeToggle';
import { createProjectExampleScenario } from '../shared/demoScenario';
import { getExampleFeatureFlags } from '../shared/queryFlags';
import { makePremiumInputColumns, makePremiumInputRows } from '../shared/premiumInputsData';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import type { BridgeConnection } from '@alaarab/ogrid-mcp/bridge-client';
import {
  coerceExampleColumns,
  coerceExampleDataSource,
  coerceExampleRows,
  type ExampleRow,
} from '../shared/exampleTypes';

const featureFlags = getExampleFeatureFlags(typeof window !== 'undefined' ? window.location.search : '');
const projectScenario = createProjectExampleScenario(featureFlags);
const isPremiumExample = featureFlags.premiumInputs;
const initialRows = coerceExampleRows(isPremiumExample
  ? makePremiumInputRows()
  : projectScenario.data);
const columns = coerceExampleColumns(isPremiumExample
  ? makePremiumInputColumns({
    dateEditor: DatePickerEditorComponent,
    ratingEditor: RatingEditorComponent,
    colorEditor: ColorPickerEditorComponent,
    sliderEditor: SliderEditorComponent,
    tagsEditor: TagsEditorComponent,
  })
  : projectScenario.columns);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    OGridComponent,
    DatePickerEditorComponent,
    RatingEditorComponent,
    ColorPickerEditorComponent,
    SliderEditorComponent,
    TagsEditorComponent,
  ],
  template: `
    <div class="app-container">
      <h1>OGrid - Angular PrimeNG Example</h1>
      <p class="app-subtitle">{{ subtitle }}</p>
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
  private data = initialRows;

  readonly subtitle = isPremiumExample
    ? 'Premium editor parity mode powered by @alaarab/ogrid-angular-inputs.'
    : 'A fully featured data table powered by @alaarab/ogrid-angular-primeng. Includes sorting, multi-select text filtering, column chooser, and pagination.';

  gridProps: IOGridProps<ExampleRow> = {
    ...(!isPremiumExample && projectScenario.serverSide ? { dataSource: coerceExampleDataSource(projectScenario.dataSource!) } : { data: this.data }),
    columns: columns as unknown as IOGridProps<ExampleRow>['columns'],
    getRowId: (row) => row.id,
    entityLabelPlural: isPremiumExample ? 'products' : 'projects',
    defaultPageSize: isPremiumExample ? 10 : projectScenario.defaultPageSize,
    editable: isPremiumExample || !projectScenario.serverSide,
    cellSelection: true,
    cellReferences: isPremiumExample ? undefined : projectScenario.cellReferences,
    rowSelection: isPremiumExample ? undefined : projectScenario.rowSelection,
    formulas: isPremiumExample ? undefined : projectScenario.formulas,
    initialFormulas: isPremiumExample ? undefined : projectScenario.initialFormulas,
    sideBar: isPremiumExample ? undefined : projectScenario.sideBar,
    fullScreen: isPremiumExample ? undefined : projectScenario.fullScreen,
    responsiveColumns: isPremiumExample ? undefined : projectScenario.responsiveColumns,
    density: isPremiumExample ? undefined : projectScenario.density,
    statusBar: true,
    onCellValueChanged: (event) => handleCellValueChanged(this.data, event as { item: ExampleRow; columnId: string; newValue: unknown }),
  };

  ngOnInit() {
    this.bridge = connectGridToBridge({
      gridId: 'angular-primeng-demo',
      getData: () => this.data,
      getColumns: () => columns.flatMap((column) => (
        'columnId' in column
          ? [{ columnId: column.columnId, headerName: column.name ?? column.columnId, type: column.type }]
          : []
      )),
      getSort: () => [],
      getFilters: () => ({}),
      onCellUpdate: (rowIndex, columnId, value) => {
        if (!this.data[rowIndex]) return;
        (this.data[rowIndex] as Record<string, unknown>)[columnId] = value;
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
