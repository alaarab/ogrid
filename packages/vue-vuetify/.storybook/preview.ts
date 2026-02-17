import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import { createVuetify } from 'vuetify';
import { useTheme } from 'vuetify';
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';

const vuetify = createVuetify();

setup((app) => {
  app.use(vuetify);
});

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
    (story, context) => ({
      components: { story },
      setup() {
        const isDark = context.globals?.theme === 'dark';
        const theme = useTheme();
        theme.global.name.value = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        document.body.style.background = isDark ? '#1e1e1e' : '#fff';
        document.body.style.color = isDark ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)';
      },
      template: '<story />',
    }),
  ],
};

export default preview;
