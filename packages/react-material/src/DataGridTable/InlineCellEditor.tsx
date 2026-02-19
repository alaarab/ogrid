import * as React from 'react';
import { Checkbox } from '@mui/material';
import type { IColumnDef } from '@alaarab/ogrid-react';
import { BaseInlineCellEditor } from '@alaarab/ogrid-react';

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
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
          size="small"
        />
      )}
    />
  );
}
