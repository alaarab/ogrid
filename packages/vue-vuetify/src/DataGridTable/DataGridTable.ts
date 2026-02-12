import { defineComponent, ref, computed, h, type PropType, type VNode, Teleport } from 'vue';
import { VCheckbox, VProgressCircular, VBtn } from 'vuetify/components';
import {
  useDataGridState,
  useColumnResize,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
  buildHeaderRows,
  CHECKBOX_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  type IOGridDataGridProps,
  type IColumnDef,
  type ICellEditorProps,
} from '@alaarab/ogrid-vue';
import { ColumnHeaderFilter } from '../ColumnHeaderFilter';
import { InlineCellEditor } from './InlineCellEditor';
import { StatusBar } from './StatusBar';
import { GridContextMenu } from './GridContextMenu';

const NOOP = () => {};

export const DataGridTable = defineComponent({
  name: 'DataGridTable',
  props: {
    // Pass all IOGridDataGridProps as a single prop object for simplicity with generics
    gridProps: { type: Object as PropType<IOGridDataGridProps<unknown>>, required: true },
  },
  setup(props) {
    const wrapperRef = ref<HTMLDivElement | null>(null);
    const tableContainerRef = ref<HTMLDivElement | null>(null);
    const lastMouseShift = ref(false);
    const propsRef = computed(() => props.gridProps);

    const state = useDataGridState({ props: propsRef, wrapperRef });

    return () => {
      const p = props.gridProps;
      const layout = state.layout.value;
      const rowSel = state.rowSelection.value;
      const editing = state.editing.value;
      const interaction = state.interaction.value;
      const ctxMenu = state.contextMenu.value;
      const viewModels = state.viewModels.value;

      const {
        visibleCols, hasCheckboxCol, colOffset, containerWidth, minTableWidth, desiredTableWidth,
        columnSizingOverrides, setColumnSizingOverrides,
      } = layout;

      const { selectedRowIds, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
      const { editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl } = editing;
      const {
        setActiveCell, handleCellMouseDown, handleSelectAllCells, selectionRange, hasCellSelection,
        handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste,
        cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging,
      } = interaction;
      const { menuPosition, handleCellContextMenu, closeContextMenu } = ctxMenu;
      const { headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError } = viewModels;

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

      const { handleResizeStart, getColumnWidth } = useColumnResize({
        columnSizingOverrides: computed(() => columnSizingOverrides),
        setColumnSizingOverrides,
      });

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
        const rowId = getRowId(item);

        if (descriptor.mode === 'editing-inline') {
          const editorProps = buildInlineEditorProps(item, col, descriptor, editCallbacks);
          return h(InlineCellEditor as any, {
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
          // For Vue, custom editors are components
          const CustomEditor = col.cellEditor as unknown as ReturnType<typeof defineComponent>;
          return h('div', [
            h('div', {
              ref: (el: unknown) => { if (el) setPopoverAnchorEl(el as HTMLElement); },
              style: { minHeight: '100%', minWidth: '40px' },
              'aria-hidden': 'true',
            }),
            // Render custom editor inline (Vue doesn't have Popover built-in to Vuetify in this pattern)
            popoverAnchorEl
              ? h(CustomEditor, editorProps as ICellEditorProps<unknown>)
              : null,
          ]);
        }

        // Display mode
        const content = resolveCellDisplayContent(col, item, descriptor.displayValue);
        const cellStyle = resolveCellStyle(col, item);
        const interactionProps = getCellInteractionProps(descriptor, col.columnId, interactionHandlers);

        // Compute cell CSS classes based on state
        const cellClasses: string[] = ['ogrid-cell'];
        const cellInlineStyle: Record<string, string> = {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          minWidth: '0',
          padding: '6px 10px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          outline: 'none',
        };

        if (col.type === 'numeric') {
          cellInlineStyle.justifyContent = 'flex-end';
          cellInlineStyle.textAlign = 'right';
        } else if (col.type === 'boolean') {
          cellInlineStyle.justifyContent = 'center';
          cellInlineStyle.textAlign = 'center';
        }

        if (descriptor.canEditAny) {
          cellInlineStyle.cursor = 'cell';
        }

        if (descriptor.isActive && !descriptor.isInRange) {
          cellInlineStyle.outline = '2px solid var(--ogrid-selection, #217346)';
          cellInlineStyle.outlineOffset = '-1px';
          cellInlineStyle.zIndex = '2';
          cellInlineStyle.position = 'relative';
          cellInlineStyle.overflow = 'visible';
        }

        if (descriptor.isInRange) {
          cellInlineStyle.backgroundColor = 'var(--ogrid-bg-range, rgba(33, 115, 70, 0.12))';
        }

        if (descriptor.isInCutRange) {
          cellInlineStyle.backgroundColor = 'rgba(0,0,0,0.04)';
          cellInlineStyle.opacity = '0.7';
        }

        const styledContent = cellStyle
          ? h('span', { style: cellStyle }, content as string)
          : content as string;

        return h('div', {
          ...interactionProps,
          style: cellInlineStyle,
        }, [
          styledContent,
          ...(descriptor.canEditAny && descriptor.isSelectionEndCell ? [
            h('div', {
              onMousedown: handleFillHandleMouseDown,
              'aria-label': 'Fill handle',
              style: {
                position: 'absolute',
                right: '-3px',
                bottom: '-3px',
                width: '7px',
                height: '7px',
                backgroundColor: 'var(--ogrid-selection, #217346)',
                border: '1px solid var(--ogrid-bg, #fff)',
                borderRadius: '1px',
                cursor: 'crosshair',
                pointerEvents: 'auto',
                zIndex: '3',
              },
            }),
          ] : []),
        ]);
      };

      // Build column layouts
      const columnLayouts = visibleCols.map((col, colIdx) => {
        const isFreezeCol = freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
        const isPinnedLeft = col.pinned === 'left';
        const isPinnedRight = col.pinned === 'right';
        const columnWidth = getColumnWidth(col);
        const tdStyle: Record<string, string> = {
          position: 'relative',
          padding: '0',
          height: '1px',
        };
        if (isPinnedLeft || (isFreezeCol && colIdx === 0)) {
          tdStyle.position = 'sticky';
          tdStyle.left = '0';
          tdStyle.zIndex = '6';
          tdStyle.backgroundColor = '#fff';
          tdStyle.willChange = 'transform';
        } else if (isPinnedRight) {
          tdStyle.position = 'sticky';
          tdStyle.right = '0';
          tdStyle.zIndex = '6';
          tdStyle.backgroundColor = '#fff';
          tdStyle.willChange = 'transform';
        }
        return { col, tdStyle, minWidth: col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH, width: columnWidth, maxWidth: columnWidth };
      });

      // Build header cell styles
      const getHeaderStyle = (col: IColumnDef<unknown>, colIdx: number): Record<string, string> => {
        const isFreezeCol = freezeCols != null && freezeCols >= 1 && colIdx < freezeCols;
        const isPinnedLeft = col.pinned === 'left';
        const isPinnedRight = col.pinned === 'right';
        const base: Record<string, string> = { fontWeight: '600', position: 'relative' };
        if (isPinnedLeft || (isFreezeCol && colIdx === 0)) {
          return { ...base, position: 'sticky', left: '0', top: '0', zIndex: '9', backgroundColor: 'rgba(0,0,0,0.04)', willChange: 'transform' };
        }
        if (isPinnedRight) {
          return { ...base, position: 'sticky', right: '0', top: '0', zIndex: '9', backgroundColor: 'rgba(0,0,0,0.04)', willChange: 'transform' };
        }
        return base;
      };

      const wrapperStyle: Record<string, string> = {
        position: 'relative',
        flex: '1',
        minHeight: '0',
        width: fitToContent ? 'fit-content' : '100%',
        maxWidth: '100%',
        overflowX: suppressHorizontalScroll ? 'hidden' : allowOverflowX ? 'auto' : 'hidden',
        overflowY: 'auto',
        backgroundColor: '#fff',
        willChange: 'scroll-position',
      };

      return h('div', { style: { position: 'relative', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' } }, [
        // Scrollable wrapper
        h('div', {
          ref: (el: unknown) => { wrapperRef.value = el as HTMLDivElement; },
          tabindex: 0,
          role: 'region',
          'aria-label': ariaLabel ?? (ariaLabelledBy ? undefined : 'Data grid'),
          'aria-labelledby': ariaLabelledBy,
          onMousedown: (e: MouseEvent) => { lastMouseShift.value = e.shiftKey; },
          onKeydown: handleGridKeyDown,
          onContextmenu: (e: MouseEvent) => e.preventDefault(),
          'data-overflow-x': allowOverflowX ? 'true' : 'false',
          style: wrapperStyle,
        }, [
          h('div', { style: { display: 'flex', flexDirection: 'column', minHeight: '100%' } }, [
            h('div', { style: { minWidth: allowOverflowX ? `${minTableWidth}px` : undefined } }, [
              h('div', {
                ref: (el: unknown) => { tableContainerRef.value = el as HTMLDivElement; },
                style: isLoading && items.length > 0
                  ? { position: 'relative', opacity: '0.6' }
                  : { position: 'relative', opacity: '1' },
              }, [
                // Table
                h('table', {
                  style: {
                    width: '100%',
                    borderCollapse: 'collapse',
                    overflow: 'hidden',
                    minWidth: `${minTableWidth}px`,
                    fontSize: '0.875rem',
                  },
                  'data-freeze-rows': freezeRows != null && freezeRows >= 1 ? freezeRows : undefined,
                  'data-freeze-cols': freezeCols != null && freezeCols >= 1 ? freezeCols : undefined,
                }, [
                  // Header
                  h('thead', { style: { position: 'sticky', top: '0', zIndex: '8', backgroundColor: 'rgba(0,0,0,0.04)' } },
                    headerRows.map((row, rowIdx) =>
                      h('tr', { key: rowIdx, style: { backgroundColor: 'rgba(0,0,0,0.04)' } }, [
                        // Checkbox header cell (last leaf row only)
                        ...(rowIdx === headerRows.length - 1 && hasCheckboxCol ? [
                          h('th', {
                            style: {
                              width: `${CHECKBOX_COLUMN_WIDTH}px`,
                              minWidth: `${CHECKBOX_COLUMN_WIDTH}px`,
                              maxWidth: `${CHECKBOX_COLUMN_WIDTH}px`,
                              textAlign: 'center',
                              padding: '4px',
                            },
                          },
                            h(VCheckbox as any, {
                              modelValue: allSelected,
                              indeterminate: someSelected,
                              hideDetails: true,
                              density: 'compact',
                              'aria-label': 'Select all rows',
                              'onUpdate:modelValue': (c: boolean) => handleSelectAll(!!c),
                            })
                          ),
                        ] : []),
                        // Empty placeholder for checkbox in first group row
                        ...(rowIdx === 0 && rowIdx < headerRows.length - 1 && hasCheckboxCol ? [
                          h('th', {
                            rowSpan: headerRows.length - 1,
                            style: { width: `${CHECKBOX_COLUMN_WIDTH}px`, minWidth: `${CHECKBOX_COLUMN_WIDTH}px`, padding: '0' },
                          }),
                        ] : []),
                        // Header cells
                        ...row.map((cell, cellIdx) => {
                          if (cell.isGroup) {
                            return h('th', {
                              key: cellIdx,
                              colSpan: cell.colSpan,
                              scope: 'colgroup',
                              style: { textAlign: 'center', fontWeight: '600', borderBottom: '2px solid rgba(0,0,0,0.12)', padding: '6px' },
                            }, cell.label);
                          }
                          const col = cell.columnDef! as IColumnDef<unknown>;
                          const colIdx = visibleCols.indexOf(col);
                          const columnWidth = getColumnWidth(col);
                          const headerStyle = getHeaderStyle(col, colIdx);
                          return h('th', {
                            key: col.columnId,
                            scope: 'col',
                            rowSpan: headerRows.length > 1 ? headerRows.length - rowIdx : undefined,
                            style: {
                              ...headerStyle,
                              minWidth: `${col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH}px`,
                              width: `${columnWidth}px`,
                              maxWidth: `${columnWidth}px`,
                            },
                          }, [
                            h(ColumnHeaderFilter, getHeaderFilterConfig(col, headerFilterInput)),
                            h('div', {
                              onMousedown: (e: MouseEvent) => handleResizeStart(e, col),
                              style: {
                                position: 'absolute',
                                top: '0',
                                right: '-3px',
                                bottom: '0',
                                width: '8px',
                                cursor: 'col-resize',
                                userSelect: 'none',
                              },
                            }),
                          ]);
                        }),
                      ])
                    )
                  ),

                  // Body
                  ...(!showEmptyInGrid ? [
                    h('tbody', {},
                      items.map((item, rowIndex) => {
                        const rowIdStr = getRowId(item);
                        const isSelected = selectedRowIds.has(rowIdStr);
                        return h('tr', {
                          key: rowIdStr,
                          'data-row-id': rowIdStr,
                          onClick: handleSingleRowClick,
                          style: { cursor: rowSelection === 'single' ? 'pointer' : undefined },
                        }, [
                          // Checkbox cell
                          ...(hasCheckboxCol ? [
                            h('td', {
                              style: {
                                width: `${CHECKBOX_COLUMN_WIDTH}px`,
                                minWidth: `${CHECKBOX_COLUMN_WIDTH}px`,
                                maxWidth: `${CHECKBOX_COLUMN_WIDTH}px`,
                                textAlign: 'center',
                                padding: '0',
                              },
                            },
                              h('div', {
                                'data-row-index': rowIndex,
                                'data-col-index': 0,
                                onClick: (e: MouseEvent) => e.stopPropagation(),
                                style: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
                              },
                                h(VCheckbox as any, {
                                  modelValue: isSelected,
                                  hideDetails: true,
                                  density: 'compact',
                                  'aria-label': `Select row ${rowIndex + 1}`,
                                  'onUpdate:modelValue': (checked: boolean) =>
                                    handleRowCheckboxChange(rowIdStr, checked, rowIndex, lastMouseShift.value),
                                })
                              )
                            ),
                          ] : []),
                          // Data cells
                          ...columnLayouts.map((cl, colIdx) =>
                            h('td', {
                              key: cl.col.columnId,
                              style: {
                                ...cl.tdStyle,
                                minWidth: `${cl.minWidth}px`,
                                width: `${cl.width}px`,
                                maxWidth: `${cl.maxWidth}px`,
                              },
                            }, [renderCellContent(item, cl.col, rowIndex, colIdx)])
                          ),
                        ]);
                      })
                    ),
                  ] : []),
                ]),

                // Empty state
                ...(showEmptyInGrid && p.emptyState ? [
                  h('div', {
                    style: {
                      padding: '32px 16px',
                      textAlign: 'center',
                      borderTop: '1px solid rgba(0,0,0,0.12)',
                      backgroundColor: 'rgba(0,0,0,0.04)',
                    },
                  }, p.emptyState.render
                    ? [p.emptyState.render() as string]
                    : [
                        h('div', { style: { fontSize: '1.25rem', fontWeight: '600', marginBottom: '8px' } }, 'No results found'),
                        h('div', { style: { fontSize: '0.875rem', color: 'rgba(0,0,0,0.6)' } },
                          p.emptyState.message != null
                            ? String(p.emptyState.message)
                            : p.emptyState.hasActiveFilters
                              ? [
                                  'No items match your current filters. Try adjusting your search or ',
                                  h(VBtn as any, {
                                    variant: 'text',
                                    size: 'small',
                                    onClick: p.emptyState.onClearAll,
                                  }, () => 'clear all filters'),
                                  ' to see all items.',
                                ]
                              : 'There are no items available at this time.'
                        ),
                      ]
                  ),
                ] : []),
              ]),
            ]),
          ]),
        ]),

        // Context menu (teleported to body)
        ...(menuPosition ? [
          h(Teleport, { to: 'body' },
            h(GridContextMenu, {
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
          h('div', {
            style: {
              position: 'absolute',
              inset: '0',
              zIndex: '2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.7)',
            },
          },
            h('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '16px',
                backgroundColor: '#fff',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: '4px',
              },
            }, [
              h(VProgressCircular as any, { size: 24, indeterminate: true }),
              h('span', { style: { fontSize: '0.875rem', color: 'rgba(0,0,0,0.6)' } }, loadingMessage),
            ])
          ),
        ] : []),
      ]);
    };
  },
});
