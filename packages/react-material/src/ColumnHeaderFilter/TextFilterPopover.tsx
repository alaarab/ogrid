import * as React from 'react';
import { TextField, Button, Box, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

export interface TextFilterPopoverProps {
  value: string;
  onValueChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export const TextFilterPopover: React.FC<TextFilterPopoverProps> = ({
  value,
  onValueChange,
  onApply,
  onClear,
}) => (
  <Box sx={{ width: 260 }}>
    <Box sx={{ p: 1.5 }}>
      <TextField
        placeholder="Enter search term..."
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            onApply();
          }
        }}
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
    </Box>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 1.5, pt: 0 }}>
      <Button size="small" disabled={!value} onClick={onClear}>
        Clear
      </Button>
      <Button size="small" variant="contained" onClick={onApply}>
        Apply
      </Button>
    </Box>
  </Box>
);

TextFilterPopover.displayName = 'TextFilterPopover';
