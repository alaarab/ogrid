import type { Preview } from '@storybook/angular';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'padded',
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Color theme',
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
    (story, context) => {
      const isDark = context.globals?.['theme'] === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.body.style.background = isDark ? '#1e1e1e' : '#fff';
      document.body.style.color = isDark ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)';
      return story();
    },
  ],
};

export default preview;
