import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { useInlineCellEditorState } from '@alaarab/ogrid-core';

export interface InlineCellEditorProps<T> {
  value: unknown;
  item: T;
  column: IColumnDef<T>;
  rowIndex: number;
  editorType: 'text' | 'select' | 'checkbox';
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export function InlineCellEditor<T>(props: InlineCellEditorProps<T>): React.ReactElement {
  const { value, column, editorType, onCommit, onCancel } = props;
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const { localValue, setLocalValue, handleKeyDown, handleBlur, commit, cancel } =
    useInlineCellEditorState({ value, editorType, onCommit, onCancel });

  React.useEffect(() => {
    const input = wrapperRef.current?.querySelector('input');
    input?.focus();
  }, []);

  if (editorType === 'checkbox') {
    const checked = value === true;
    return (
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(c: boolean | 'indeterminate') => commit(c === true)}
        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), cancel())}
      >
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Root>
    );
  }

  if (editorType === 'select') {
    const values = (column.cellEditorParams?.values as unknown[]) ?? [];
    return (
      <select
        value={value !== null && value !== undefined ? String(value) : ''}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), cancel())}
        autoFocus
      >
        {values.map((v) => (
          <option key={String(v)} value={String(v)}>
            {String(v)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div ref={wrapperRef}>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ minWidth: 60 }}
        autoFocus
      />
    </div>
  );
}
