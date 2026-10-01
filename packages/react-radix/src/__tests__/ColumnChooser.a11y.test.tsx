import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnChooser } from '../ColumnChooser/ColumnChooser';

describe('ColumnChooser keyboard access (L16)', () => {
  it('names the dialog and moves focus into it on open', async () => {
    render(
      <ColumnChooser
        columns={[
          { columnId: 'a', name: 'A' },
          { columnId: 'b', name: 'B' },
        ]}
        visibleColumns={new Set(['a', 'b'])}
        onVisibilityChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /column visibility/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Column visibility' });
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
