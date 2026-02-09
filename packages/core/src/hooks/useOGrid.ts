import * as React from 'react';
import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
} from 'react';
import {
  getFilterField,
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
} from '../utils/ogridHelpers';
import { getCellValue, flattenColumns } from '../utils';
import { toDataGridFilterProps } from '../types';
import { useFilterOptions } from './useFilterOptions';
import type {
  RowId,
  IOGridProps,
  IOGridDataGridProps,
  IOGridApi,
  IFilters,
  IRowSelectionChangeEvent,
  IStatusBarProps,
  UserLike,
  IColumnDefinition,
} from '../types';

const DEFAULT_PAGE_SIZE = 20;

export interface UseOGridResult<T> {
  dataGridProps: IOGridDataGridProps<T>;
  page: number;
  pageSize: number;
  displayTotalCount: number;
  setPage: (p: number) => void;
  setPageSize: (size: number) => void;
  columnChooserColumns: IColumnDefinition[];
  visibleColumns: Set<string>;
  handleVisibilityChange: (columnKey: string, isVisible: boolean) => void;
  title: React.ReactNode;
  toolbar: React.ReactNode;
  className?: string;
  entityLabelPlural: string;
  emptyState?: { message?: React.ReactNode; render?: () => React.ReactNode };
  hasActiveFilters: boolean;
  setFilters: (f: IFilters) => void;
}

export function useOGrid<T>(
  props: IOGridProps<T>,
  ref: React.Ref<IOGridApi<T>>
): UseOGridResult<T> {
  const {
    columns: columnsProp,
    getRowId,
    data,
    dataSource,
    page: controlledPage,
    pageSize: controlledPageSize,
    sort: controlledSort,
    filters: controlledFilters,
    visibleColumns: controlledVisibleColumns,
    isLoading: controlledLoading,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    onFiltersChange,
    onVisibleColumnsChange,
    columnOrder,
    onColumnOrderChange,
    freezeRows,
    freezeCols,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    defaultSortBy,
    defaultSortDirection = 'asc',
    toolbar,
    emptyState,
    entityLabelPlural = 'items',
    className,
    title,
    layoutMode = 'content',
    editable,
    cellSelection,
    onCellValueChanged,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    rowSelection = 'none',
    selectedRows,
    onSelectionChange,
    statusBar,
    onError,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  const columns = useMemo(() => flattenColumns(columnsProp), [columnsProp]);
  const isServerSide = dataSource != null;
  const isClientSide = !isServerSide;

  const [internalData, setInternalData] = useState<T[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  if (data != null && dataSource != null) {
    console.error('OGrid: pass either data or dataSource, not both.');
  }

  const displayData = data ?? internalData;
  const displayLoading = controlledLoading ?? internalLoading;

  const defaultSortField = defaultSortBy ?? columns[0]?.columnId ?? '';

  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const [internalSort, setInternalSort] = useState<{
    field: string;
    direction: 'asc' | 'desc';
  }>({
    field: defaultSortField,
    direction: defaultSortDirection,
  });
  const [internalFilters, setInternalFilters] = useState<IFilters>({});
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<Set<string>>(
    () => {
      const visible = columns
        .filter((c) => c.defaultVisible !== false)
        .map((c) => c.columnId);
      return new Set(
        visible.length > 0 ? visible : columns.map((c) => c.columnId)
      );
    }
  );

  const page = controlledPage ?? internalPage;
  const pageSize = controlledPageSize ?? internalPageSize;
  const sort = controlledSort ?? internalSort;
  const filters = controlledFilters ?? internalFilters;
  const visibleColumns = controlledVisibleColumns ?? internalVisibleColumns;

  const setPage = useCallback(
    (p: number) => {
      if (controlledPage === undefined) setInternalPage(p);
      onPageChange?.(p);
    },
    [controlledPage, onPageChange]
  );

  const setPageSize = useCallback(
    (size: number) => {
      if (controlledPageSize === undefined) setInternalPageSize(size);
      onPageSizeChange?.(size);
      setPage(1);
    },
    [controlledPageSize, onPageSizeChange, setPage]
  );

  const setSort = useCallback(
    (s: { field: string; direction: 'asc' | 'desc' }) => {
      if (controlledSort === undefined) setInternalSort(s);
      onSortChange?.(s);
      setPage(1);
    },
    [controlledSort, onSortChange, setPage]
  );

  const setFilters = useCallback(
    (f: IFilters) => {
      if (controlledFilters === undefined) setInternalFilters(f);
      onFiltersChange?.(f);
      setPage(1);
    },
    [controlledFilters, onFiltersChange, setPage]
  );

  const setVisibleColumns = useCallback(
    (cols: Set<string>) => {
      if (controlledVisibleColumns === undefined) setInternalVisibleColumns(cols);
      onVisibleColumnsChange?.(cols);
    },
    [controlledVisibleColumns, onVisibleColumnsChange]
  );

  const { multiSelectFilters, textFilters, peopleFilters } = useMemo(
    () => toDataGridFilterProps(filters),
    [filters]
  );

  const handleSort = useCallback(
    (columnKey: string) => {
      setSort({
        field: columnKey,
        direction:
          sort.field === columnKey && sort.direction === 'asc' ? 'desc' : 'asc',
      });
    },
    [sort, setSort]
  );

  const handleMultiSelectFilterChange = useCallback(
    (key: string, values: string[]) => {
      setFilters(mergeFilter(filters, key, values.length ? values : undefined));
    },
    [filters, setFilters]
  );

  const handleTextFilterChange = useCallback(
    (key: string, value: string) => {
      setFilters(mergeFilter(filters, key, value.trim() || undefined));
    },
    [filters, setFilters]
  );

  const handlePeopleFilterChange = useCallback(
    (key: string, user: UserLike | undefined) => {
      setFilters(mergeFilter(filters, key, user ?? undefined));
    },
    [filters, setFilters]
  );

  const handleVisibilityChange = useCallback(
    (columnKey: string, isVisible: boolean) => {
      const next = new Set(visibleColumns);
      if (isVisible) next.add(columnKey);
      else next.delete(columnKey);
      setVisibleColumns(next);
    },
    [visibleColumns, setVisibleColumns]
  );

  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<RowId>>(
    new Set()
  );
  const effectiveSelectedRows = selectedRows ?? internalSelectedRows;

  const handleSelectionChange = useCallback(
    (event: IRowSelectionChangeEvent<T>) => {
      if (selectedRows === undefined) {
        setInternalSelectedRows(new Set(event.selectedRowIds));
      }
      onSelectionChange?.(event);
    },
    [selectedRows, onSelectionChange]
  );

  const multiSelectFilterFields = useMemo(
    () => getMultiSelectFilterFields(columns),
    [columns]
  );

  const filterOptionsSource = useMemo(
    () => dataSource ?? { fetchFilterOptions: undefined },
    [dataSource]
  );

  const { filterOptions: serverFilterOptions, loadingOptions: loadingFilterOptions } =
    useFilterOptions(filterOptionsSource, multiSelectFilterFields);

  const clientFilterOptions = useMemo(() => {
    if (dataSource != null && dataSource.fetchFilterOptions)
      return serverFilterOptions;
    return deriveFilterOptionsFromData(displayData, columns);
  }, [dataSource, displayData, columns, serverFilterOptions]);

  const clientItemsAndTotal = useMemo(() => {
    if (!isClientSide) return null;
    let rows = displayData.slice();
    columns.forEach((col) => {
      const filterKey = getFilterField(col);
      const f =
        col.filterable && typeof col.filterable === 'object'
          ? col.filterable
          : null;
      const type = f?.type;
      const val = filters[filterKey];
      if (type === 'multiSelect' && Array.isArray(val) && val.length > 0) {
        rows = rows.filter((r) =>
          val.includes(String(getCellValue(r, col)))
        );
      } else if (
        type === 'text' &&
        typeof val === 'string' &&
        val.trim()
      ) {
        const lower = val.trim().toLowerCase();
        rows = rows.filter((r) =>
          String(getCellValue(r, col) ?? '').toLowerCase().includes(lower)
        );
      } else if (
        type === 'people' &&
        val &&
        typeof val === 'object' &&
        'email' in val
      ) {
        const email = (val as UserLike).email.toLowerCase();
        rows = rows.filter(
          (r) =>
            String(getCellValue(r, col) ?? '').toLowerCase() === email
        );
      }
    });
    if (sort.field) {
      const sortCol = columns.find((c) => c.columnId === sort.field);
      const compare = sortCol?.compare;
      const dir = sort.direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        if (compare) return compare(a, b) * dir;
        const av = sortCol
          ? getCellValue(a, sortCol)
          : (a as Record<string, unknown>)[sort.field];
        const bv = sortCol
          ? getCellValue(b, sortCol)
          : (b as Record<string, unknown>)[sort.field];
        if (av == null && bv == null) return 0;
        if (av == null) return -1 * dir;
        if (bv == null) return 1 * dir;
        if (typeof av === 'number' && typeof bv === 'number')
          return av === bv ? 0 : av > bv ? dir : -dir;
        const as = String(av).toLowerCase();
        const bs = String(bv).toLowerCase();
        return as === bs ? 0 : as > bs ? dir : -dir;
      });
    }
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const paged = rows.slice(start, start + pageSize);
    return { items: paged, totalCount: total };
  }, [
    isClientSide,
    displayData,
    columns,
    filters,
    sort.field,
    sort.direction,
    page,
    pageSize,
  ]);

  const [serverItems, setServerItems] = useState<T[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!isServerSide || !dataSource) {
      if (!isServerSide) setLoading(false);
      return;
    }
    const id = ++fetchIdRef.current;
    setLoading(true);
    dataSource
      .fetchPage({
        page,
        pageSize,
        sort: { field: sort.field, direction: sort.direction },
        filters,
      })
      .then((res) => {
        if (id !== fetchIdRef.current) return;
        setServerItems(res.items);
        setServerTotalCount(res.totalCount);
      })
      .catch((err) => {
        if (id !== fetchIdRef.current) return;
        onError?.(err);
        setServerItems([]);
        setServerTotalCount(0);
      })
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false);
      });
  }, [
    isServerSide,
    dataSource,
    page,
    pageSize,
    sort.field,
    sort.direction,
    filters,
    onError,
  ]);

  const displayItems =
    isClientSide && clientItemsAndTotal
      ? clientItemsAndTotal.items
      : serverItems;
  const displayTotalCount =
    isClientSide && clientItemsAndTotal
      ? clientItemsAndTotal.totalCount
      : serverTotalCount;

  useImperativeHandle(
    ref,
    () => ({
      setRowData: (d: T[]) => {
        if (!isServerSide) setInternalData(d);
      },
      setLoading: setInternalLoading,
      getColumnState: () => ({ visibleColumns: Array.from(visibleColumns), sort }),
      setFilterModel: setFilters,
      getSelectedRows: () => Array.from(effectiveSelectedRows),
      setSelectedRows: (rowIds: RowId[]) => {
        if (selectedRows === undefined) setInternalSelectedRows(new Set(rowIds));
      },
      selectAll: () => {
        const allIds = new Set(displayItems.map((item) => getRowId(item)));
        if (selectedRows === undefined) setInternalSelectedRows(allIds);
        onSelectionChange?.({
          selectedRowIds: Array.from(allIds),
          selectedItems: displayItems,
        });
      },
      deselectAll: () => {
        if (selectedRows === undefined) setInternalSelectedRows(new Set());
        onSelectionChange?.({
          selectedRowIds: [],
          selectedItems: [],
        });
      },
    }),
    [
      visibleColumns,
      sort,
      setFilters,
      isServerSide,
      effectiveSelectedRows,
      selectedRows,
      displayItems,
      getRowId,
      onSelectionChange,
    ]
  );

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(
      (v) =>
        v !== undefined &&
        (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : true)
    );
  }, [filters]);

  const columnChooserColumns: IColumnDefinition[] = useMemo(
    () =>
      columns.map((c) => ({
        columnId: c.columnId,
        name: c.name,
        required: c.required === true,
      })),
    [columns]
  );

  const statusBarConfig = useMemo((): IStatusBarProps | undefined => {
    if (!statusBar) return undefined;
    if (typeof statusBar === 'object') return statusBar;
    const totalData = isClientSide ? (data?.length ?? 0) : serverTotalCount;
    const filteredData = displayTotalCount;
    return {
      totalCount: totalData,
      filteredCount: hasActiveFilters ? filteredData : undefined,
      selectedCount: effectiveSelectedRows.size,
    };
  }, [
    statusBar,
    isClientSide,
    data,
    serverTotalCount,
    displayTotalCount,
    hasActiveFilters,
    effectiveSelectedRows.size,
  ]);

  const dataGridProps: IOGridDataGridProps<T> = {
    items: displayItems,
    columns: columnsProp,
    getRowId,
    sortBy: sort.field,
    sortDirection: sort.direction,
    onColumnSort: handleSort,
    visibleColumns,
    columnOrder,
    onColumnOrderChange,
    freezeRows,
    freezeCols,
    editable,
    cellSelection,
    onCellValueChanged,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    rowSelection,
    selectedRows: effectiveSelectedRows,
    onSelectionChange: handleSelectionChange,
    statusBar: statusBarConfig,
    isLoading: (isServerSide && loading) || displayLoading,
    multiSelectFilters,
    onMultiSelectFilterChange: handleMultiSelectFilterChange,
    textFilters,
    onTextFilterChange: handleTextFilterChange,
    peopleFilters,
    onPeopleFilterChange: handlePeopleFilterChange,
    filterOptions: clientFilterOptions,
    loadingFilterOptions: dataSource?.fetchFilterOptions ? loadingFilterOptions : {},
    peopleSearch: dataSource?.searchPeople,
    getUserByEmail: dataSource?.getUserByEmail,
    layoutMode,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    emptyState: {
      hasActiveFilters,
      onClearAll: () => setFilters({}),
      message: emptyState?.message,
      render: emptyState?.render,
    },
  };

  return {
    dataGridProps,
    page,
    pageSize,
    displayTotalCount,
    setPage,
    setPageSize,
    columnChooserColumns,
    visibleColumns,
    handleVisibilityChange,
    title,
    toolbar,
    className,
    entityLabelPlural,
    emptyState,
    hasActiveFilters,
    setFilters,
  };
}
