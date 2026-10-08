import * as React from 'react';
import { booleanParser, conditionalFormatTextStyle, getConditionalFormatIcon, isCellWrapped } from '@alaarab/ogrid-core';
import type { ICellConditionalFormat, ICellIcon } from '@alaarab/ogrid-core';
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
import { CURSOR_CELL_STYLE, CELL_EDITOR_ATTR } from '../constants/domHelpers';
import { CellErrorBoundary } from '../components/CellErrorBoundary';
import { ValidationInputMessage } from '../components/ValidationInputMessage';
import type { UseDataGridTableOrchestrationResult } from './useDataGridTableOrchestration';
import type { InlineCellEditorProps } from '../components/createOGrid';
import type { DataGridStyles, DataGridPrimitives } from '../components/BaseDataGridTable.types';
import type { IColumnDef, ICellEditorProps } from '../types';

/** Column cell style with a conditional format's text style on top. */
function withConditionalFormat(base: React.CSSProperties | undefined, cf: ICellConditionalFormat): React.CSSProperties | undefined {
  const text = conditionalFormatTextStyle(cf);
  // A cell-level fill (e.g. an imported xlsx fill layer) would hide the conditional fill or bar on the cell.
  const coversCell = base?.background !== undefined && (cf.style.background !== undefined || cf.dataBar !== undefined);
  if (!text && !coversCell) return base;
  return { ...base, ...(coversCell ? { background: 'transparent' } : undefined), ...text };
}

function renderConditionalIcon(icon: ICellIcon): React.ReactNode {
  const { glyph, color, label } = getConditionalFormatIcon(icon.set, icon.index);
  return (
    <span data-cf-icon={label} aria-hidden style={{ color, marginRight: 4, fontSize: '0.85em' }}>
      {glyph}
    </span>
  );
}

/** Marks the inline editor so the grid keydown handler leaves its keys alone. */
const EDITOR_MARKER_PROPS = { [CELL_EDITOR_ATTR]: '' };

/**
 * The per-cell renderer for the shared table body. Reads volatile state from
 * refs so the returned function identity stays stable — GridRow's React.memo
 * comparator relies on this to skip rows whose selection state hasn't changed.
 *
 * Row-scoped state (selection, active cell, editing, cut/copy) reaches GridRow
 * as props. Grid-wide inputs read through `cellDescriptorInputRef` that no row
 * prop carries (editability, formula accessors) are listed as deps instead, so
 * a change to them gives a new function and repaints every row.
 */
export function useRenderCellContent<T>(
  o: UseDataGridTableOrchestrationResult<T>,
  styles: DataGridStyles,
  primitives: DataGridPrimitives,
  circleInvalidData?: boolean,
): (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number, cf?: ICellConditionalFormat) => React.ReactNode {
  const {
    getRowId, editCallbacks, interactionHandlers, delegatedCellHandlers,
    cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef,
    setPopoverAnchorEl, cancelPopoverEdit, setActiveCell, interaction, colOffset,
    handleFillHandleMouseDown, onCellError, cellDescriptorInput,
  } = o;
  const { setSelectionRange, handleFillHandleDoubleClick } = interaction;
  const { validator, sheetRow: validationRow } = o.validation;
  const { editable, getFormulaValue, hasFormula, getFormula, activeSpillRange } = cellDescriptorInput;
  const hasValueChangeHandler = !!cellDescriptorInput.onCellValueChanged;
  const { InlineCellEditor, renderPopoverEditor, renderBooleanCell } = primitives;

  // biome-ignore lint/correctness/useExhaustiveDependencies: editable, hasValueChangeHandler and the formula accessors are read through cellDescriptorInputRef; they are deps so the function identity (and so every row) changes with them
  return useCallback(
    (item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number, cf?: ICellConditionalFormat): React.ReactNode => {
      const row = validationRow(item, rowIndex);
      const rule = validator.ruleFor(item, col.columnId, row);
      const list = rule?.type === 'list' && rule.inCellDropdown !== false ? validator.listValues(rule, col.columnId, row).map(String) : undefined;
      if (list) col = { ...col, cellEditor: 'select', cellEditorParams: { values: list } };
      const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIdx, cellDescriptorInputRef.current, cellDescriptorCacheRef.current);
      const rowId = getRowId(item);

      let content: React.ReactNode;

      if (descriptor.mode === 'editing-inline') {
        const editorProps = buildInlineEditorProps(item, col, descriptor, editCallbacks) as InlineCellEditorProps<T>;
        // Type-to-replace: the keyboard layer seeds the editor through the pending value.
        const seed = pendingEditorValueRef.current;
        content = (
          <div className={styles.editingCellContent} {...EDITOR_MARKER_PROPS}>
            <InlineCellEditor<T> {...editorProps} initialText={typeof seed === 'string' ? seed : undefined} />
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
          const boolVal = !!(booleanParser({ newValue: descriptor.displayValue, oldValue: descriptor.displayValue, data: item, column: col }) ?? descriptor.displayValue);
          displayNode = renderBooleanCell({
            checked: boolVal,
            disabled: !descriptor.canEditAny,
            onChange: descriptor.canEditAny ? () => {
              const savedRow = descriptor.rowIndex;
              const savedCol = descriptor.globalColIndex;
              editCallbacks.commitCellEdit(item, col.columnId, descriptor.displayValue, !boolVal, savedRow, savedCol, { skipAdvance: true });
            } : undefined,
            onPointerDown: (e: React.PointerEvent) =>
              handleBooleanCellPointerDown(e, descriptor.rowIndex, descriptor.globalColIndex, colOffset, {
                setActiveCell,
                setSelectionRange,
              }),
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
            ariaLabel: boolVal ? 'Checked' : 'Unchecked',
          });
        } else {
          const displayContent = resolveCellDisplayContent(col, item, descriptor.displayValue) as React.ReactNode;
          const cellStyle = cf ? withConditionalFormat(resolveCellStyle(col, item, descriptor.displayValue), cf) : resolveCellStyle(col, item, descriptor.displayValue);
          displayNode = cellStyle ? <span style={cellStyle}>{displayContent}</span> : displayContent;
          if (cf?.icon) displayNode = <>{renderConditionalIcon(cf.icon)}{displayNode}</>;
        }

        // Wrap Text: wraps at the column width, keeps line breaks, top-aligned.
        const wrapped = descriptor.columnType !== 'boolean' && isCellWrapped(col, item);
        const cellClassNames = `${styles.cellContent}${wrapped && styles.wrapText ? ` ${styles.wrapText}` : ''}${descriptor.isActive ? ` ${styles.activeCellContent}` : ''}${descriptor.isActive && descriptor.isInRange ? ` ${styles.inRange}` : ''}${descriptor.isInRange && !descriptor.isActive ? ` ${styles.cellInRange}` : ''}${descriptor.isInCutRange ? ` ${styles.cellCut}` : ''}${descriptor.isInCopyRange ? ` ${styles.cellCopied}` : ''}`;

        const interactionProps = getCellInteractionProps(
          descriptor,
          col.columnId,
          interactionHandlers,
          primitives.useDelegatedCellHandlers ? delegatedCellHandlers : undefined,
          false, // the <td> is the roving focus target (useGridCellFocus)
        );

        // The fill handle is a sibling of the cell content (positioned against the
        // <td>) so the content box can clip overflowing text like Excel does.
        content = (
          <>
            <div
              className={cellClassNames}
              {...interactionProps}
              data-wrap-text={wrapped ? '' : undefined}
              style={descriptor.canEditAny ? CURSOR_CELL_STYLE : undefined}
            >
              {displayNode}
            </div>
            {descriptor.canEditAny && descriptor.isSelectionEndCell && (
              // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the fill handle is a pointer-only drag affordance; the label is intentional and relied on as a stable hook
              // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only affordance (drag, double-click to fill down); the keyboard equivalent is Ctrl+D
              // biome-ignore lint/a11y/noNoninteractiveElementInteractions: as above, Ctrl+D is the keyboard fill
              <div
                className={styles.fillHandle}
                onPointerDown={handleFillHandleMouseDown}
                onDoubleClick={handleFillHandleDoubleClick}
                aria-label="Fill handle"
              />
            )}
          </>
        );
      }

      const input = cellDescriptorInputRef.current;
      const spill = input.activeSpillRange;
      const sheetCol = input.formulaCol?.(col.columnId) ?? colIdx;
      const sheetRow = input.formulaRow?.(rowIndex) ?? rowIndex;
      const inSpill = spill && sheetCol >= spill.anchorCol && sheetCol <= spill.endCol && sheetRow >= spill.anchorRow && sheetRow <= spill.endRow;
      return (
        <CellErrorBoundary
          key={`${rowId}-${col.columnId}`}
          resetKeys={[item, descriptor.displayValue, descriptor.mode]}
          onError={onCellError}
        >
          {content}
          {inSpill && <span aria-hidden="true" data-spill-outline="" style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
            borderTop: sheetRow === spill.anchorRow ? '1px solid #4b89dc' : undefined,
            borderBottom: sheetRow === spill.endRow ? '1px solid #4b89dc' : undefined,
            borderLeft: sheetCol === spill.anchorCol ? '1px solid #4b89dc' : undefined,
            borderRight: sheetCol === spill.endCol ? '1px solid #4b89dc' : undefined,
          }} />}
          {circleInvalidData && rule && !validator.validate(rule, descriptor.displayValue, col.columnId, row) && (
            <span role="img" data-validation-invalid="" aria-label="Invalid data" style={{ position: 'absolute', inset: 2, border: '2px solid #d13438', borderRadius: '50%', pointerEvents: 'none', zIndex: 2 }} />
          )}
          {descriptor.isActive && rule?.inputMessage && rule.inputMessage.show !== false && (
            <ValidationInputMessage message={rule.inputMessage} styles={styles} primitives={primitives} />
          )}
          {descriptor.isActive && descriptor.mode === 'display' && descriptor.canEditAny && list && (
            <button type="button" aria-label="Show validation list" tabIndex={-1} style={{ position: 'absolute', right: 1, top: 1, bottom: 1, width: 20, padding: 0, zIndex: 3 }}
              onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); o.editing.setEditingCell({ rowId, columnId: col.columnId }); }}>
              ▾
            </button>
          )}
        </CellErrorBoundary>
      );
    },
    [editCallbacks, interactionHandlers, delegatedCellHandlers, handleFillHandleMouseDown, handleFillHandleDoubleClick, setPopoverAnchorEl, cancelPopoverEdit, getRowId, onCellError, cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef, colOffset, setSelectionRange, setActiveCell, styles, primitives, InlineCellEditor, renderPopoverEditor, renderBooleanCell, activeSpillRange, editable, hasValueChangeHandler, getFormulaValue, hasFormula, getFormula, validator, validationRow, circleInvalidData, o.editing.setEditingCell]
  );
}
