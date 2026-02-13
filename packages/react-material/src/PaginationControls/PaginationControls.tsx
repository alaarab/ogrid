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
import { usePaginationControls } from '@alaarab/ogrid-react';

export interface IPaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  entityLabelPlural?: string;
  className?: string;
}

export const PaginationControls: React.FC<IPaginationControlsProps> = React.memo((props) => {
  const {
    currentPage,
    pageSize,
    totalCount,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions,
    entityLabelPlural,
    className,
  } = props;

  const { labelPlural, vm, handlePageSizeChange } = usePaginationControls({
    currentPage,
    pageSize,
    totalCount,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions,
    entityLabelPlural,
  });

  const handlePageSizeChangeEvent = (event: SelectChangeEvent<number>) => {
    handlePageSizeChange(Number(event.target.value));
  };

  if (!vm) {
    return null;
  }

  const { pageNumbers, showStartEllipsis, showEndEllipsis, totalPages, startItem, endItem } = vm;

  return (
    <Box
      className={className}
      role="navigation"
      aria-label="Pagination"
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
      <Typography variant="body2" color="text.secondary">
        Showing {startItem} to {endItem} of {totalCount.toLocaleString()} {labelPlural}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          <FirstPageIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        {showStartEllipsis && (
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={() => onPageChange(1)}
              aria-label="Page 1"
              sx={{ minWidth: 32, px: 0.5 }}
            >
              1
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }} aria-hidden>
              …
            </Typography>
          </>
        )}

        {pageNumbers.map((pageNum) => (
          <Button
            key={pageNum}
            variant={currentPage === pageNum ? 'contained' : 'outlined'}
            size="small"
            onClick={() => onPageChange(pageNum)}
            aria-label={`Page ${pageNum}`}
            aria-current={currentPage === pageNum ? 'page' : undefined}
            sx={{ minWidth: 32, px: 0.5 }}
          >
            {pageNum}
          </Button>
        ))}

        {showEndEllipsis && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }} aria-hidden>
              …
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => onPageChange(totalPages)}
              aria-label={`Page ${totalPages}`}
              sx={{ minWidth: 32, px: 0.5 }}
            >
              {totalPages}
            </Button>
          </>
        )}

        <IconButton
          size="small"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          aria-label="Last page"
        >
          <LastPageIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Rows
        </Typography>
        <Select
          value={pageSize}
          onChange={handlePageSizeChangeEvent}
          size="small"
          aria-label="Rows per page"
          sx={{ minWidth: 70 }}
        >
          {vm.pageSizeOptions.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
});
