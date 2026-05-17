import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WindowedPlaceholderRow } from '../WindowedPlaceholderRow';

// The component renders a <tr>, so it must be mounted inside a table.
function renderRow(ui: React.ReactElement) {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );
}

describe('WindowedPlaceholderRow', () => {
  it('renders a loading placeholder with an accessible label', () => {
    renderRow(
      <WindowedPlaceholderRow status="loading" rowIndex={41} colSpan={5} rowHeight={36} />,
    );
    expect(screen.getByLabelText('Loading row 42')).toBeInTheDocument();
  });

  it('sizes the row to rowHeight and spans every column', () => {
    const { container } = renderRow(
      <WindowedPlaceholderRow status="loading" rowIndex={0} colSpan={7} rowHeight={28} />,
    );
    const tr = container.querySelector('tr');
    const td = container.querySelector('td');
    expect(tr).toHaveStyle({ height: '28px' });
    expect(td).toHaveAttribute('colspan', '7');
  });

  it('marks loading rows aria-hidden so placeholders are not announced', () => {
    const { container } = renderRow(
      <WindowedPlaceholderRow status="loading" rowIndex={3} colSpan={4} rowHeight={36} />,
    );
    expect(container.querySelector('tr')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('tr')).toHaveAttribute('data-windowed-row', 'loading');
  });

  it('renders an error placeholder with a row reference', () => {
    renderRow(
      <WindowedPlaceholderRow status="error" rowIndex={99} colSpan={5} rowHeight={36} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('row 100');
  });

  it('shows a Retry button that fires onRetry when error', () => {
    const onRetry = jest.fn();
    renderRow(
      <WindowedPlaceholderRow
        status="error"
        rowIndex={5}
        colSpan={5}
        rowHeight={36}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the Retry button when no onRetry is provided', () => {
    renderRow(
      <WindowedPlaceholderRow status="error" rowIndex={5} colSpan={5} rowHeight={36} />,
    );
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('error rows are not aria-hidden (the failure should be announced)', () => {
    const { container } = renderRow(
      <WindowedPlaceholderRow status="error" rowIndex={5} colSpan={5} rowHeight={36} />,
    );
    expect(container.querySelector('tr')).not.toHaveAttribute('aria-hidden');
    expect(container.querySelector('tr')).toHaveAttribute('data-windowed-row', 'error');
  });
});
