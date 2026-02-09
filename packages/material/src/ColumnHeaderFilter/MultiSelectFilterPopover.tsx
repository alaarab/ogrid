import * as React from 'react';
import {
  TextField, Checkbox, CircularProgress, Button, Box, Typography,
  InputAdornment, FormControlLabel,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

export interface MultiSelectFilterPopoverProps {
  searchText: string;
  onSearchChange: (value: string) => void;
  options: string[];
  filteredOptions: string[];
  selected: Set<string>;
  onOptionToggle: (option: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApply: () => void;
  isLoading: boolean;
}

export const MultiSelectFilterPopover: React.FC<MultiSelectFilterPopoverProps> = ({
  searchText,
  onSearchChange,
  options,
  filteredOptions,
  selected,
  onOptionToggle,
  onSelectAll,
  onClearSelection,
  onApply,
  isLoading,
}) => (
  <Box sx={{ width: 280 }}>
    <Box sx={{ p: 1.5, pb: 0.5 }}>
      <TextField
        placeholder="Search..."
        value={searchText}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
        autoComplete="off"
        size="small"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {filteredOptions.length} of {options.length} options
      </Typography>
    </Box>

    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, py: 0.5 }}>
      <Button size="small" onClick={onSelectAll}>
        Select All ({filteredOptions.length})
      </Button>
      <Button size="small" onClick={onClearSelection}>
        Clear
      </Button>
    </Box>

    <Box sx={{ maxHeight: 240, overflowY: 'auto', px: 0.5 }}>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : filteredOptions.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          No options found
        </Typography>
      ) : (
        filteredOptions.map((option) => (
          <FormControlLabel
            key={option}
            control={
              <Checkbox
                size="small"
                checked={selected.has(option)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onOptionToggle(option, e.target.checked)
                }
              />
            }
            label={<Typography variant="body2">{option}</Typography>}
            sx={{ display: 'flex', mx: 0, '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 } }}
          />
        ))
      )}
    </Box>

    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 1.5, pt: 1, borderTop: 1, borderColor: 'divider' }}>
      <Button size="small" onClick={onClearSelection}>
        Clear
      </Button>
      <Button size="small" variant="contained" onClick={onApply}>
        Apply
      </Button>
    </Box>
  </Box>
);

MultiSelectFilterPopover.displayName = 'MultiSelectFilterPopover';
