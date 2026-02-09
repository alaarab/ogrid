import * as React from 'react';
import { Input, Select, Checkbox } from '@fluentui/react-components';
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
      <Checkbox
        checked={checked}
        onChange={(_, data) => commit(data.checked)}
        onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), cancel())}
      />
    );
  }

  if (editorType === 'select') {
    const values = (column.cellEditorParams?.values as unknown[]) ?? [];
    return (
      <Select
        value={value !== null && value !== undefined ? String(value) : ''}
        onChange={(_, data) => commit(data.value)}
        onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), cancel())}
      >
        {values.map((v) => (
          <option key={String(v)} value={String(v)}>
            {String(v)}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <div ref={wrapperRef}>
      <Input
        value={localValue}
        onChange={(_, data) => setLocalValue(data.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        size="small"
        style={{ minWidth: 60 }}
      />
    </div>
  );
}
