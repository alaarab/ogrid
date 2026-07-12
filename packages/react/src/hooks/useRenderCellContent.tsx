import * as React from 'react';
import { useCallback } from 'react';
import {
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
  handleBooleanCellPointerDown,
} from '../utils';
import { CURSOR_CELL_STYLE } from '../constants/domHelpers';
import { CellErrorBoundary } from '../components/CellErrorBoundary';
import type { UseDataGridTableOrchestrationResult } from './useDataGridTableOrchestration';
import type { InlineCellEditorProps } from '../components/createOGrid';
import type { DataGridStyles, DataGridPrimitives } from '../components/BaseDataGridTable.types';
import type { IColumnDef, ICellEditorProps } from '../types';

/**
 * The per-cell renderer for the shared table body. Reads volatile state from
 * refs so the returned function identity stays stable — GridRow's React.memo
 * comparator relies on this to skip rows whose selection state hasn't changed.
 */
export function useRenderCellContent<T>(
  o: UseDataGridTableOrchestrationResult<T>,
  styles: DataGridStyles,
  primitives: DataGridPrimitives,
): (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number) => React.ReactNode {
  const {
    getRowId, editCallbacks, interactionHandlers, delegatedCellHandlers,
    cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef,
    setPopoverAnchorEl, cancelPopoverEdit, setActiveCell, interaction, colOffset,
    handleFillHandleMouseDown, onCellError,
  } = o;
  const { InlineCellEditor, renderPopoverEditor, renderBooleanCell } = primitives;

  return useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): React.ReactNode => {
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current, cellDescriptorCacheRef.current);
      const rowId = getRowId(item);

      let content: React.ReactNode;

      if (descriptor.mode === 'editing-inline') {
        const editorProps = buildInlineEditorProps(item, col, descriptor, editCallbacks) as InlineCellEditorProps<T>;
        content = (
          <div className={styles.editingCellContent}>
            <InlineCellEditor<T> {...editorProps} />
          </div>
        );
      } else if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
        const editorProps = buildPopoverEditorProps(item, col, descriptor, pendingEditorValueRef.current, editCallbacks) as ICellEditorProps<T>;
        const CustomEditor = col.cellEditor as React.ComponentType<ICellEditorProps<T>>;
        const popoverDisplayContent = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
        const popoverCellStyle = resolveCellStyle(col, item, descriptor.displayValue);
        content = renderPopoverEditor({
          open: !!popoverAnchorElRef.current,
          onClose: cancelPopoverEdit,
          setAnchorEl: setPopoverAnchorEl,
          anchorEl: popoverAnchorElRef.current,
          anchorContent: popoverCellStyle ? <span style={popoverCellStyle}>{popoverDisplayContent}</span> : popoverDisplayContent,
          editor: <CustomEditor {...editorProps} />,
        });
      } else {
        let displayNode: React.ReactNode;
        if (descriptor.columnType === 'boolean') {
          const boolVal = !!descriptor.displayValue;
          displayNode = renderBooleanCell({
            checked: boolVal,
            disabled: !descriptor.canEditAny,
            onChange: descriptor.canEditAny ? () => {
              const savedRow = descriptor.rowIndex;
              const savedCol = descriptor.globalColIndex;
              editCallbacks.commitCellEdit(item, col.columnId, boolVal, !boolVal, savedRow, savedCol, { skipAdvance: true });
            } : undefined,
            onPointerDown: (e: React.PointerEvent) =>
              handleBooleanCellPointerDown(e, descriptor.rowIndex, descriptor.globalColIndex, colOffset, {
                setActiveCell,
                setSelectionRange: (r) => interaction.setSelectionRange(r),
              }),
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
            ariaLabel: boolVal ? 'Checked' : 'Unchecked',
          });
        } else {
          const displayContent = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
          const cellStyle = resolveCellStyle(col, item, descriptor.displayValue);
          displayNode = cellStyle ? <span style={cellStyle}>{displayContent}</span> : displayContent;
        }

        const cellClassNames = `${styles.cellContent}${descriptor.isActive ? ` ${styles.activeCellContent}` : ''}${descriptor.isActive && descriptor.isInRange ? ` ${styles.inRange}` : ''}${descriptor.isInRange && !descriptor.isActive ? ` ${styles.cellInRange}` : ''}${descriptor.isInCutRange ? ` ${styles.cellCut}` : ''}${descriptor.isInCopyRange ? ` ${styles.cellCopied}` : ''}`;

        const interactionProps = getCellInteractionProps(
          descriptor,
          col.columnId,
          interactionHandlers,
          primitives.useDelegatedCellHandlers ? delegatedCellHandlers : undefined,
        );

        content = (
          <div
            className={cellClassNames}
            {...interactionProps}
            style={descriptor.canEditAny ? CURSOR_CELL_STYLE : undefined}
          >
            {displayNode}
            {descriptor.canEditAny && descriptor.isSelectionEndCell && (
              // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the fill handle is a pointer-only drag affordance; the label is intentional and relied on as a stable hook
              <div
                className={styles.fillHandle}
                onPointerDown={handleFillHandleMouseDown}
                aria-label="Fill handle"
              />
            )}
          </div>
        );
      }

      return (
        <CellErrorBoundary key={`${rowId}-${col.columnId}`} onError={onCellError}>
          {content}
        </CellErrorBoundary>
      );
    },
    [editCallbacks, interactionHandlers, delegatedCellHandlers, handleFillHandleMouseDown, setPopoverAnchorEl, cancelPopoverEdit, getRowId, onCellError, cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef, colOffset, interaction, setActiveCell, styles, primitives, InlineCellEditor, renderPopoverEditor, renderBooleanCell]
  );
}
