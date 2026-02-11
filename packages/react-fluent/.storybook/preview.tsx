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
      const theme = context.globals?.theme === 'dark' ? webDarkTheme : webLightTheme;
      return (
        <FluentProvider theme={theme}>
          <Story />
        </FluentProvider>
      );
    },
  ],
};

export default preview;
