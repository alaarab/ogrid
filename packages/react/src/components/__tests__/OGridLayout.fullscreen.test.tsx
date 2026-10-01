import { render, screen, fireEvent, act } from '@testing-library/react';
import { OGridLayout } from '../OGridLayout';

function renderFullScreen() {
  render(
    <OGridLayout fullScreen>
      <div>
        <input data-testid="grid-input" />
        <div tabIndex={0} data-testid="grid-cell" />
      </div>
    </OGridLayout>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
}

function pressEscape(target: Element, prevented: boolean) {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  if (prevented) e.preventDefault();
  act(() => { target.dispatchEvent(e); });
}

describe('OGridLayout full screen Escape', () => {
  it('stays in full screen when Escape was already handled (grid, popover, editor)', () => {
    renderFullScreen();
    pressEscape(screen.getByTestId('grid-cell'), true);
    expect(screen.queryByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
  });

  it('stays in full screen when Escape comes from a text input', () => {
    renderFullScreen();
    pressEscape(screen.getByTestId('grid-input'), false);
    expect(screen.queryByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
  });

  it('exits full screen on an unhandled Escape', () => {
    renderFullScreen();
    pressEscape(screen.getByTestId('grid-cell'), false);
    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBeTruthy();
  });
});
