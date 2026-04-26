import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  useHeadlessGrid,
  useInlineEdit,
  useRangeSelection,
  useFillHandle,
  useCellClipboard,
  useUndoRedo,
  useGridFocus,
} from '../index';
import type { IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-react';

/**
 * THE canonical spreadsheet demo — combines all 6 headless hooks on a plain
 * shadcn-style table. Real data, real interactivity. This is the demo
 * referenced from the README, the docs site, and the v2.9.0 release notes.
 *
 * Combines:
 *   - useHeadlessGrid     — sort, filter, paginate, row selection
 *   - useInlineEdit       — double-click to edit, Enter commits, Escape cancels
 *   - useRangeSelection   — click-drag to select range, Shift+Arrow to extend
 *   - useFillHandle       — drag bottom-right corner to fill range
 *   - useCellClipboard    — Cmd/Ctrl+C, Cmd/Ctrl+X, Cmd/Ctrl+V
 *   - useUndoRedo         — Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z
 *   - useGridFocus        — Arrow keys, Tab, Enter, Home, End, PageUp, PageDown
 *
 * ~200 lines of glue code on a plain HTML table — copy as a starter
 * template, swap in your favorite chrome (shadcn, Material, Fluent).
 */

interface Employee {
  id: string;
  name: string;
  department: string;
  salary: number;
  active: boolean;
}

const initialEmployees: Employee[] = [
  { id: 'e1', name: 'Alice Chen', department: 'Engineering', salary: 145000, active: true },
  { id: 'e2', name: 'Bob Smith', department: 'Sales', salary: 95000, active: true },
  { id: 'e3', name: 'Carol Diaz', department: 'Engineering', salary: 130000, active: false },
  { id: 'e4', name: 'Dan Lee', department: 'Marketing', salary: 88000, active: true },
  { id: 'e5', name: 'Eve Patel', department: 'Engineering', salary: 165000, active: true },
  { id: 'e6', name: 'Frank Ho', department: 'Sales', salary: 102000, active: false },
  { id: 'e7', name: 'Grace Yu', department: 'Marketing', salary: 91000, active: true },
  { id: 'e8', name: 'Hank Wong', department: 'Engineering', salary: 155000, active: true },
];

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', type: 'text', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', type: 'text', sortable: true, editable: true },
  {
    columnId: 'salary',
    name: 'Salary',
    type: 'numeric',
    sortable: true,
    editable: true,
    valueParser: ({ newValue }) => {
      const n = Number(newValue);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    },
    valueFormatter: (v) =>
      typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? ''),
  },
  { columnId: 'active', name: 'Active', type: 'boolean', sortable: true, editable: false },
];

const getRowId = (e: Employee) => e.id;

function SpreadsheetDemo() {
  const [employees, setEmployees] = React.useState(initialEmployees);

  const grid = useHeadlessGrid({
    columns,
    data: employees,
    getRowId,
    initialSort: { field: 'name', direction: 'asc' },
    initialPageSize: 50,
  });

  const range = useRangeSelection({
    rowCount: grid.rows.length,
    colCount: grid.columns.length,
  });

  const focus = useGridFocus({
    rowCount: grid.rows.length,
    colCount: grid.columns.length,
    rangeSelection: range,
  });

  const applyEdit = React.useCallback(
    (event: ICellValueChangedEvent<Employee>) => {
      setEmployees((prev) =>
        prev.map((row) =>
          row.id === event.item.id
            ? { ...row, [event.columnId]: event.newValue }
            : row,
        ),
      );
    },
    [],
  );

  const undo = useUndoRedo<Employee>({ onCellValueChanged: applyEdit });
  const wrappedEdit = undo.onCellValueChanged ?? applyEdit;

  const edit = useInlineEdit({
    columns,
    getRowId,
    onCellEdit: (event) => wrappedEdit(event as ICellValueChangedEvent<Employee>),
  });

  const fill = useFillHandle({
    rangeSelection: range,
    rows: grid.rows,
    columns,
    onFillCells: (events) => events.forEach(wrappedEdit),
  });

  const clipboard = useCellClipboard({
    rangeSelection: range,
    rows: grid.rows,
    columns,
    onCellEdit: (events) => events.forEach(wrappedEdit),
  });

  // Wire global keyboard shortcuts: copy/cut/paste, undo/redo.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      // Don't hijack while typing into the inline editor.
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (e.key === 'c') { e.preventDefault(); clipboard.copyRange(); }
      else if (e.key === 'x') { e.preventDefault(); clipboard.cutRange(); }
      else if (e.key === 'v') { e.preventDefault(); clipboard.pasteRange(); }
      else if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo.undo(); }
      else if (e.key === 'z' && e.shiftKey) { e.preventDefault(); undo.redo(); }
      else if (e.key === 'a') {
        e.preventDefault();
        range.selectAll();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [clipboard, undo, range]);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <h3 style={{ marginTop: 0, fontSize: 16 }}>Full Spreadsheet Demo</h3>
      <p style={{ fontSize: 13, color: '#666', maxWidth: 720 }}>
        All six headless hooks combined on a plain HTML table. Double-click to edit
        Name / Department / Salary. Click + drag to select a range. Drag the
        fill-handle dot at the bottom-right to fill. Cmd/Ctrl+C/X/V to copy / cut /
        paste. Cmd/Ctrl+Z to undo, Shift+Cmd/Ctrl+Z to redo. Arrow / Tab /
        Enter / Home / End / PageUp / PageDown for navigation.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13 }}>
        <button onClick={() => undo.undo()} disabled={!undo.canUndo}>
          ↶ Undo
        </button>
        <button onClick={() => undo.redo()} disabled={!undo.canRedo}>
          ↷ Redo
        </button>
        <span style={{ marginLeft: 'auto', color: '#666' }}>
          {range.range
            ? `Range: rows ${range.range.startRow + 1}-${range.range.endRow + 1}, cols ${range.range.startCol + 1}-${range.range.endCol + 1}`
            : 'No selection'}
        </span>
      </div>

      <div
        tabIndex={0}
        onKeyDown={focus.getKeyDownHandler()}
        style={{
          borderRadius: 6,
          border: '1px solid hsl(0 0% 90%)',
          overflow: 'hidden',
          background: 'white',
          outline: 'none',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead style={{ background: 'hsl(0 0% 96%)' }}>
            <tr>
              {grid.columns.map((col) => (
                <th
                  key={col.columnId}
                  onClick={() => col.sortable && grid.toggleSort(col.columnId)}
                  style={{
                    cursor: col.sortable ? 'pointer' : 'default',
                    textAlign: col.type === 'numeric' ? 'right' : 'left',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'hsl(0 0% 45%)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    userSelect: 'none',
                    borderBottom: '1px solid hsl(0 0% 90%)',
                  }}
                >
                  {col.name} <span style={{ opacity: 0.5 }}>{grid.sortIndicator(col.columnId)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, rowIdx) =>
              <tr key={grid.getRowId(row)}>
                {grid.columns.map((col, colIdx) => {
                  const isEditingCell = edit.isEditing(row, col.columnId);
                  const isActive = focus.activeCell?.row === rowIdx && focus.activeCell?.col === colIdx;
                  const inRange = range.isInRange(rowIdx, colIdx);
                  const inFill = fill.isInFillRange(rowIdx, colIdx);
                  const inCut = clipboard.activeCutRange &&
                    rowIdx >= clipboard.activeCutRange.startRow &&
                    rowIdx <= clipboard.activeCutRange.endRow &&
                    colIdx >= clipboard.activeCutRange.startCol &&
                    colIdx <= clipboard.activeCutRange.endCol;
                  const value = grid.getCellValue(row, col.columnId);
                  const align = col.type === 'numeric' ? 'right' : 'left';
                  const isLastRow = rowIdx === grid.rows.length - 1;
                  const isLastCol = colIdx === grid.columns.length - 1;

                  // Bottom-right of the active range gets the fill handle dot.
                  const showFillHandle =
                    range.range &&
                    rowIdx === range.range.endRow &&
                    colIdx === range.range.endCol &&
                    !isEditingCell;

                  return (
                    <td
                      key={col.columnId}
                      onMouseDown={(e) => {
                        if (e.shiftKey) range.extendRange(rowIdx, colIdx);
                        else range.startRange(rowIdx, colIdx);
                        focus.setActiveCell({ row: rowIdx, col: colIdx });
                      }}
                      onMouseEnter={(e) => {
                        if (fill.isFilling) fill.updateFill(rowIdx, colIdx);
                        else if (e.buttons === 1 && !isEditingCell) range.extendRange(rowIdx, colIdx);
                      }}
                      onMouseUp={() => fill.isFilling && fill.commitFill()}
                      onDoubleClick={() => edit.canEdit(row, col.columnId) && edit.startEdit(row, col.columnId)}
                      style={{
                        position: 'relative',
                        padding: isEditingCell ? 0 : '8px 12px',
                        textAlign: align,
                        fontSize: 13,
                        borderBottom: isLastRow ? 'none' : '1px solid hsl(0 0% 95%)',
                        borderRight: isLastCol ? 'none' : undefined,
                        background: inFill && !inRange
                          ? 'hsl(140 50% 95%)'
                          : inCut
                          ? 'hsl(40 90% 95%)'
                          : inRange
                          ? 'hsl(210 100% 95%)'
                          : undefined,
                        outline: isActive ? '2px solid hsl(210 100% 56%)' : undefined,
                        outlineOffset: -2,
                        cursor: isEditingCell ? 'text' : 'cell',
                        userSelect: 'none',
                      }}
                    >
                      {isEditingCell ? (
                        <input
                          autoFocus
                          {...{
                            value: String(edit.pendingValue ?? ''),
                            onChange: (e) => edit.setPendingValue(e.target.value),
                            onBlur: edit.commitEdit,
                            onKeyDown: (e) => {
                              if (e.key === 'Enter') { e.preventDefault(); edit.commitEdit(); }
                              else if (e.key === 'Escape') { e.preventDefault(); edit.cancelEdit(); }
                            },
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            outline: '2px solid hsl(210 100% 56%)',
                            outlineOffset: -2,
                            background: 'white',
                            font: 'inherit',
                            fontVariantNumeric: 'tabular-nums',
                            textAlign: align,
                            boxSizing: 'border-box',
                          }}
                          type={col.type === 'numeric' ? 'number' : 'text'}
                        />
                      ) : col.type === 'boolean' ? (
                        value ? '✓' : '—'
                      ) : col.columnId === 'salary' ? (
                        `$${(value as number).toLocaleString()}`
                      ) : (
                        String(value ?? '')
                      )}

                      {showFillHandle && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            fill.startFill();
                          }}
                          style={{
                            position: 'absolute',
                            right: -3,
                            bottom: -3,
                            width: 8,
                            height: 8,
                            background: 'hsl(210 100% 56%)',
                            border: '1px solid white',
                            cursor: 'crosshair',
                            zIndex: 1,
                          }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>,
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: 'OGrid/React Radix/SpreadsheetDemo',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

export const FullSpreadsheet: Story = {
  name: 'Full spreadsheet (all 6 hooks)',
  render: () => <SpreadsheetDemo />,
};
