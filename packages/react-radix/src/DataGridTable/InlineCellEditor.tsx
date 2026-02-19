import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import { BaseInlineCellEditor } from '@alaarab/ogrid-react';
import type { InlineCellEditorProps } from '@alaarab/ogrid-react';

export type { InlineCellEditorProps } from '@alaarab/ogrid-react';

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
