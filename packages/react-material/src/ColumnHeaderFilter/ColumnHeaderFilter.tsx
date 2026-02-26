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
  createBaseFilterRenderers,
} from '@alaarab/ogrid-react';
import type { FilterContentRenderers } from '@alaarab/ogrid-react';
import { TextFilterPopover } from './TextFilterPopover';
import { MultiSelectFilterPopover } from './MultiSelectFilterPopover';
import { PeopleFilterPopover } from './PeopleFilterPopover';

export type { IColumnHeaderFilterProps };

const materialRenderers: FilterContentRenderers = createBaseFilterRenderers(
  { MultiSelectFilterPopover, TextFilterPopover, PeopleFilterPopover }
);

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
            aria-expanded={isFilterOpen}
            aria-haspopup="dialog"
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
