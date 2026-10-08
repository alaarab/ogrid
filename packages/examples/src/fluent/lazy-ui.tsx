import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { OGrid } from '@alaarab/ogrid-react-fluent';
import '@alaarab/ogrid-react-fluent/index.css';
import { ValidationExample } from '../shared/ValidationExample';
import { createThemeToggle, getInitialTheme } from '../shared/themeToggle';

function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => createThemeToggle(setTheme), []);
  return <FluentProvider theme={theme === 'dark' ? webDarkTheme : webLightTheme}><ValidationExample Grid={OGrid} lazyUi /></FluentProvider>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
