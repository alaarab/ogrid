/**
 * Shared theme toggle utility for all example apps.
 * Creates a floating dark/light mode toggle button.
 */

const STORAGE_KEY = 'ogrid-theme';

export function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);

  // Inject global dark mode styles once
  if (!document.getElementById('ogrid-theme-styles')) {
    const style = document.createElement('style');
    style.id = 'ogrid-theme-styles';
    style.textContent = `
      html, body {
        background: var(--ogrid-bg, #fff);
        color: var(--ogrid-fg, rgba(0,0,0,0.87));
        transition: background 0.2s, color 0.2s;
      }
      [data-theme="dark"] code {
        background: rgba(255,255,255,0.1);
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Creates and appends a floating theme toggle button to the page.
 * Returns a cleanup function.
 */
export function createThemeToggle(onToggle?: (theme: 'light' | 'dark') => void): () => void {
  const initial = getInitialTheme();
  setTheme(initial);

  const btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Toggle dark mode');
  btn.setAttribute('title', 'Toggle dark mode');
  Object.assign(btn.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '9999',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '2px solid var(--ogrid-border, rgba(0,0,0,0.12))',
    background: 'var(--ogrid-bg, #fff)',
    color: 'var(--ogrid-fg, #000)',
    cursor: 'pointer',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'background 0.2s, color 0.2s',
  });

  function update() {
    const current = document.documentElement.getAttribute('data-theme');
    btn.textContent = current === 'dark' ? '\u2600' : '\u263E'; // ☀ or ☾
  }

  update();

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    update();
    onToggle?.(next);
  });

  document.body.appendChild(btn);

  return () => {
    btn.remove();
  };
}
