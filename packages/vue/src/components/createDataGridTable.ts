/**
 * Shared DataGridTable factory for Vue UI packages.
 *
 * Both vue-vuetify and vue-primevue DataGridTable components are 97% identical —
 * they only differ in which checkbox and spinner components they render.
 * This factory extracts all shared logic into one place.
 */
import { defineComponent, computed, h, type PropType, type VNode, Teleport, type Component } from 'vue';
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
import { buildHeaderRows, CHECKBOX_COLUMN_WIDTH, ROW_NUMBER_COLUMN_WIDTH, DEFAULT_MIN_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { StatusBar } from './StatusBar';
import { MarchingAntsOverlay } from './MarchingAntsOverlay';
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
        columnResize: { handleResizeStart, getColumnWidth },
      } = useDataGridTableSetup({ props: propsRef }) as UseDataGridTableSetupResult<unknown>;

      // Stable handlers — avoid creating new closures per render
      const onWrapperMousedown = (e: MouseEvent) => { lastMouseShift.value = e.shiftKey; };
      const onContextmenu = (e: MouseEvent) => e.preventDefault();
      const stopPropagation = (e: MouseEvent) => e.stopPropagation();

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
          setActiveCell, handleCellMouseDown, handleSelectAllCells, selectionRange, hasCellSelection,
          handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste,
          cutRange: _cutRange, copyRange: _copyRange, canUndo, canRedo, onUndo, onRedo, isDragging: _isDragging,
        } = interaction;
        const { menuPosition, handleCellContextMenu, closeContextMenu } = ctxMenu;
        const { headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError: _onCellError } = viewModels;

        const items = p.items;
        const getRowId = p.getRowId;
        const layoutMode = p.layoutMode ?? 'fill';
        const rowSelection = p.rowSelection ?? 'none';
        const freezeRows = p.freezeRows;
        const freezeCols = p.freezeCols;
        const suppressHorizontalScroll = p.suppressHorizontalScroll;
        const isLoading = p.isLoading ?? false;
        const loadingMessage = p.loadingMessage ?? 'Loading\u2026';
        const ariaLabel = p['aria-label'];
        const ariaLabelledBy = p['aria-labelledby'];

        const fitToContent = layoutMode === 'content';
        const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);

        const headerRows = buildHeaderRows(p.columns, p.visibleColumns);

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
          const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInput);

          if (descriptor.mode === 'editing-inline') {
            const editorProps = buildInlineEditorProps(item, col, descriptor, editCallbacks);
            return h(ui.InlineCellEditor, {
              value: editorProps.value,
              item: editorProps.item,
              column: editorProps.column,
              rowIndex: editorProps.rowIndex,
              editorType: editorProps.editorType,
              onCommit: editorProps.onCommit,
              onCancel: editorProps.onCancel,
            });
          }

          if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
            const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValue, editCallbacks);
            const CustomEditor = col.cellEditor as unknown as ReturnType<typeof defineComponent>;
            return h('div', [
              h('div', {
                ref: (el: unknown) => { if (el) setPopoverAnchorEl(el as HTMLElement); },
                class: 'ogrid-popover-anchor',
                'aria-hidden': 'true',
              }),
              popoverAnchorEl
                ? h(CustomEditor, editorProps as ICellEditorProps<unknown>)
                : null,
            ]);
          }

          // Display mode
          const content = resolveCellDisplayContent(col, item, descriptor.displayValue);
          const cellStyle = resolveCellStyle(col, item);
          const interactionProps2 = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

          const cellClasses: string[] = ['ogrid-cell-content'];
          if (col.type === 'numeric') cellClasses.push('ogrid-cell-content--numeric');
          else if (col.type === 'boolean') cellClasses.push('ogrid-cell-content--boolean');
          if (descriptor.canEditAny) cellClasses.push('ogrid-cell-content--editable');
          if (descriptor.isActive && !descriptor.isInRange) cellClasses.push('ogrid-cell-content--active');
          if (descriptor.isInRange) cellClasses.push('ogrid-cell-in-range');
          if (descriptor.isInCutRange) cellClasses.push('ogrid-cell-cut');

          const styledContent = cellStyle
            ? h('span', { style: cellStyle }, content as string)
            : content as string;

          return h('div', {
            ...interactionProps2,
            class: cellClasses.join(' '),
          }, [
            styledContent,
            ...(descriptor.canEditAny && descriptor.isSelectionEndCell ? [
              h('div', {
                onMousedown: handleFillHandleMouseDown,
                'aria-label': 'Fill handle',
                class: 'ogrid-fill-handle',
              }),
            ] : []),
          ]);
        };

        // Pre-computed pinning offsets
        const leftOffsets = pinning.leftOffsets;
        const rightOffsets = pinning.rightOffsets;

        // Build column layouts
        const columnLayouts = visibleCols.map((col: IColumnDef<unknown>, colIdx: number) => {
          const isFreezeCol = freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
          const isPinnedLeft = col.pinned === 'left';
          const isPinnedRight = col.pinned === 'right';
          const columnWidth = getColumnWidth(col);

          const tdClasses: string[] = ['ogrid-data-cell'];
          const tdDynamicStyle: Record<string, string> = {
            minWidth: `${col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH}px`,
            width: `${columnWidth}px`,
            maxWidth: `${columnWidth}px`,
          };

          if (isPinnedLeft || (isFreezeCol && colIdx === 0)) {
            tdClasses.push('ogrid-data-cell--pinned-left');
            tdDynamicStyle.left = `${leftOffsets[col.columnId] ?? 0}px`;
          } else if (isPinnedRight) {
            tdClasses.push('ogrid-data-cell--pinned-right');
            tdDynamicStyle.right = `${rightOffsets[col.columnId] ?? 0}px`;
          }

          return { col, tdClasses: tdClasses.join(' '), tdDynamicStyle };
        });

        // Build header cell classes + dynamic styles
        const getHeaderClassAndStyle = (col: IColumnDef<unknown>, colIdx: number): { classes: string; style: Record<string, string> } => {
          const isFreezeCol = freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
          const isPinnedLeft = col.pinned === 'left';
          const isPinnedRight = col.pinned === 'right';
          const columnWidth = getColumnWidth(col);

          const classes: string[] = ['ogrid-header-cell'];
          const style: Record<string, string> = {
            cursor: isReorderDragging.value ? 'grabbing' : 'grab',
            minWidth: `${col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH}px`,
            width: `${columnWidth}px`,
            maxWidth: `${columnWidth}px`,
          };

          if (isPinnedLeft || (isFreezeCol && colIdx === 0)) {
            classes.push('ogrid-header-cell--pinned-left');
            style.left = `${leftOffsets[col.columnId] ?? 0}px`;
          } else if (isPinnedRight) {
            classes.push('ogrid-header-cell--pinned-right');
            style.right = `${rightOffsets[col.columnId] ?? 0}px`;
          }

          return { classes: classes.join(' '), style };
        };

        // Dynamic wrapper style
        const wrapperStyle: Record<string, string> = {
          position: 'relative',
          flex: '1',
          minHeight: isLoading && items.length === 0 ? '200px' : '0',
          width: fitToContent ? 'fit-content' : '100%',
          maxWidth: '100%',
          overflowX: suppressHorizontalScroll ? 'hidden' : allowOverflowX ? 'auto' : 'hidden',
          overflowY: 'auto',
          backgroundColor: '#fff',
          willChange: 'scroll-position',
        };

        return h('div', { class: 'ogrid-outer-container' }, [
          // Scrollable wrapper
          h('div', {
            ref: (el: unknown) => { wrapperRef.value = el as HTMLDivElement; vsContainerRef.value = el as HTMLElement; },
            tabindex: 0,
            role: 'region',
            'aria-label': ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid'),
            'aria-labelledby': ariaLabelledBy,
            onMousedown: onWrapperMousedown,
            onKeydown: handleGridKeyDown,
            onContextmenu,
            'data-overflow-x': allowOverflowX ? 'true' : 'false',
            style: wrapperStyle,
          }, [
            h('div', { class: 'ogrid-scroll-wrapper' }, [
              h('div', { style: { minWidth: allowOverflowX ? `${minTableWidth}px` : undefined } }, [
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
                    style: { minWidth: `${minTableWidth}px` },
                    'data-freeze-rows': freezeRows != null && freezeRows >= 1 ? freezeRows : undefined,
                    'data-freeze-cols': freezeCols != null && freezeCols >= 1 ? freezeCols : undefined,
                  }, [
                    // Header
                    h('thead', { class: 'ogrid-thead' },
                      headerRows.map((row, rowIdx) =>
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
                                indeterminate: someSelected,
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
                          ...(rowIdx === headerRows.length - 1 && hasRowNumbersCol ? [
                            h('th', {
                              class: 'ogrid-row-number-header',
                              style: {
                                width: `${ROW_NUMBER_COLUMN_WIDTH}px`,
                                minWidth: `${ROW_NUMBER_COLUMN_WIDTH}px`,
                                maxWidth: `${ROW_NUMBER_COLUMN_WIDTH}px`,
                                position: 'sticky',
                                left: hasCheckboxCol ? `${CHECKBOX_COLUMN_WIDTH}px` : '0',
                                zIndex: 3,
                              },
                            }, '#'),
                          ] : []),
                          // Row numbers spacer
                          ...(rowIdx === 0 && rowIdx < headerRows.length - 1 && hasRowNumbersCol ? [
                            h('th', {
                              rowSpan: headerRows.length - 1,
                              class: 'ogrid-row-number-spacer',
                              style: {
                                width: `${ROW_NUMBER_COLUMN_WIDTH}px`,
                                position: 'sticky',
                                left: hasCheckboxCol ? `${CHECKBOX_COLUMN_WIDTH}px` : '0',
                                zIndex: 3,
                              },
                            }),
                          ] : []),
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
                            const col = cell.columnDef! as IColumnDef<unknown>;
                            const colIdx = visibleCols.indexOf(col);
                            const { classes: headerClasses, style: headerStyle } = getHeaderClassAndStyle(col, colIdx);
                            return h('th', {
                              key: col.columnId,
                              scope: 'col',
                              'data-column-id': col.columnId,
                              rowSpan: headerRows.length > 1 ? headerRows.length - rowIdx : undefined,
                              class: headerClasses,
                              style: headerStyle,
                              onMousedown: (e: MouseEvent) => handleReorderMouseDown(col.columnId, e),
                            }, [
                              h('div', { class: 'ogrid-header-content' }, [
                                h(ui.ColumnHeaderFilter, getHeaderFilterConfig(col, headerFilterInput)),
                                h('button', {
                                  onClick: (e: MouseEvent) => {
                                    e.stopPropagation();
                                    headerMenu.open(col.columnId, e.currentTarget as HTMLElement);
                                  },
                                  'aria-label': 'Column options',
                                  title: 'Column options',
                                  class: 'ogrid-column-menu-btn',
                                }, '\u22EE'),
                              ]),
                              h('div', {
                                onMousedown: (e: MouseEvent) => { e.stopPropagation(); handleResizeStart(e, col); },
                                class: 'ogrid-resize-handle',
                              }),
                            ]);
                          }),
                        ])
                      )
                    ),

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
                            ...(hasRowNumbersCol ? [
                              h('td', {
                                class: 'ogrid-row-number-cell',
                                style: {
                                  width: `${ROW_NUMBER_COLUMN_WIDTH}px`,
                                  minWidth: `${ROW_NUMBER_COLUMN_WIDTH}px`,
                                  maxWidth: `${ROW_NUMBER_COLUMN_WIDTH}px`,
                                  padding: '6px',
                                  position: 'sticky',
                                  left: hasCheckboxCol ? `${CHECKBOX_COLUMN_WIDTH}px` : '0',
                                  zIndex: 2,
                                },
                              }, String(rowNumberOffset + rowIndex + 1)),
                            ] : []),
                            // Data cells
                            ...columnLayouts.map((cl: { col: IColumnDef<unknown>; tdClasses: string; tdDynamicStyle: Record<string, string> }, colIdx: number) =>
                              h('td', {
                                key: cl.col.columnId,
                                'data-column-id': cl.col.columnId,
                                class: cl.tdClasses,
                                style: cl.tdDynamicStyle,
                              }, [renderCellContent(item, cl.col, rowIndex, colIdx)])
                            ),
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
