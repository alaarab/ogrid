import { processClientSideData } from '@alaarab/ogrid-core';
import type {
  IDataSource,
  IPageResult,
  IFetchParams,
  IColumnDef,
  RowSelectionMode,
} from '@alaarab/ogrid-core';
import { DEMO_PROJECT_COUNT } from './demoConfig';
import { makeDemoColumns, makeDemoProjects } from './demoData';
import type { Project } from './demoData';
import type { ExampleFeatureFlags } from './queryFlags';

const SERVER_DELAY_MS = 25;
const FORMULA_BUDGET_COLUMN_INDEX = 4;

export interface ProjectExampleScenario {
  columns: IColumnDef<Project>[];
  data: Project[];
  dataSource?: IDataSource<Project>;
  formulas: boolean;
  initialFormulas?: Array<{ col: number; row: number; formula: string }>;
  rowSelection: RowSelectionMode;
  serverSide: boolean;
}

function createAbortError(): Error {
  try {
    return new DOMException('The operation was aborted.', 'AbortError');
  } catch {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
  }
}

function waitForServerTick(signal?: AbortSignal, ms = SERVER_DELAY_MS): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function getStringFilterOptions(items: Project[], field: string): string[] {
  const values = items
    .map((item) => item[field as keyof Project])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function createProjectDataSource(
  items: Project[],
  columns: IColumnDef<Project>[],
): IDataSource<Project> {
  return {
    async fetchPage(params: IFetchParams): Promise<IPageResult<Project>> {
      await waitForServerTick(params.signal);

      const processed = processClientSideData(
        items,
        columns,
        params.filters,
        params.sort?.field,
        params.sort?.direction,
      );
      const start = (params.page - 1) * params.pageSize;

      return {
        items: processed.slice(start, start + params.pageSize),
        totalCount: processed.length,
      };
    },
    async fetchFilterOptions(field: string): Promise<string[]> {
      await waitForServerTick(undefined, 10);
      return getStringFilterOptions(items, field);
    },
  };
}

export function createProjectExampleScenario(
  flags: ExampleFeatureFlags,
): ProjectExampleScenario {
  const data = makeDemoProjects(DEMO_PROJECT_COUNT);
  const columns = makeDemoColumns<Project>({ formulaMode: flags.formulas });
  const initialFormulas = flags.formulas
    ? [{ col: FORMULA_BUDGET_COLUMN_INDEX, row: 0, formula: '=20+20' }]
    : undefined;

  return {
    columns,
    data,
    dataSource: flags.serverSide ? createProjectDataSource(data, columns) : undefined,
    formulas: flags.formulas,
    initialFormulas,
    rowSelection: flags.rowSelection ? 'multiple' : 'none',
    serverSide: flags.serverSide,
  };
}
