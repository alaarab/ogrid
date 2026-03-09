import { createApp } from 'vue';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import '@alaarab/ogrid-vue-vuetify/styles/DataGridTable/DataGridTable.css';
import App from './App.vue';
import { createThemeToggle, getInitialTheme } from '../shared/themeToggle';

const vuetify = createVuetify({
  theme: {
    defaultTheme: getInitialTheme(),
  },
});

createApp(App).use(vuetify).mount('#app');

// Add dark mode toggle  -  also switch Vuetify theme
createThemeToggle((theme) => {
  vuetify.theme.global.name.value = theme;
});
