import { createApp } from 'vue';
import App from './App.vue';
import { createThemeToggle } from '../shared/themeToggle';

createApp(App).mount('#app');

// Add dark mode toggle
createThemeToggle();
