import * as React from 'react';
import {
  IconButton, Button, Select, MenuItem, Box, Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import type { IPaginationControlsProps } from '@alaarab/ogrid-react';
import {
  PaginationControlsBase,
  type INavButtonSlotProps,
  type IPageButtonSlotProps,
  type IPageSizeSelectSlotProps,
  type IOuterContainerSlotProps,
  type IPaginationControlsSlots,
} from '@alaarab/ogrid-react';

export type { IPaginationControlsProps };

const MUI_NAV_ICONS = {
  first: <FirstPageIcon fontSize="small" />,
  prev: <ChevronLeftIcon fontSize="small" />,
  next: <ChevronRightIcon fontSize="small" />,
  last: <LastPageIcon fontSize="small" />,
} as const;

const NavButton: React.FC<INavButtonSlotProps> = ({ variant, onClick, disabled, 'aria-label': ariaLabel }) => (
  <IconButton size="small" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
    {MUI_NAV_ICONS[variant]}
  </IconButton>
);

const PageButton: React.FC<IPageButtonSlotProps> = ({ onClick, active, 'aria-label': ariaLabel, 'aria-current': ariaCurrent, children }) => (
  <Button
    variant={active ? 'contained' : 'outlined'}
    size="small"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-current={ariaCurrent}
    sx={{ minWidth: 32, px: 0.5 }}
  >
    {children}
  </Button>
);

const PageSizeSelect: React.FC<IPageSizeSelectSlotProps> = ({ value, options, onChange, 'aria-label': ariaLabel }) => {
  const handleChange = (event: SelectChangeEvent<number>) => onChange(Number(event.target.value));
  return (
    <Select value={value} onChange={handleChange} size="small" aria-label={ariaLabel} sx={{ minWidth: 70 }}>
      {options.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
    </Select>
  );
};

const OuterContainer: React.FC<IOuterContainerSlotProps> = ({ children, className, role, 'aria-label': ariaLabel }) => (
  <Box
    className={className}
    role={role}
    aria-label={ariaLabel}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 2,
      px: 1.5,
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    }}
  >
    {children}
  </Box>
);

const InfoText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="body2" color="text.secondary">{children}</Typography>
);

const NavButtonsContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{children}</Box>
);

const PageSizeContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{children}</Box>
);

const PageSizeLabel: React.FC<Record<string, never>> = () => (
  <Typography variant="body2" color="text.secondary">Rows</Typography>
);

const Ellipsis: React.FC<Record<string, never>> = () => (
  <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }} aria-hidden>…</Typography>
);

const SLOTS: IPaginationControlsSlots = {
  NavButton,
  PageButton,
  PageSizeSelect,
  OuterContainer,
  InfoText,
  NavButtonsContainer,
  PageSizeContainer,
  PageSizeLabel,
  Ellipsis,
};

export const PaginationControls: React.FC<IPaginationControlsProps> = React.memo((props) => (
  <PaginationControlsBase {...props} slots={SLOTS} />
));

PaginationControls.displayName = 'PaginationControls';
