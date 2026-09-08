import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Astro configuration
export default defineConfig({
  site: 'https://env.json2x.com',
  integrations: [
    sitemap(),
  ],
  output: 'static',
});
