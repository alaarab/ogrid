import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import type { IColumnDef } from '@alaarab/ogrid-react';
import { BaseInlineCellEditor, selectEditorStyle } from '@alaarab/ogrid-react';

const selectWrapperStyle: React.CSSProperties = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '6px 10px', boxSizing: 'border-box', overflow: 'hidden', minWidth: 0 };

export interface InlineCellEditorProps<T> {
  value: unknown;
  item: T;
  column: IColumnDef<T>;
  rowIndex: number;
  editorType: 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export function InlineCellEditor<T>(props: InlineCellEditorProps<T>): React.ReactElement {
  return (
    <BaseInlineCellEditor<T>
      {...props}
      renderCheckbox={(checked, onCommit, onCancel) => (
        <Checkbox.Root
          checked={checked}
          onCheckedChange={(c: boolean | 'indeterminate') => onCommit(c === true)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
        >
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )}
      renderSelect={(value, values, onCommit, onCancel) => {
        return (
          <div style={selectWrapperStyle}>
            <select
              value={value !== null && value !== undefined ? String(value) : ''}
              onChange={(e) => onCommit(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
              autoFocus
              style={selectEditorStyle}
            >
              {values.map((v) => (
                <option key={String(v)} value={String(v)}>
                  {String(v)}
                </option>
              ))}
            </select>
          </div>
        );
      }}
    />
  );
}
