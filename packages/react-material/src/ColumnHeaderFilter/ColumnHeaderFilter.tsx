import * as React from 'react';
import { Popover, Tooltip, IconButton, Box, Typography } from '@mui/material';
import {
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  SwapVert as SwapVertIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import type { IColumnHeaderFilterProps } from '@alaarab/ogrid-react';
import {
  useColumnHeaderFilterState,
  getColumnHeaderFilterStateParams,
} from '@alaarab/ogrid-react';
import { TextFilterPopover } from './TextFilterPopover';
import { MultiSelectFilterPopover } from './MultiSelectFilterPopover';
import { PeopleFilterPopover } from './PeopleFilterPopover';

export type { IColumnHeaderFilterProps };

export const ColumnHeaderFilter: React.FC<IColumnHeaderFilterProps> = React.memo((props) => {
  const {
    columnName,
    filterType,
    isSorted = false,
    isSortedDescending = false,
    onSort,
    options = [],
    isLoadingOptions = false,
    selectedUser,
  } = props;

  const state = useColumnHeaderFilterState(getColumnHeaderFilterStateParams(props));

  const {
    headerRef,
    peopleInputRef,
    isFilterOpen,
    setFilterOpen,
    tempSelected,
    tempTextValue,
    setTempTextValue,
    searchText,
    setSearchText,
    filteredOptions,
    peopleSuggestions,
    isPeopleLoading,
    peopleSearchText,
    setPeopleSearchText,
    hasActiveFilter,
    popoverPosition,
    handlers,
  } = state;

  const safeOptions = options ?? [];

  const renderPopoverContent = (): React.ReactNode => {
    if (filterType === 'multiSelect') {
      return (
        <MultiSelectFilterPopover
          searchText={searchText}
          onSearchChange={setSearchText}
          options={safeOptions}
          filteredOptions={filteredOptions}
          selected={tempSelected}
          onOptionToggle={handlers.handleCheckboxChange}
          onSelectAll={handlers.handleSelectAll}
          onClearSelection={handlers.handleClearSelection}
          onApply={handlers.handleApplyMultiSelect}
          isLoading={isLoadingOptions}
        />
      );
    }
    if (filterType === 'text') {
      return (
        <TextFilterPopover
          value={tempTextValue}
          onValueChange={setTempTextValue}
          onApply={handlers.handleTextApply}
          onClear={handlers.handleTextClear}
        />
      );
    }
    if (filterType === 'people') {
      return (
        <PeopleFilterPopover
          selectedUser={selectedUser}
          searchText={peopleSearchText}
          onSearchChange={setPeopleSearchText}
          suggestions={peopleSuggestions}
          isLoading={isPeopleLoading}
          onUserSelect={handlers.handleUserSelect}
          onClearUser={handlers.handleClearUser}
          inputRef={peopleInputRef}
        />
      );
    }
    if (filterType === 'date') {
      return (
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 36 }}>From:</Typography>
            <input type="date" value={state.tempDateFrom} onChange={(e) => state.setTempDateFrom(e.target.value)} style={{ flex: 1, padding: '4px 6px' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 36 }}>To:</Typography>
            <input type="date" value={state.tempDateTo} onChange={(e) => state.setTempDateTo(e.target.value)} style={{ flex: 1, padding: '4px 6px' }} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
            <button onClick={handlers.handleDateClear} disabled={!state.tempDateFrom && !state.tempDateTo} style={{ padding: '4px 12px', cursor: 'pointer' }}>Clear</button>
            <button onClick={handlers.handleDateApply} style={{ padding: '4px 12px', cursor: 'pointer' }}>Apply</button>
          </Box>
        </Box>
      );
    }
    return null;
  };

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
        {onSort && (
          <IconButton
            size="small"
            onClick={handlers.handleSortClick}
            aria-label={`Sort by ${columnName}`}
            title={isSorted ? (isSortedDescending ? 'Sorted descending' : 'Sorted ascending') : 'Sort'}
            color={isSorted ? 'primary' : 'default'}
            sx={{ p: 0.25 }}
          >
            {isSorted ? (
              isSortedDescending ? (
                <ArrowDownwardIcon sx={{ fontSize: 16 }} />
              ) : (
                <ArrowUpwardIcon sx={{ fontSize: 16 }} />
              )
            ) : (
              <SwapVertIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        )}

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
        {renderPopoverContent()}
      </Popover>
    </Box>
  );
});

ColumnHeaderFilter.displayName = 'ColumnHeaderFilter';
