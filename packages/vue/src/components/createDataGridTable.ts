/**
 * Shared DataGridTable factory for Vue UI packages.
 *
 * Both vue-vuetify and vue-primevue DataGridTable components are 97% identical  - 
 * they only differ in which checkbox and spinner components they render.
 * This factory extracts all shared logic into one place.
 */
import { defineComponent, computed, h, watch, type PropType, type VNode, Teleport, type Component } from 'vue';
import {
  useDataGridTableSetup,
  type UseDataGridTableSetupResult,
} from '../composables';
import {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
} from '../utils';
import { buildHeaderRows, CHECKBOX_COLUMN_WIDTH, ROW_NUMBER_COLUMN_WIDTH, ROW_NUMBER_COLUMN_ID, estimateHeaderMinWidth, indexToColumnLetter, formatCellReference, handleBooleanCellPointerDown } from '@alaarab/ogrid-core';
import { StatusBar } from './StatusBar';
import { MarchingAntsOverlay } from './MarchingAntsOverlay';
import { FormulaRefOverlay } from './FormulaRefOverlay';
import type { IOGridDataGridProps, IColumnDef, ICellEditorProps } from '../types';

const NOOP = () => {};

/** Framework-specific component bindings passed by each UI package */
export interface IDataGridTableUIBindings {
  /** Render a checkbox (Vuetify VCheckbox vs PrimeVue Checkbox) */
  renderCheckbox: (props: {
    modelValue: boolean;
    indeterminate?: boolean;
    ariaLabel: string;
    onChange: (checked: boolean) => void;
  }) => VNode;
  /** Render a loading spinner with message */
  renderSpinner: (message: string) => VNode;
  /** Package-local ColumnHeaderFilter component */
  ColumnHeaderFilter: Component;
  /** Package-local ColumnHeaderMenu component */
  ColumnHeaderMenu: Component;
  /** Package-local InlineCellEditor component */
  InlineCellEditor: Component;
  /** Package-local GridContextMenu component */
  GridContextMenu: Component;
  /** Package-local renderEmptyState function */
  renderEmptyState: (emptyState: { render?: () => unknown; message?: string | null; hasActiveFilters?: boolean; onClearAll?: () => void }) => VNode;
}

type EmptyStateCast = { render?: () => unknown; message?: string | null; hasActiveFilters?: boolean; onClearAll?: () => void };

/**
 * Creates a DataGridTable component with framework-specific UI bindings.
 * All grid logic, layout, and interaction handling is shared.
 */
export function createDataGridTable(ui: IDataGridTableUIBindings) {
  return defineComponent({
    name: 'DataGridTable',
    props: {
      gridProps: { type: Object as PropType<IOGridDataGridProps<unknown>>, required: true },
    },
    setup(props) {
      const propsRef = computed(() => props.gridProps);

      const {
        wrapperRef,
        tableContainerRef,
        tableRef,
        lastMouseShift,
        state,
        columnReorder: { isDragging: isReorderDragging, dropIndicatorX, handleHeaderMouseDown: handleReorderMouseDown },
        virtualScroll: { containerRef: vsContainerRef, visibleRange, totalHeight: _totalHeight, scrollToRow: _scrollToRow },
        virtualScrollEnabled,
        columnResize: { handleResizeStart, handleResizeDoubleClick, getColumnWidth },
        columnPartition,
        globalColIndexMap,
      } = useDataGridTableSetup({ props: propsRef }) as UseDataGridTableSetupResult<unknown>;

      // --- Name box: notify parent when active cell changes ---
      const rowNumberOffset = computed(() => {
        const p = propsRef.value;
        const hasRowNumbers = p.showRowNumbers || p.showColumnLetters;
        return hasRowNumbers ? ((p.currentPage ?? 1) - 1) * (p.pageSize ?? 25) : 0;
      });
      watch(
        [() => state.interaction.value.activeCell, rowNumberOffset],
        ([ac, offset]) => {
          const cb = propsRef.value.onActiveCellChange;
          if (!cb) return;
          if (ac) {
            cb(formatCellReference(ac.columnIndex - state.layout.value.colOffset, offset + ac.rowIndex + 1));
          } else {
            cb(null);
          }
        },
        { immediate: true },
      );

      // Stable handlers  -  avoid creating new closures per render
      const onWrapperPointerdown = (e: PointerEvent) => { lastMouseShift.value = e.shiftKey; };
      const preventSurfacePointerdown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
      };
      const preventSurfaceMousedown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
      };
      const preventSurfaceSelectstart = (e: Event) => {
        e.preventDefault();
      };
      const onContextmenu = (e: MouseEvent) => e.preventDefault();
      const stopPropagation = (e: MouseEvent) => e.stopPropagation();

      // Pre-compute header rows so buildHeaderRows is not called on every render
      const headerRowsComputed = computed(() => buildHeaderRows(propsRef.value.columns, propsRef.value.visibleColumns));

      // Pre-compute per-column layout metadata so it's only recalculated when
      // column config, sizing, pinning, or measured widths change  -  not on every
      // render (parity with React's columnMeta useMemo).
      const columnMetaCache = computed(() => {
        const layout = state.layout.value;
        const pinning = state.pinning.value;
        const { visibleCols, columnSizingOverrides, measuredColumnWidths } = layout;
        const { leftOffsets, rightOffsets } = pinning;

        const cellStyles: Record<string, Record<string, string>> = {};
        const cellClasses: Record<string, string> = {};
        const hdrStyles: Record<string, Record<string, string>> = {};
        const hdrClasses: Record<string, string> = {};

        for (let colIdx = 0; colIdx < visibleCols.length; colIdx++) {
          const col = visibleCols[colIdx];
          const isPinnedLeft = col.pinned === 'left';
          const isPinnedRight = col.pinned === 'right';
          const columnWidth = getColumnWidth(col);

          const hasResizeOverride = !!columnSizingOverrides[col.columnId];
          const measuredW = measuredColumnWidths[col.columnId];
          const baseMinWidth = col.minWidth ?? estimateHeaderMinWidth(col.name);
          const effectiveMinWidth = hasResizeOverride ? columnWidth : Math.max(baseMinWidth, measuredW ?? 0);

          // CSS width string (e.g. '100%') lets a column fill remaining space.
          const cssWidth = col.width;
          const tdStyle: Record<string, string> = {
            minWidth: `${effectiveMinWidth}px`,
            width: cssWidth ?? `${columnWidth}px`,
            ...(cssWidth ? {} : { maxWidth: `${columnWidth}px` }),
          };
          const hdrStyle: Record<string, string> = {
            minWidth: `${effectiveMinWidth}px`,
            width: cssWidth ?? `${columnWidth}px`,
            ...(cssWidth ? {} : { maxWidth: `${columnWidth}px` }),
          };

          const tdClassParts: string[] = ['ogrid-data-cell'];
          const hdrClassParts: string[] = ['ogrid-header-cell'];

          if (isPinnedLeft) {
            tdClassParts.push('ogrid-data-cell--pinned-left');
            tdStyle.left = `${leftOffsets[col.columnId] ?? 0}px`;
            hdrClassParts.push('ogrid-header-cell--pinned-left');
            hdrStyle.left = `${leftOffsets[col.columnId] ?? 0}px`;
          } else if (isPinnedRight) {
            tdClassParts.push('ogrid-data-cell--pinned-right');
            tdStyle.right = `${rightOffsets[col.columnId] ?? 0}px`;
            hdrClassParts.push('ogrid-header-cell--pinned-right');
            hdrStyle.right = `${rightOffsets[col.columnId] ?? 0}px`;
          }

          cellStyles[col.columnId] = tdStyle;
          cellClasses[col.columnId] = tdClassParts.join(' ');
          hdrStyles[col.columnId] = hdrStyle;
          hdrClasses[col.columnId] = hdrClassParts.join(' ');
        }

        return { cellStyles, cellClasses, hdrStyles, hdrClasses };
      });

      return () => {
        const p = props.gridProps;
        const layout = state.layout.value;
        const rowSel = state.rowSelection.value;
        const editing = state.editing.value;
        const interaction = state.interaction.value;
        const ctxMenu = state.contextMenu.value;
        const viewModels = state.viewModels.value;
        const pinning = state.pinning.value;
        const { headerMenu } = pinning;

        const {
          visibleCols, hasCheckboxCol, hasRowNumbersCol, colOffset: _colOffset, containerWidth, minTableWidth, desiredTableWidth,
        } = layout;

        const currentPage = p.currentPage ?? 1;
        const pageSize = p.pageSize ?? 25;
        const rowNumberOffset = hasRowNumbersCol ? (currentPage - 1) * pageSize : 0;

        const { selectedRowIds, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
        const { editingCell: _editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl } = editing;
        const {
          setActiveCell, setSelectionRange, handleCellMouseDown, handleSelectAllCells, selectionRange, hasCellSelection,
          handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste,
          cutRange: _cutRange, copyRange: _copyRange, canUndo, canRedo, onUndo, onRedo, isDragging: _isDragging,
        } = interaction;
        const { menuPosition, handleCellContextMenu, closeContextMenu } = ctxMenu;
        const { headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError } = viewModels;

        const items = p.items;
        const getRowId = p.getRowId;
        const layoutMode = p.layoutMode ?? 'fill';
        const rowSelection = p.rowSelection ?? 'none';
        const suppressHorizontalScroll = p.suppressHorizontalScroll;
        const stickyHeader = p.stickyHeader ?? true;
        const isLoading = p.isLoading ?? false;
        const loadingMessage = p.loadingMessage ?? 'Loading\u2026';
        const ariaLabel = p['aria-label'];
        const ariaLabelledBy = p['aria-labelledby'];

        const fitToContent = layoutMode === 'content';
        const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);

        const headerRows = headerRowsComputed.value;

        const editCallbacks = { commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit };
        const interactionHandlers = { handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu };

        const handleSingleRowClick = (e: MouseEvent) => {
          if (rowSelection !== 'single') return;
          const tr = (e.currentTarget as HTMLElement);
          const rowId = tr.dataset.rowId;
          if (!rowId) return;
          rowSel.updateSelection(selectedRowIds.has(rowId) ? new Set() : new Set([rowId]));
        };

        // Render a cell's content
        const renderCellContent = (item: unknown, col: IColumnDef<unknown>, rowIndex: number, colIdx: number): VNode | string | null => {
          try {
            return renderCellContentInner(item, col, rowIndex, colIdx);
          } catch (err) {
            if (onCellError) {
              onCellError(err instanceof Error ? err : new Error(String(err)), undefined);
            }
            return '';
          }
        };

        const renderCellContentInner = (item: unknown, col: IColumnDef<unknown>, rowIndex: number, colIdx: number): VNode | string | null => {
          const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInput);

          if (descriptor.mode === 'editing-inline') {
            const editorProps = buildInlineEditorProps(item, col, descriptor, editCallbacks);
            return h('div', { class: 'ogrid-editing-cell' },
              h(ui.InlineCellEditor, {
                value: editorProps.value,
                item: editorProps.item,
                column: editorProps.column,
                rowIndex: editorProps.rowIndex,
                editorType: editorProps.editorType,
                onCommit: editorProps.onCommit,
                onCancel: editorProps.onCancel,
              })
            );
          }

          if (descriptor.mode === 'editing-popover' && col.cellEditor != null && typeof col.cellEditor !== 'string') {
            const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValue, editCallbacks);
            const CustomEditor = col.cellEditor as unknown as ReturnType<typeof defineComponent>;
            const popoverDisplayContent = resolveCellDisplayContent(col, item, descriptor.displayValue);
            const popoverCellStyle = resolveCellStyle(col, item, descriptor.displayValue);
            return h('div', [
              h('div', {
                ref: (el: unknown) => { if (el) setPopoverAnchorEl(el as HTMLElement); },
                class: 'ogrid-popover-anchor',
              }, [
                popoverCellStyle
                  ? h('span', { style: popoverCellStyle }, [popoverDisplayContent as VNode | string])
                  : popoverDisplayContent as VNode | string,
              ]),
              popoverAnchorEl
                ? h(CustomEditor, editorProps as ICellEditorProps<unknown>)
                : null,
            ]);
          }

          // Display mode
          const interactionProps2 = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

          const cellClasses: string[] = ['ogrid-cell-content'];
          if (col.type === 'numeric') cellClasses.push('ogrid-cell-content--numeric');
          else if (col.type === 'boolean') cellClasses.push('ogrid-cell-content--boolean');
          if (descriptor.canEditAny) cellClasses.push('ogrid-cell-content--editable');
          if (descriptor.isActive) cellClasses.push('ogrid-cell-content--active');
          if (descriptor.isActive && descriptor.isInRange) cellClasses.push('ogrid-cell-content--active-in-range');
          if (descriptor.isInRange && !descriptor.isActive) cellClasses.push('ogrid-cell-in-range');
          if (descriptor.isInCutRange) cellClasses.push('ogrid-cell-cut');

          let displayNode: VNode | string | null;
          if (descriptor.columnType === 'boolean') {
            const boolVal = !!descriptor.displayValue;
            displayNode = h('input', {
              type: 'checkbox',
              checked: boolVal,
              disabled: !descriptor.canEditAny,
              onChange: descriptor.canEditAny ? () => {
                const savedRow = descriptor.rowIndex;
                const savedCol = descriptor.globalColIndex;
                editCallbacks.commitCellEdit(item, col.columnId, boolVal, !boolVal, savedRow, savedCol, { skipAdvance: true });
              } : undefined,
              onPointerdown: (e: PointerEvent) =>
                handleBooleanCellPointerDown(e, descriptor.rowIndex, descriptor.globalColIndex, _colOffset, {
                  setActiveCell,
                  setSelectionRange,
                }),
              onClick: (e: Event) => e.stopPropagation(),
              style: `margin:0;cursor:${descriptor.canEditAny ? 'pointer' : 'default'};outline:none`,
              'aria-label': boolVal ? 'Checked' : 'Unchecked',
            });
          } else {
            const content = resolveCellDisplayContent(col, item, descriptor.displayValue);
            const cellStyle = resolveCellStyle(col, item, descriptor.displayValue);
            displayNode = cellStyle
              ? h('span', { style: cellStyle }, content as string)
              : content as string;
          }

          return h('div', {
            ...interactionProps2,
            class: cellClasses.join(' '),
          }, [
            displayNode,
            ...(descriptor.canEditAny && descriptor.isSelectionEndCell ? [
              h('div', {
                onPointerdown: handleFillHandleMouseDown,
                'aria-label': 'Fill handle',
                class: 'ogrid-fill-handle',
              }),
            ] : []),
          ]);
        };

        // Use the pre-computed column metadata cache (computed in setup() for memoization)
        const { cellStyles: colCellStyles, cellClasses: colCellClasses, hdrStyles: colHdrStyles, hdrClasses: colHdrClasses } = columnMetaCache.value;

        // Build column layouts using cached metadata
        const allColumnLayouts = visibleCols.map((col: IColumnDef<unknown>) => ({
          col,
          tdClasses: colCellClasses[col.columnId] || 'ogrid-data-cell',
          tdDynamicStyle: colCellStyles[col.columnId] || {},
        }));

        // Filter column layouts by column virtualization partition when active
        const partition = columnPartition.value;
        let columnLayouts = allColumnLayouts;
        let leftSpacerWidth = 0;
        let rightSpacerWidth = 0;
        if (partition) {
          const visibleIds = new Set<string>();
          for (const col of partition.pinnedLeft) visibleIds.add(col.columnId);
          for (const col of partition.virtualizedUnpinned) visibleIds.add(col.columnId);
          for (const col of partition.pinnedRight) visibleIds.add(col.columnId);
          columnLayouts = allColumnLayouts.filter(cl => visibleIds.has(cl.col.columnId));
          leftSpacerWidth = partition.leftSpacerWidth;
          rightSpacerWidth = partition.rightSpacerWidth;
        }

        // Global column index map for correct cell descriptor indices during column virtualization
        const colIndexMap = globalColIndexMap.value;

        // Header class+style lookup using cached metadata
        const getHeaderClassAndStyle = (col: IColumnDef<unknown>): { classes: string; style: Record<string, string> } => {
          const base = colHdrStyles[col.columnId] || {};
          // cursor depends on drag state  -  add it at render time (not cached)
          return {
            classes: colHdrClasses[col.columnId] || 'ogrid-header-cell',
            style: { ...base, cursor: isReorderDragging.value ? 'grabbing' : 'grab' },
          };
        };

        // Dynamic wrapper style.
        // Virtual scroll needs flex: 1 + minHeight: 0 so the container has a measurable height
        // for VS math. Non-virtual-scroll uses auto height so the grid shrinks to fit its rows.
        const vsOn = virtualScrollEnabled.value;
        const wrapperStyle: Record<string, string> = {
          position: 'relative',
          width: fitToContent ? 'fit-content' : '100%',
          maxWidth: '100%',
          overflowX: suppressHorizontalScroll ? 'hidden' : allowOverflowX ? 'auto' : 'hidden',
          overflowY: 'auto',
          backgroundColor: '#fff',
          willChange: 'scroll-position',
          ...(vsOn
            ? { flex: '1', minHeight: '0' }
            : { minHeight: isLoading && items.length === 0 ? '200px' : 'auto' }),
        };
        if (p.rowHeight) {
          wrapperStyle['--ogrid-row-height'] = `${p.rowHeight}px`;
        }

        return h('div', { class: 'ogrid-outer-container' }, [
          // Scrollable wrapper
          h('div', {
            ref: (el: unknown) => { wrapperRef.value = el as HTMLDivElement; vsContainerRef.value = el as HTMLElement; },
            tabindex: 0,
            role: 'region',
            'aria-label': ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid'),
            'aria-labelledby': ariaLabelledBy,
            onPointerdown: onWrapperPointerdown,
            onKeydown: handleGridKeyDown,
            onContextmenu,
            'data-overflow-x': allowOverflowX ? 'true' : 'false',
            'data-ogrid-scroll-container': '',
            style: wrapperStyle,
          }, [
            h('div', { class: 'ogrid-scroll-wrapper' }, [
              h('div', { style: { minWidth: allowOverflowX ? `${minTableWidth}px` : undefined, overflowX: 'clip' } }, [
                h('div', {
                  ref: (el: unknown) => { tableContainerRef.value = el as HTMLDivElement; },
                  class: ['ogrid-table-container', isLoading && items.length > 0 ? 'ogrid-table-container--loading' : ''],
                }, [
                  // Drop indicator for column reorder
                  ...(isReorderDragging.value && dropIndicatorX.value !== null ? [
                    h('div', {
                      class: 'ogrid-drop-indicator',
                      style: { left: `${dropIndicatorX.value}px` },
                    }),
                  ] : []),

                  // Table
                  h('table', {
                    ref: (el: unknown) => { tableRef.value = el as HTMLElement; },
                    class: 'ogrid-table',
                    role: 'grid',
                    style: { minWidth: `${minTableWidth}px` },
                    ...(virtualScrollEnabled.value ? { 'data-virtual-scroll': '' } : {}),
                  }, [
                    // Header
                    h('thead', { class: stickyHeader ? 'ogrid-thead ogrid-sticky-header' : 'ogrid-thead' }, [
                      // Column letter row (A, B, C...) for cell references
                      ...(p.showColumnLetters ? [
                        h('tr', { class: 'ogrid-column-letter-row' }, [
                          ...(hasCheckboxCol ? [h('th', { class: 'ogrid-column-letter-cell' })] : []),
                          ...(hasRowNumbersCol ? [h('th', { class: 'ogrid-column-letter-cell' })] : []),
                          ...visibleCols.map((col: IColumnDef<unknown>, colIdx: number) => {
                            const { classes: hdrCls, style: hdrSty } = getHeaderClassAndStyle(col);
                            return h('th', {
                              key: col.columnId,
                              class: `ogrid-column-letter-cell ${hdrCls}`,
                              style: hdrSty,
                            }, indexToColumnLetter(colIdx));
                          }),
                        ]),
                      ] : []),
                      ...headerRows.map((row, rowIdx) =>
                        h('tr', { key: rowIdx, class: 'ogrid-header-row' }, [
                          // Checkbox header cell
                          ...(rowIdx === headerRows.length - 1 && hasCheckboxCol ? [
                            h('th', {
                              class: 'ogrid-checkbox-header',
                              style: {
                                width: `${CHECKBOX_COLUMN_WIDTH}px`,
                                minWidth: `${CHECKBOX_COLUMN_WIDTH}px`,
                                maxWidth: `${CHECKBOX_COLUMN_WIDTH}px`,
                              },
                            },
                              ui.renderCheckbox({
                                modelValue: allSelected,
                                // Indeterminate only when some (but not all) rows are selected
                                indeterminate: someSelected && !allSelected,
                                ariaLabel: 'Select all rows',
                                onChange: (c) => handleSelectAll(!!c),
                              })
                            ),
                          ] : []),
                          // Checkbox spacer in group header row
                          ...(rowIdx === 0 && rowIdx < headerRows.length - 1 && hasCheckboxCol ? [
                            h('th', {
                              rowSpan: headerRows.length - 1,
                              class: 'ogrid-checkbox-spacer',
                              style: { width: `${CHECKBOX_COLUMN_WIDTH}px`, minWidth: `${CHECKBOX_COLUMN_WIDTH}px` },
                            }),
                          ] : []),
                          // Row numbers header
                          ...(rowIdx === headerRows.length - 1 && hasRowNumbersCol ? [(() => {
                            const rnw = layout.columnSizingOverrides[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
                            return h('th', {
                              class: 'ogrid-row-number-header',
                              style: {
                                width: `${rnw}px`,
                                minWidth: `${rnw}px`,
                                maxWidth: `${rnw}px`,
                                position: 'sticky',
                                left: hasCheckboxCol ? `${CHECKBOX_COLUMN_WIDTH}px` : '0',
                                zIndex: 3,
                                },
                                onPointerdown: preventSurfacePointerdown,
                                onMousedown: preventSurfaceMousedown,
                                onSelectstart: preventSurfaceSelectstart,
                              }, [
                              '#',
                              h('div', {
                                onPointerdown: (e: PointerEvent) => {
                                  setActiveCell(null);
                                  setSelectionRange(null);
                                  wrapperRef.value?.focus({ preventScroll: true });
                                  e.stopPropagation();
                                  handleResizeStart(e, { columnId: ROW_NUMBER_COLUMN_ID, name: '#' } as IColumnDef<unknown>);
                                },
                                class: 'ogrid-resize-handle',
                                role: 'separator',
                                'aria-label': 'Resize row numbers',
                              }),
                            ]);
                          })()] : []),
                          // Row numbers spacer
                          ...(rowIdx === 0 && rowIdx < headerRows.length - 1 && hasRowNumbersCol ? [(() => {
                            const spacerRnw = layout.columnSizingOverrides[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
                            return h('th', {
                              rowSpan: headerRows.length - 1,
                              class: 'ogrid-row-number-spacer',
                              style: {
                                width: `${spacerRnw}px`,
                                position: 'sticky',
                                left: hasCheckboxCol ? `${CHECKBOX_COLUMN_WIDTH}px` : '0',
                                zIndex: 3,
                              },
                            });
                          })()] : []),
                          // Header cells
                          ...row.map((cell, cellIdx) => {
                            if (cell.isGroup) {
                              return h('th', {
                                key: cellIdx,
                                colSpan: cell.colSpan,
                                scope: 'colgroup',
                                class: 'ogrid-column-group-header',
                              }, cell.label);
                            }
                            if (!cell.columnDef) return null;
                            const col = cell.columnDef as IColumnDef<unknown>;
                            const { classes: headerClasses, style: headerStyle } = getHeaderClassAndStyle(col);
                            const isSorted = p.sortBy === col.columnId;
                            const ariaSort = isSorted
                              ? (p.sortDirection === 'asc' ? 'ascending' : 'descending')
                              : undefined;
                            return h('th', {
                              key: col.columnId,
                              scope: 'col',
                              'data-column-id': col.columnId,
                              rowSpan: headerRows.length > 1 ? headerRows.length - rowIdx : undefined,
                              class: headerClasses,
                              style: headerStyle,
                              'aria-sort': ariaSort,
                              onPointerdown: (e: PointerEvent) => handleReorderMouseDown(col.columnId, e),
                            }, [
                              h('div', { class: 'ogrid-header-content' }, [
                                h(ui.ColumnHeaderFilter, getHeaderFilterConfig(col, headerFilterInput)),
                                h('button', {
                                  onClick: (e: MouseEvent) => {
                                    e.stopPropagation();
                                    if (headerMenu.isOpen && headerMenu.openForColumn === col.columnId) {
                                      headerMenu.close();
                                    } else {
                                      headerMenu.open(col.columnId, e.currentTarget as HTMLElement);
                                    }
                                  },
                                  'aria-label': 'Column options',
                                  title: 'Column options',
                                  class: 'ogrid-column-menu-btn',
                                }, '\u22EE'),
                              ]),
                              h('div', {
                                onPointerdown: (e: PointerEvent) => {
                                  // Clear cell selection/focus before resize so outlines
                                  // and focus rings don't persist during drag (parity with React).
                                  setActiveCell(null);
                                  setSelectionRange(null);
                                  wrapperRef.value?.focus({ preventScroll: true });
                                  e.stopPropagation();
                                  handleResizeStart(e, col);
                                },
                                onDblclick: (e: PointerEvent) => handleResizeDoubleClick(e, col),
                                class: 'ogrid-resize-handle',
                                role: 'separator',
                                'aria-label': `Resize ${col.name ?? col.columnId}`,
                              }),
                            ]);
                          }),
                        ])
                      ),
                    ]),

                    // Body
                    ...(!showEmptyInGrid ? [
                      h('tbody', {}, (() => {
                        const vsEnabled = virtualScrollEnabled.value;
                        const vr = visibleRange.value;
                        const startIdx = vsEnabled ? vr.startIndex : 0;
                        const endIdx = vsEnabled ? Math.min(vr.endIndex, items.length - 1) : items.length - 1;
                        const rows: VNode[] = [];

                        if (vsEnabled && vr.offsetTop > 0) {
                          rows.push(h('tr', { key: '__vs-top', style: { height: `${vr.offsetTop}px` } }));
                        }

                        for (let rowIndex = startIdx; rowIndex <= endIdx; rowIndex++) {
                          const item = items[rowIndex];
                          if (!item) continue;
                          const rowIdStr = getRowId(item);
                          const isSelected = selectedRowIds.has(rowIdStr);
                          rows.push(h('tr', {
                            key: rowIdStr,
                            'data-row-id': rowIdStr,
                            'aria-selected': isSelected || undefined,
                            onClick: handleSingleRowClick,
                            style: { cursor: rowSelection === 'single' ? 'pointer' : undefined },
                          }, [
                            // Checkbox cell
                            ...(hasCheckboxCol ? [
                              h('td', {
                                class: 'ogrid-checkbox-cell',
                                style: {
                                  width: `${CHECKBOX_COLUMN_WIDTH}px`,
                                  minWidth: `${CHECKBOX_COLUMN_WIDTH}px`,
                                  maxWidth: `${CHECKBOX_COLUMN_WIDTH}px`,
                                },
                              },
                                h('div', {
                                  'data-row-index': rowIndex,
                                  'data-col-index': 0,
                                  onClick: stopPropagation,
                                  class: 'ogrid-checkbox-wrapper',
                                },
                                  ui.renderCheckbox({
                                    modelValue: isSelected,
                                    ariaLabel: `Select row ${rowIndex + 1}`,
                                    onChange: (checked) =>
                                      handleRowCheckboxChange(rowIdStr, checked, rowIndex, lastMouseShift.value),
                                  })
                                )
                              ),
                            ] : []),
                            // Row numbers cell
                            ...(hasRowNumbersCol ? [(() => {
                              const rnw = layout.columnSizingOverrides[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH;
                              return h('td', {
                                class: 'ogrid-row-number-cell',
                                style: {
                                  width: `${rnw}px`,
                                  minWidth: `${rnw}px`,
                                  maxWidth: `${rnw}px`,
                                  padding: '6px',
                                  position: 'sticky',
                                  left: hasCheckboxCol ? `${CHECKBOX_COLUMN_WIDTH}px` : '0',
                                  zIndex: 2,
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none',
                                },
                                onPointerdown: preventSurfacePointerdown,
                                onMousedown: preventSurfaceMousedown,
                                onSelectstart: preventSurfaceSelectstart,
                              }, String(rowNumberOffset + rowIndex + 1));
                            })()] : []),
                            // Left spacer for column virtualization
                            ...(leftSpacerWidth > 0 ? [
                              h('td', { key: '__col-spacer-left', style: { width: `${leftSpacerWidth}px`, minWidth: `${leftSpacerWidth}px`, maxWidth: `${leftSpacerWidth}px`, padding: '0' } }),
                            ] : []),
                            // Data cells
                            ...columnLayouts.map((cl: { col: IColumnDef<unknown>; tdClasses: string; tdDynamicStyle: Record<string, string> }) =>
                              h('td', {
                                key: cl.col.columnId,
                                'data-column-id': cl.col.columnId,
                                class: cl.tdClasses,
                                style: {
                                  ...cl.tdDynamicStyle,
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none',
                                },
                                onPointerdown: preventSurfacePointerdown,
                                onMousedown: preventSurfaceMousedown,
                                onSelectstart: preventSurfaceSelectstart,
                              }, [renderCellContent(item, cl.col, rowIndex, colIndexMap.get(cl.col.columnId) ?? 0)])
                            ),
                            // Right spacer for column virtualization
                            ...(rightSpacerWidth > 0 ? [
                              h('td', { key: '__col-spacer-right', style: { width: `${rightSpacerWidth}px`, minWidth: `${rightSpacerWidth}px`, maxWidth: `${rightSpacerWidth}px`, padding: '0' } }),
                            ] : []),
                          ]));
                        }

                        if (vsEnabled && vr.offsetBottom > 0) {
                          rows.push(h('tr', { key: '__vs-bottom', style: { height: `${vr.offsetBottom}px` } }));
                        }

                        return rows;
                      })()),
                    ] : []),
                  ]),

                  // Empty state
                  ...(showEmptyInGrid && p.emptyState ? [
                    ui.renderEmptyState(p.emptyState as EmptyStateCast),
                  ] : []),
                ]),
              ]),
            ]),
          ]),

          // Context menu (teleported to body)
          ...(menuPosition ? [
            h(Teleport, { to: 'body' },
              h(ui.GridContextMenu, {
                x: menuPosition.x,
                y: menuPosition.y,
                hasSelection: hasCellSelection,
                canUndo,
                canRedo,
                onUndo: onUndo ?? NOOP,
                onRedo: onRedo ?? NOOP,
                onCopy: handleCopy,
                onCut: handleCut,
                onPaste: () => { void handlePaste(); },
                onSelectAll: handleSelectAllCells,
                onClose: closeContextMenu,
              })
            ),
          ] : []),

          // Marching ants overlay
          h(MarchingAntsOverlay, {
            containerRef: tableContainerRef,
            selectionRange,
            copyRange: _copyRange,
            cutRange: _cutRange,
            colOffset: _colOffset,
            items,
            visibleColumns: p.visibleColumns instanceof Set ? Array.from(p.visibleColumns) : p.visibleColumns,
            columnSizingOverrides: layout.columnSizingOverrides,
            columnOrder: p.columnOrder,
          }),

          // Formula reference overlay
          ...(p.formulaReferences && p.formulaReferences.length > 0 ? [
            h(FormulaRefOverlay, {
              containerEl: tableContainerRef.value,
              references: p.formulaReferences,
              colOffset: _colOffset,
            }),
          ] : []),

          // Column header menu
          h(ui.ColumnHeaderMenu, {
            isOpen: headerMenu.isOpen,
            anchorElement: headerMenu.anchorElement,
            onClose: headerMenu.close,
            onPinLeft: headerMenu.handlePinLeft,
            onPinRight: headerMenu.handlePinRight,
            onUnpin: headerMenu.handleUnpin,
            onSortAsc: headerMenu.handleSortAsc,
            onSortDesc: headerMenu.handleSortDesc,
            onClearSort: headerMenu.handleClearSort,
            onAutosizeThis: headerMenu.handleAutosizeThis,
            onAutosizeAll: headerMenu.handleAutosizeAll,
            canPinLeft: headerMenu.canPinLeft,
            canPinRight: headerMenu.canPinRight,
            canUnpin: headerMenu.canUnpin,
            currentSort: headerMenu.currentSort,
            isSortable: headerMenu.isSortable,
            isResizable: headerMenu.isResizable,
          }),

          // Status bar
          ...(statusBarConfig ? [
            h(StatusBar, {
              totalCount: statusBarConfig.totalCount,
              filteredCount: statusBarConfig.filteredCount,
              selectedCount: statusBarConfig.selectedCount ?? selectedRowIds.size,
              selectedCellCount: selectionRange
                ? (Math.abs(selectionRange.endRow - selectionRange.startRow) + 1) * (Math.abs(selectionRange.endCol - selectionRange.startCol) + 1)
                : undefined,
              aggregation: statusBarConfig.aggregation,
              suppressRowCount: statusBarConfig.suppressRowCount,
            }),
          ] : []),

          // Loading overlay
          ...(isLoading ? [
            h('div', { class: 'ogrid-loading-overlay' },
              ui.renderSpinner(loadingMessage)
            ),
          ] : []),
        ]);
      };
    },
  });
}
