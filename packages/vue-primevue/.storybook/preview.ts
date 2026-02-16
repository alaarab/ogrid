import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';

setup((app) => {
  app.use(PrimeVue, {
    theme: {
      preset: Aura,
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
};

export default preview;
