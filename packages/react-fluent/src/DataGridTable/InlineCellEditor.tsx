import * as React from 'react';
import { Checkbox } from '@fluentui/react-components';
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
          onChange={(_, data) => onCommit(!!data.checked)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), onCancel())}
        />
      )}
    />
  );
}
