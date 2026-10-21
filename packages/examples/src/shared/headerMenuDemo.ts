import type { GridMenuItems, IColumnMenuContext, IHeaderMenuContext } from '@alaarab/ogrid-react';

/** `?headerMenu`: the header corner menu instead of a toolbar row, with app items. */
export function isHeaderMenuDemo(search: string): boolean {
  return new URLSearchParams(search).has('headerMenu');
}

function download(name: string, type: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]): string {
  const keys = Object.keys(rows[0] ?? {});
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => cell(r[k])).join(','))].join('\n');
}

/** One custom item and one nested submenu in the corner menu. */
export function makeHeaderMenuItems(getRows: () => Record<string, unknown>[]): GridMenuItems<IHeaderMenuContext> {
  return [
    {
      id: 'export',
      label: 'Export',
      items: [
        { id: 'exportCsv', label: 'CSV', onClick: () => download('projects.csv', 'text/csv', toCsv(getRows())) },
        { id: 'exportJson', label: 'JSON', onClick: () => download('projects.json', 'application/json', JSON.stringify(getRows(), null, 2)) },
      ],
    },
    {
      id: 'copyLink',
      label: 'Copy link to this view',
      onClick: () => { void navigator.clipboard?.writeText(window.location.href); },
    },
  ];
}

/** A custom column item, with "Autosize this column" moved to the top. */
export const columnMenuItems: GridMenuItems<IColumnMenuContext> = (builtIns, { columnId }) => {
  const autosize = builtIns.find((item) => item.id === 'autosizeThis');
  const rest = builtIns.filter((item) => item.id !== 'autosizeThis');
  return [
    ...(autosize ? [{ ...autosize, divider: true }] : []),
    ...rest,
    { id: 'copyColumnId', label: 'Copy column id', onClick: () => { void navigator.clipboard?.writeText(columnId); } },
  ];
};
