import type { Preview } from '@storybook/react';
import React from 'react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';

const VIEWPORT_DESKTOP_NARROW = {
  name: 'Desktop narrow (1024)',
  styles: { width: '1024px', height: '768px' },
};
const VIEWPORT_DESKTOP_WIDE = {
  name: 'Desktop wide (1440)',
  styles: { width: '1440px', height: '900px' },
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'fullscreen',
    viewport: {
      viewports: {
        desktopNarrow: VIEWPORT_DESKTOP_NARROW,
        desktopWide: VIEWPORT_DESKTOP_WIDE,
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Fluent theme for the grid',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals?.theme === 'dark';
      const theme = isDark ? webDarkTheme : webLightTheme;

      // Sync data-theme attribute and body background so dark mode covers the full page
      React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        document.body.style.background = isDark ? '#292929' : '#fff';
        document.body.style.color = isDark ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)';
      }, [isDark]);

      return (
        <FluentProvider
          theme={theme}
          style={{
            minHeight: '100vh',
            background: 'var(--colorNeutralBackground1)',
            color: 'var(--colorNeutralForeground1)',
          }}
        >
          <Story />
        </FluentProvider>
      );
    },
  ],
};

export default preview;
