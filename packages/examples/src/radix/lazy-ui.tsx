import { createRoot } from 'react-dom/client';
import { OGrid } from '@alaarab/ogrid-react-radix';
import '@alaarab/ogrid-react-radix/index.css';
import { ValidationExample } from '../shared/ValidationExample';
import { createThemeToggle } from '../shared/themeToggle';

const root = document.getElementById('root');
if (root) createRoot(root).render(<ValidationExample Grid={OGrid} lazyUi />);
createThemeToggle();
