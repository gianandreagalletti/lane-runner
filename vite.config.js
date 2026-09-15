import { defineConfig } from 'vite';

export default defineConfig({
  base: './',   // relative paths — required for itch.io zip upload
  server: {
    port: 3000
  },
  build: {
    outDir:       'dist',
    assetsDir:    'assets',
    sourcemap:    false
  }
});
