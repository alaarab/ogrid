import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
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
        <Checkbox.Root
          checked={checked}
          onCheckedChange={(c: boolean | 'indeterminate') => onCommit(c === true)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
        >
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      )}
    />
  );
}
