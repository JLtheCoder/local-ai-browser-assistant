import { defineConfig } from 'vite';

// The page selection toolbar content script must be a classic script (manifest
// content scripts can't be ES modules), so it gets its own IIFE build that emits
// `dist/content.js`. `emptyOutDir: false` keeps the side-panel build output.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/content.ts',
      name: 'LocalAIAssistantContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
