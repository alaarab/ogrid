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

// --- Stable style objects (avoid re-creating on every render) ---

const tabStripBaseStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: TAB_WIDTH,
  background: 'var(--ogrid-header-bg, #f5f5f5)',
};
const tabStripBorderLeft: React.CSSProperties = { ...tabStripBaseStyle, borderLeft: '1px solid var(--ogrid-border, #e0e0e0)' };
const tabStripBorderRight: React.CSSProperties = { ...tabStripBaseStyle, borderRight: '1px solid var(--ogrid-border, #e0e0e0)' };

const tabButtonBase: React.CSSProperties = {
  width: TAB_WIDTH,
  height: TAB_WIDTH,
  border: 'none',
  cursor: 'pointer',
  color: 'var(--ogrid-fg, #242424)',
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const tabButtonActive: React.CSSProperties = { ...tabButtonBase, background: 'var(--ogrid-bg, #fff)', fontWeight: 'bold' };
const tabButtonInactive: React.CSSProperties = { ...tabButtonBase, background: 'transparent', fontWeight: 'normal' };

const panelContainerBase: React.CSSProperties = {
  width: PANEL_WIDTH,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
};
const panelContainerBorderLeft: React.CSSProperties = { ...panelContainerBase, borderLeft: '1px solid var(--ogrid-border, #e0e0e0)' };
const panelContainerBorderRight: React.CSSProperties = { ...panelContainerBase, borderRight: '1px solid var(--ogrid-border, #e0e0e0)' };

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
  fontWeight: 600,
};

const closeButtonStyle: React.CSSProperties = { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, color: 'var(--ogrid-fg, #242424)' };

const panelBodyStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '8px 12px' };

const sideBarRootStyle: React.CSSProperties = { display: 'flex', flexDirection: 'row', flexShrink: 0 };

const buttonRowStyle: React.CSSProperties = { display: 'flex', gap: 8, marginBottom: 8 };

const actionButtonStyle: React.CSSProperties = { flex: 1, cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4, padding: '4px 8px' };

const checkboxLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer' };

const noFilterStyle: React.CSSProperties = { color: 'var(--ogrid-muted, #999)', fontStyle: 'italic' };

const filterGroupStyle: React.CSSProperties = { marginBottom: 12 };

const filterLabelStyle: React.CSSProperties = { fontWeight: 500, marginBottom: 4, fontSize: 13 };

const textInputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '4px 6px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4 };

const dateContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

const dateLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 };

const dateInputStyle: React.CSSProperties = { flex: 1, padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: 4 };

const multiSelectContainerStyle: React.CSSProperties = { maxHeight: 120, overflowY: 'auto' };

const multiSelectLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', cursor: 'pointer', fontSize: 13 };

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

  const tabStripStyle = position === 'right' ? tabStripBorderLeft : tabStripBorderRight;
  const panelContainerStyle = position === 'right' ? panelContainerBorderLeft : panelContainerBorderRight;

  const tabStrip = (
    <div style={tabStripStyle} role="tablist" aria-label="Side bar tabs">
      {panels.map((panel) => (
        <button
          key={panel}
          role="tab"
          aria-selected={activePanel === panel}
          aria-label={PANEL_LABELS[panel]}
          onClick={() => handleTabClick(panel)}
          title={PANEL_LABELS[panel]}
          style={activePanel === panel ? tabButtonActive : tabButtonInactive}
        >
          {panel === 'columns' ? '\u2261' : '\u2A65'}
        </button>
      ))}
    </div>
  );

  const panelContent = isOpen ? (
    <div role="tabpanel" aria-label={PANEL_LABELS[activePanel!]} style={panelContainerStyle}>
      <div style={panelHeaderStyle}>
        <span>{PANEL_LABELS[activePanel!]}</span>
        <button onClick={() => onPanelChange(null)} style={closeButtonStyle} aria-label="Close panel">
          &times;
        </button>
      </div>
      <div style={panelBodyStyle}>
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
    <div style={sideBarRootStyle} role="complementary" aria-label="Side bar">
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
      <div style={buttonRowStyle}>
        <button onClick={handleSelectAll} disabled={allVisible} style={actionButtonStyle}>
          Select All
        </button>
        <button onClick={handleClearAll} style={actionButtonStyle}>
          Clear All
        </button>
      </div>
      {columns.map((col) => (
        <label key={col.columnId} style={checkboxLabelStyle}>
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
    return <div style={noFilterStyle}>No filterable columns</div>;
  }

  return (
    <>
      {filterableColumns.map((col) => {
        const filterKey = col.filterField;
        return (
          <div key={col.columnId} style={filterGroupStyle}>
            <div style={filterLabelStyle}>{col.name}</div>
            {col.filterType === 'text' && (
              <input
                type="text"
                value={filters[filterKey]?.type === 'text' ? filters[filterKey]!.value : ''}
                onChange={(e) => onFilterChange(filterKey, e.target.value ? { type: 'text', value: e.target.value } : undefined)}
                placeholder={`Filter ${col.name}...`}
                aria-label={`Filter ${col.name}`}
                style={textInputStyle}
              />
            )}
            {col.filterType === 'date' && (
              <div style={dateContainerStyle}>
                <label style={dateLabelStyle}>
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
                    style={dateInputStyle}
                  />
                </label>
                <label style={dateLabelStyle}>
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
                    style={dateInputStyle}
                  />
                </label>
              </div>
            )}
            {col.filterType === 'multiSelect' && (
              <div style={multiSelectContainerStyle} role="group" aria-label={`${col.name} options`}>
                {(filterOptions[filterKey] ?? []).map((opt) => {
                  const selected = filters[filterKey]?.type === 'multiSelect' ? filters[filterKey]!.value.includes(opt) : false;
                  return (
                    <label key={opt} style={multiSelectLabelStyle}>
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
