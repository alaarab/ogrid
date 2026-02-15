/**
 * Shared ColumnChooser tests.
 * Each UI package calls createColumnChooserTests(ColumnChooser) to run these.
 */
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

interface ColumnChooserProps {
  columns: Array<{ columnId: string; name: string; required?: boolean }>;
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, visible: boolean) => void;
}

export function createColumnChooserTests(ColumnChooser: React.ComponentType<ColumnChooserProps>): void {
  const columns = [
    { columnId: 'a', name: 'Col A' },
    { columnId: 'b', name: 'Col B' },
  ];

  it('opens dropdown and toggles column visibility', () => {
    const onVisibilityChange = jest.fn();
    render(<ColumnChooser columns={columns} visibleColumns={new Set(['a'])} onVisibilityChange={onVisibilityChange} />);
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    fireEvent.click(screen.getByLabelText('Col B'));
    expect(onVisibilityChange).toHaveBeenCalledWith('b', true);
  });

  it('select all shows all columns visible', () => {
    const onVisibilityChange = jest.fn();
    render(<ColumnChooser columns={columns} visibleColumns={new Set(['a'])} onVisibilityChange={onVisibilityChange} />);
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    expect(onVisibilityChange).toHaveBeenCalledWith('b', true);
  });

  it('Escape closes dropdown', () => {
    render(<ColumnChooser columns={columns} visibleColumns={new Set(['a', 'b'])} onVisibilityChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    expect(screen.getByLabelText('Col A')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByLabelText('Col A')).not.toBeInTheDocument();
  });

  it('clear all hides non-required visible columns', () => {
    const onVisibilityChange = jest.fn();
    render(<ColumnChooser columns={[{ columnId: 'id', name: 'ID', required: true }, ...columns]} visibleColumns={new Set(['id', 'a', 'b'])} onVisibilityChange={onVisibilityChange} />);
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onVisibilityChange).toHaveBeenCalledWith('a', false);
    expect(onVisibilityChange).toHaveBeenCalledWith('b', false);
    expect(onVisibilityChange).not.toHaveBeenCalledWith('id', false);
  });
}
