import * as React from 'react';
import { Checkbox, Select, MenuItem } from '@mui/material';
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
          onChange={(_, c) => onCommit(c)}
          onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
          size="small"
        />
      )}
      renderSelect={(value, values, onCommit, onCancel) => (
        <div style={editorWrapperStyle}>
          <Select
            size="small"
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onCommit(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
            autoFocus
            sx={{ minWidth: 0, flex: 1 }}
          >
            {values.map((v) => (
              <MenuItem key={String(v)} value={String(v)}>
                {String(v)}
              </MenuItem>
            ))}
          </Select>
        </div>
      )}
    />
  );
}
