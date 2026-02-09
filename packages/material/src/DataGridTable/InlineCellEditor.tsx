import * as React from 'react';
import { Checkbox, TextField, Select, MenuItem } from '@mui/material';
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
  const { localValue, setLocalValue, handleKeyDown, handleBlur, commit, cancel } =
    useInlineCellEditorState({ value, editorType, onCommit, onCancel });

  if (editorType === 'checkbox') {
    const checked = value === true;
    return (
      <Checkbox
        checked={checked}
        onChange={(_, c) => commit(c)}
        onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), cancel())}
        size="small"
      />
    );
  }

  if (editorType === 'select') {
    const values = (column.cellEditorParams?.values as unknown[]) ?? [];
    return (
      <Select
        size="small"
        value={value !== null && value !== undefined ? String(value) : ''}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (e.preventDefault(), cancel())}
        autoFocus
        sx={{ minWidth: 80 }}
      >
        {values.map((v) => (
          <MenuItem key={String(v)} value={String(v)}>
            {String(v)}
          </MenuItem>
        ))}
      </Select>
    );
  }

  return (
    <TextField
      size="small"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      autoFocus
      sx={{ minWidth: 60 }}
    />
  );
}
