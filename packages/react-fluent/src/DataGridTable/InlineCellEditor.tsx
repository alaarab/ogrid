import * as React from 'react';
import { Select, Checkbox } from '@fluentui/react-components';
import type { IColumnDef } from '@alaarab/ogrid-react';
import { BaseInlineCellEditor, editorWrapperStyle } from '@alaarab/ogrid-react';

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
        <Checkbox
          checked={checked}
          onChange={(_, data) => onCommit(!!data.checked)}
          onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
        />
      )}
      renderSelect={(value, values, onCommit, onCancel) => (
        <div style={editorWrapperStyle}>
          <Select
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(_, data) => onCommit(data.value)}
            onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
          >
            {values.map((v) => (
              <option key={String(v)} value={String(v)}>
                {String(v)}
              </option>
            ))}
          </Select>
        </div>
      )}
    />
  );
}
