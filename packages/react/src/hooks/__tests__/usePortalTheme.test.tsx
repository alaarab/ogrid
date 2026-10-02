import * as React from 'react';
import { render, act } from '@testing-library/react';
import { usePortalTheme } from '../usePortalTheme';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

function Harness({ onRender }: { onRender: (theme: React.CSSProperties) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const theme = usePortalTheme(ref, true);
  onRender(theme);
  return <div ref={ref} data-testid="source" />;
}

describe('usePortalTheme', () => {
  it('does not re-render when an unrelated ancestor attribute changes', async () => {
    const themes: React.CSSProperties[] = [];
    const { getByTestId } = render(<Harness onRender={(t) => themes.push(t)} />);
    await flush();
    const settled = themes.length;

    const parent = getByTestId('source').parentElement as HTMLElement;
    act(() => {
      parent.className = 'scroll-locked';
      document.body.style.overflow = 'hidden';
    });
    await flush();
    document.body.style.overflow = '';

    expect(themes.length).toBe(settled);
  });

  it('still picks up a token change, in one update for a burst of mutations', async () => {
    const themes: React.CSSProperties[] = [];
    const { getByTestId } = render(<Harness onRender={(t) => themes.push(t)} />);
    await flush();
    const settled = themes.length;

    // happy-dom doesn't inherit custom properties, so set them on the source itself.
    const source = getByTestId('source');
    act(() => {
      for (let i = 0; i < 5; i++) source.style.setProperty('--ogrid-bg', `rgb(${i}, 0, 0)`);
    });
    await flush();

    expect(themes.length).toBe(settled + 1);
    expect((themes[themes.length - 1] as Record<string, string>)['--ogrid-bg']).toBe('rgb(4, 0, 0)');
  });
});
