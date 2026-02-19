import * as React from 'react';
import { Popover, Tooltip, IconButton, Box, Typography } from '@mui/material';
import {
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import type { IColumnHeaderFilterProps } from '@alaarab/ogrid-react';
import {
  useColumnHeaderFilterState,
  getColumnHeaderFilterStateParams,
  renderFilterContent,
} from '@alaarab/ogrid-react';
import type { FilterContentRenderers } from '@alaarab/ogrid-react';
import { TextFilterPopover } from './TextFilterPopover';
import { MultiSelectFilterPopover } from './MultiSelectFilterPopover';
import { PeopleFilterPopover } from './PeopleFilterPopover';

export type { IColumnHeaderFilterProps };

const materialRenderers: FilterContentRenderers = {
  renderMultiSelect: (p) => (
    <MultiSelectFilterPopover
      searchText={p.searchText}
      onSearchChange={p.onSearchChange}
      options={p.options}
      filteredOptions={p.filteredOptions}
      selected={p.selected}
      onOptionToggle={p.onOptionToggle}
      onSelectAll={p.onSelectAll}
      onClearSelection={p.onClearSelection}
      onApply={p.onApply}
      isLoading={p.isLoading}
    />
  ),
  renderText: (p) => (
    <TextFilterPopover
      value={p.value}
      onValueChange={p.onValueChange}
      onApply={p.onApply}
      onClear={p.onClear}
    />
  ),
  renderPeople: (p) => (
    <PeopleFilterPopover
      selectedUser={p.selectedUser}
      searchText={p.searchText}
      onSearchChange={p.onSearchChange}
      suggestions={p.suggestions}
      isLoading={p.isLoading}
      onUserSelect={p.onUserSelect}
      onClearUser={p.onClearUser}
      inputRef={p.inputRef}
    />
  ),
  renderDate: (p) => (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ minWidth: 36 }}>From:</Typography>
        <input type="date" value={p.tempDateFrom} onChange={(e) => p.setTempDateFrom(e.target.value)} style={{ flex: 1, padding: '4px 6px' }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ minWidth: 36 }}>To:</Typography>
        <input type="date" value={p.tempDateTo} onChange={(e) => p.setTempDateTo(e.target.value)} style={{ flex: 1, padding: '4px 6px' }} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
        <button onClick={p.onClear} disabled={!p.tempDateFrom && !p.tempDateTo} style={{ padding: '4px 12px', cursor: 'pointer' }}>Clear</button>
        <button onClick={p.onApply} style={{ padding: '4px 12px', cursor: 'pointer' }}>Apply</button>
      </Box>
    </Box>
  ),
};

export const ColumnHeaderFilter: React.FC<IColumnHeaderFilterProps> = React.memo((props) => {
  const {
    columnName,
    filterType,
    options = [],
    isLoadingOptions = false,
    selectedUser,
  } = props;

  const state = useColumnHeaderFilterState(getColumnHeaderFilterStateParams(props));

  const {
    headerRef,
    isFilterOpen,
    setFilterOpen,
    hasActiveFilter,
    popoverPosition,
    handlers,
  } = state;

  return (
    <Box ref={headerRef as React.RefObject<HTMLDivElement>} sx={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Tooltip title={columnName} arrow>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            data-header-label
            sx={{ lineHeight: 1.4 }}
          >
            {columnName}
          </Typography>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5, flexShrink: 0 }}>
        {filterType !== 'none' && (
          <IconButton
            size="small"
            onClick={handlers.handleFilterIconClick}
            aria-label={`Filter ${columnName}`}
            title={`Filter ${columnName}`}
            color={hasActiveFilter || isFilterOpen ? 'primary' : 'default'}
            sx={{ p: 0.25, position: 'relative' }}
          >
            <FilterListIcon sx={{ fontSize: 16 }} />
            {hasActiveFilter && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                }}
              />
            )}
          </IconButton>
        )}
      </Box>

      <Popover
        open={isFilterOpen && filterType !== 'none'}
        onClose={() => setFilterOpen(false)}
        anchorReference="anchorPosition"
        anchorPosition={popoverPosition ?? { top: 0, left: 0 }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { mt: 0.5, overflow: 'visible' },
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
          },
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1.5, py: 1 }}>
          <Typography variant="subtitle2">Filter: {columnName}</Typography>
        </Box>
        {renderFilterContent(filterType, state, options ?? [], isLoadingOptions, selectedUser, materialRenderers)}
      </Popover>
    </Box>
  );
});

ColumnHeaderFilter.displayName = 'ColumnHeaderFilter';
