import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';

setup((app) => {
  app.use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: '[data-theme="dark"]',
      },
    },
  });
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
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        document.body.style.background = isDark ? '#1e1e1e' : '#fff';
        document.body.style.color = isDark ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)';
      },
      template: '<story />',
    }),
  ],
};

export default preview;
