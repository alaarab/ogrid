import * as React from 'react';
import { Checkbox } from '@mui/material';
import { BaseInlineCellEditor } from '@alaarab/ogrid-react';
import type { InlineCellEditorProps } from '@alaarab/ogrid-react';

export type { InlineCellEditorProps } from '@alaarab/ogrid-react';

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
