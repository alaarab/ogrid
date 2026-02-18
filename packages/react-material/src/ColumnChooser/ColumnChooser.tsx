import * as React from 'react';
import { useState, useRef } from 'react';
import {
  Button, Popover, Checkbox, Box, Typography, FormControlLabel,
} from '@mui/material';
import {
  ViewColumn as ViewColumnIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { IColumnDefinition } from '@alaarab/ogrid-react';
import { useColumnChooserState } from '@alaarab/ogrid-react';

export type { IColumnDefinition };

export interface IColumnChooserProps {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
  className?: string;
}

export const ColumnChooser: React.FC<IColumnChooserProps> = (props) => {
  const { columns, visibleColumns, onVisibilityChange, className } = props;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    open: isOpen,
    setOpen,
    handleClose,
    handleCheckboxChange: setColumnVisible,
    handleSelectAll,
    handleClearAll,
    visibleCount,
    totalCount,
  } = useColumnChooserState({ columns, visibleColumns, onVisibilityChange });

  const handleToggle = (e: React.MouseEvent<HTMLElement>): void => {
    if (isOpen) {
      handleClose();
      setAnchorEl(null);
    } else {
      setAnchorEl(e.currentTarget);
      setOpen(true);
    }
  };

  const handlePopoverClose = (): void => {
    handleClose();
    setAnchorEl(null);
  };

  const handleCheckboxChange = (columnKey: string) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    ev.stopPropagation();
    setColumnVisible(columnKey)(ev.target.checked);
  };

  return (
    <Box className={className} sx={{ display: 'inline-flex' }}>
      <Button
        ref={buttonRef}
        variant="outlined"
        size="small"
        color="inherit"
        startIcon={<ViewColumnIcon />}
        endIcon={isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          borderColor: isOpen ? 'primary.main' : 'divider',
        }}
      >
        Column Visibility ({visibleCount} of {totalCount})
      </Button>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { mt: 0.5, minWidth: 220 },
          },
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Typography variant="subtitle2" fontWeight={600}>
            Select Columns ({visibleCount} of {totalCount})
          </Typography>
        </Box>

        <Box sx={{ maxHeight: 320, overflowY: 'auto', py: 0.5 }}>
          {columns.map((column) => (
            <Box key={column.columnId} sx={{ px: 1.5, minHeight: 32, display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={visibleColumns.has(column.columnId)}
                    onChange={handleCheckboxChange(column.columnId)}
                  />
                }
                label={<Typography variant="body2">{column.name}</Typography>}
                sx={{ m: 0 }}
              />
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            px: 1.5,
            py: 1,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Button size="small" onClick={handleClearAll} sx={{ textTransform: 'none' }}>
            Clear All
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSelectAll}
            sx={{ textTransform: 'none' }}
          >
            Select All
          </Button>
        </Box>
      </Popover>
    </Box>
  );
};
