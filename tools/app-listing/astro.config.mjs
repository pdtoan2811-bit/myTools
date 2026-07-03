import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// Server output so the export API route + render pages run on demand in `astro dev`.
// applyBaseStyles:false — base/reset comes from the copied global.css (same as the site).
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [tailwind({ applyBaseStyles: false })],
  server: { port: 4321 },
  devToolbar: { enabled: false },
});
