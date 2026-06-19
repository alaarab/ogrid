import { render, screen } from '@testing-library/react';
import { OGrid } from '../OGrid/OGrid';
import { fixtureRows, fixtureColumns, getRowId } from '@alaarab/ogrid-react/testing';

describe('OGrid columnChooser="external"', () => {
  const baseProps = {
    data: fixtureRows,
    columns: fixtureColumns,
    getRowId,
    entityLabelPlural: 'items',
    defaultPageSize: 10,
  };

  it('renders the grid but no in-toolbar column-chooser trigger', () => {
    render(<OGrid {...baseProps} columnChooser="external" />);
    // Grid still renders its rows.
    expect(screen.getAllByTestId('cell-name').map((el) => el.textContent)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ]);
    // The consumer owns the chooser, so the toolbar trigger is suppressed.
    expect(
      screen.queryByRole('button', { name: /column visibility/i }),
    ).not.toBeInTheDocument();
  });

  it('default placement still renders the in-toolbar column-chooser trigger', () => {
    render(<OGrid {...baseProps} />);
    expect(
      screen.getByRole('button', { name: /column visibility/i }),
    ).toBeInTheDocument();
  });
});
