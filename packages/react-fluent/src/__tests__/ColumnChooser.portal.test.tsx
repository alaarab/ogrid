import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnChooser } from '../ColumnChooser/ColumnChooser';

describe('Fluent ColumnChooser dropdown', () => {
  it('is portaled out of the (overflow: hidden) grid container and fixed-positioned', () => {
    const columns = [{ columnId: 'a', name: 'A' }, { columnId: 'b', name: 'B' }];
    const { container } = render(
      <div data-testid="clip" style={{ overflow: 'hidden' }}>
        <ColumnChooser columns={columns} visibleColumns={new Set(['a', 'b'])} onVisibilityChange={jest.fn()} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Column Visibility/ }));
    const dialog = screen.getByRole('dialog', { name: 'Column visibility' });
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.style.top).not.toBe('');
    expect(dialog.style.right).not.toBe('');
  });
});
