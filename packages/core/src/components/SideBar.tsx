/**
 * Headless SideBar component rendered by OGridLayout.
 * Contains a tab strip (toggle buttons) and a panel area (columns or filters).
 * Uses inline styles for framework-agnostic rendering.
 */
import * as React from 'react';
import type { IColumnDefinition, IDateFilterValue, SideBarPanelId, IFilters, FilterValue } from '../types';

/** Describes a filterable column for the sidebar filters panel. */
export interface SideBarFilterColumn {
  columnId: string;
  name: string;
  filterField: string;
  filterType: 'text' | 'multiSelect' | 'people' | 'date';
}

export interface SideBarProps {
  activePanel: SideBarPanelId | null;
  onPanelChange: (panel: SideBarPanelId | null) => void;
  panels: SideBarPanelId[];
  position: 'left' | 'right';
  // Columns panel
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
  /** Batch-set all visible columns at once (used by Select All / Clear All). */
  onSetVisibleColumns: (columns: Set<string>) => void;
  // Filters panel
  filterableColumns: SideBarFilterColumn[];
  filters: IFilters;
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
}

const PANEL_WIDTH = 240;
const TAB_WIDTH = 36;

const PANEL_LABELS: Record<SideBarPanelId, string> = {
  columns: 'Columns',
  filters: 'Filters',
};

export function SideBar(props: SideBarProps): React.ReactElement {
  const {
    activePanel,
    onPanelChange,
    panels,
    position,
    columns,
    visibleColumns,
    onVisibilityChange,
    onSetVisibleColumns,
    filterableColumns,
    filters,
    onFilterChange,
    filterOptions,
  } = props;

  const isOpen = activePanel !== null;

  const handleTabClick = (panel: SideBarPanelId) => {
    onPanelChange(activePanel === panel ? null : panel);
  };

  const tabStrip = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: TAB_WIDTH,
        borderLeft: position === 'right' ? '1px solid var(--ogrid-border, #e0e0e0)' : undefined,
        borderRight: position === 'left' ? '1px solid var(--ogrid-border, #e0e0e0)' : undefined,
        background: 'var(--ogrid-header-bg, #f5f5f5)',
      }}
      role="tablist"
      aria-label="Side bar tabs"
    >
      {panels.map((panel) => (
        <button
          key={panel}
          role="tab"
          aria-selected={activePanel === panel}
          aria-label={PANEL_LABELS[panel]}
          onClick={() => handleTabClick(panel)}
          title={PANEL_LABELS[panel]}
          style={{
            width: TAB_WIDTH,
            height: TAB_WIDTH,
            border: 'none',
            cursor: 'pointer',
            background: activePanel === panel ? 'var(--ogrid-bg, #fff)' : 'transparent',
            color: 'var(--ogrid-fg, #242424)',
            fontWeight: activePanel === panel ? 'bold' : 'normal',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {panel === 'columns' ? '\u2261' : '\u2A65'}
        </button>
      ))}
    </div>
  );

  const panelContent = isOpen ? (
    <div
      role="tabpanel"
      aria-label={PANEL_LABELS[activePanel!]}
      style={{
        width: PANEL_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: position === 'right' ? '1px solid var(--ogrid-border, #e0e0e0)' : undefined,
        borderRight: position === 'left' ? '1px solid var(--ogrid-border, #e0e0e0)' : undefined,
        overflow: 'hidden',
        background: 'var(--ogrid-bg, #fff)',
        color: 'var(--ogrid-fg, #242424)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
          fontWeight: 600,
        }}
      >
        <span>{PANEL_LABELS[activePanel!]}</span>
        <button
          onClick={() => onPanelChange(null)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: 'var(--ogrid-fg, #242424)' }}
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {activePanel === 'columns' && (
          <ColumnsPanel
            columns={columns}
            visibleColumns={visibleColumns}
            onVisibilityChange={onVisibilityChange}
            onSetVisibleColumns={onSetVisibleColumns}
          />
        )}
        {activePanel === 'filters' && (
          <FiltersPanel
            filterableColumns={filterableColumns}
            filters={filters}
            onFilterChange={onFilterChange}
            filterOptions={filterOptions}
          />
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'row', flexShrink: 0 }}
      role="complementary"
      aria-label="Side bar"
    >
      {position === 'left' && tabStrip}
      {position === 'left' && panelContent}
      {position === 'right' && panelContent}
      {position === 'right' && tabStrip}
    </div>
  );
}

// --- Internal sub-components ---

function ColumnsPanel(props: {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
  onSetVisibleColumns: (columns: Set<string>) => void;
}): React.ReactElement {
  const { columns, visibleColumns, onVisibilityChange, onSetVisibleColumns } = props;
  const allVisible = columns.every((c) => visibleColumns.has(c.columnId));

  const handleSelectAll = () => {
    const next = new Set(visibleColumns);
    columns.forEach((c) => next.add(c.columnId));
    onSetVisibleColumns(next);
  };
  const handleClearAll = () => {
    const next = new Set<string>();
    columns.forEach((c) => {
      if (c.required && visibleColumns.has(c.columnId)) next.add(c.columnId);
    });
    onSetVisibleColumns(next);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={handleSelectAll} disabled={allVisible} style={{ flex: 1, cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4, padding: '4px 8px' }}>
          Select All
        </button>
        <button onClick={handleClearAll} style={{ flex: 1, cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4, padding: '4px 8px' }}>
          Clear All
        </button>
      </div>
      {columns.map((col) => (
        <label
          key={col.columnId}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={visibleColumns.has(col.columnId)}
            onChange={(e) => onVisibilityChange(col.columnId, e.target.checked)}
            disabled={col.required}
          />
          <span>{col.name}</span>
        </label>
      ))}
    </>
  );
}

function FiltersPanel(props: {
  filterableColumns: SideBarFilterColumn[];
  filters: IFilters;
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
}): React.ReactElement {
  const { filterableColumns, filters, onFilterChange, filterOptions } = props;

  if (filterableColumns.length === 0) {
    return <div style={{ color: 'var(--ogrid-muted, #999)', fontStyle: 'italic' }}>No filterable columns</div>;
  }

  return (
    <>
      {filterableColumns.map((col) => {
        const filterKey = col.filterField;
        return (
          <div key={col.columnId} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{col.name}</div>
            {col.filterType === 'text' && (
              <input
                type="text"
                value={filters[filterKey]?.type === 'text' ? filters[filterKey]!.value : ''}
                onChange={(e) => onFilterChange(filterKey, e.target.value ? { type: 'text', value: e.target.value } : undefined)}
                placeholder={`Filter ${col.name}...`}
                aria-label={`Filter ${col.name}`}
                style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4 }}
              />
            )}
            {col.filterType === 'date' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  From:
                  <input
                    type="date"
                    value={filters[filterKey]?.type === 'date' ? (filters[filterKey]!.value.from ?? '') : ''}
                    onChange={(e) => {
                      const from = e.target.value || undefined;
                      const existingValue = filters[filterKey]?.type === 'date' ? filters[filterKey]!.value : {};
                      const to = existingValue.to;
                      onFilterChange(filterKey, from || to ? { type: 'date', value: { from, to } } : undefined);
                    }}
                    aria-label={`${col.name} from date`}
                    style={{ flex: 1, padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4 }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  To:
                  <input
                    type="date"
                    value={filters[filterKey]?.type === 'date' ? (filters[filterKey]!.value.to ?? '') : ''}
                    onChange={(e) => {
                      const to = e.target.value || undefined;
                      const existingValue = filters[filterKey]?.type === 'date' ? filters[filterKey]!.value : {};
                      const from = existingValue.from;
                      onFilterChange(filterKey, from || to ? { type: 'date', value: { from, to } } : undefined);
                    }}
                    aria-label={`${col.name} to date`}
                    style={{ flex: 1, padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4 }}
                  />
                </label>
              </div>
            )}
            {col.filterType === 'multiSelect' && (
              <div style={{ maxHeight: 120, overflowY: 'auto' }} role="group" aria-label={`${col.name} options`}>
                {(filterOptions[filterKey] ?? []).map((opt) => {
                  const selected = filters[filterKey]?.type === 'multiSelect' ? filters[filterKey]!.value.includes(opt) : false;
                  return (
                    <label
                      key={opt}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', cursor: 'pointer', fontSize: 13 }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const current = filters[filterKey]?.type === 'multiSelect' ? filters[filterKey]!.value : [];
                          const next = e.target.checked
                            ? [...current, opt]
                            : current.filter((v) => v !== opt);
                          onFilterChange(filterKey, next.length > 0 ? { type: 'multiSelect', value: next } : undefined);
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
