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
import type { IColumnChooserProps } from '@alaarab/ogrid-react';
import {
  useColumnChooserState,
  ColumnChooserContent,
  type IColumnChooserCheckboxItemProps,
  type IColumnChooserActionsProps,
  type IColumnChooserHeaderProps,
} from '@alaarab/ogrid-react';

export type { IColumnChooserProps };

const CheckboxItem: React.FC<IColumnChooserCheckboxItemProps> = ({ columnId: _columnId, columnName, checked, disabled, onChange }) => (
  <FormControlLabel
    control={
      <Checkbox
        size="small"
        checked={checked}
        onChange={(ev: React.ChangeEvent<HTMLInputElement>) => { ev.stopPropagation(); onChange(ev.target.checked); }}
        disabled={disabled}
      />
    }
    label={<Typography variant="body2">{columnName}</Typography>}
    sx={{ m: 0 }}
  />
);

const Header: React.FC<IColumnChooserHeaderProps> = ({ visibleCount, totalCount }) => (
  <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
    <Typography variant="subtitle2" fontWeight={600}>
      Select Columns ({visibleCount} of {totalCount})
    </Typography>
  </Box>
);

const OptionsListContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ maxHeight: 320, overflowY: 'auto', py: 0.5 }}>{children}</Box>
);

const OptionItemContainer: React.FC<{ columnId: string; children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ px: 1.5, minHeight: 32, display: 'flex', alignItems: 'center' }}>{children}</Box>
);

const Actions: React.FC<IColumnChooserActionsProps> = ({ onClearAll, onSelectAll }) => (
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
    <Button size="small" onClick={onClearAll} sx={{ textTransform: 'none' }}>Clear All</Button>
    <Button size="small" variant="contained" onClick={onSelectAll} sx={{ textTransform: 'none' }}>Select All</Button>
  </Box>
);

export const ColumnChooser: React.FC<IColumnChooserProps> = (props) => {
  const { columns, visibleColumns, onVisibilityChange, onSetVisibleColumns, className } = props;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    open: isOpen,
    setOpen,
    handleClose,
    handleCheckboxChange: setColumnVisible,
    handleSelectAll, handleClearAll,
    visibleCount, totalCount,
  } = useColumnChooserState({ columns, visibleColumns, onVisibilityChange, onSetVisibleColumns });

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

  const handleCheckboxChange = (columnKey: string) => (checked: boolean) => setColumnVisible(columnKey)(checked);

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
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 220 } } }}
      >
        <ColumnChooserContent
          columns={columns}
          visibleColumns={visibleColumns}
          visibleCount={visibleCount}
          totalCount={totalCount}
          handleSelectAll={handleSelectAll}
          handleClearAll={handleClearAll}
          handleCheckboxChange={handleCheckboxChange}
          CheckboxItem={CheckboxItem}
          Header={Header}
          OptionsListContainer={OptionsListContainer}
          OptionItemContainer={OptionItemContainer}
          Actions={Actions}
        />
      </Popover>
    </Box>
  );
};
