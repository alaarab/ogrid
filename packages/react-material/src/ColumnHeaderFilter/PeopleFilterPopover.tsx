import * as React from 'react';
import {
  TextField, CircularProgress, Button, Box, Typography,
  InputAdornment, Avatar, IconButton,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import type { UserLike } from '@alaarab/ogrid-react';

export interface PeopleFilterPopoverProps {
  selectedUser: UserLike | undefined;
  searchText: string;
  onSearchChange: (value: string) => void;
  suggestions: UserLike[];
  isLoading: boolean;
  onUserSelect: (user: UserLike) => void;
  onClearUser: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const PeopleFilterPopover: React.FC<PeopleFilterPopoverProps> = ({
  selectedUser,
  searchText,
  onSearchChange,
  suggestions,
  isLoading,
  onUserSelect,
  onClearUser,
  inputRef,
}) => (
  <Box sx={{ width: 300 }}>
    {selectedUser && (
      <Box sx={{ p: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          Currently filtered by:
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Avatar src={selectedUser.photo} alt={selectedUser.displayName} sx={{ width: 32, height: 32 }}>
            {selectedUser.displayName?.[0]}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>{selectedUser.displayName}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{selectedUser.email}</Typography>
          </Box>
          <IconButton size="small" onClick={onClearUser} aria-label="Remove filter">
            <ClearIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    )}

    <Box sx={{ p: 1.5, pb: 0.5 }}>
      <TextField
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        placeholder="Search for a person..."
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
    </Box>

    <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
      {isLoading && searchText.trim() ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : suggestions.length === 0 && searchText.trim() ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          No results found
        </Typography>
      ) : searchText.trim() ? (
        suggestions.map((user) => (
          <Box
            key={user.id || user.email || user.displayName}
            onClick={() => onUserSelect(user)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Avatar src={user.photo} alt={user.displayName} sx={{ width: 32, height: 32 }}>
              {user.displayName?.[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>{user.displayName}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{user.email}</Typography>
            </Box>
          </Box>
        ))
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          Type to search...
        </Typography>
      )}
    </Box>

    {selectedUser && (
      <Box sx={{ p: 1.5, pt: 1, borderTop: 1, borderColor: 'divider' }}>
        <Button size="small" fullWidth onClick={onClearUser}>
          Clear Filter
        </Button>
      </Box>
    )}
  </Box>
);

PeopleFilterPopover.displayName = 'PeopleFilterPopover';
