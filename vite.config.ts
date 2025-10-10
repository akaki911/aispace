import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const buildTime = new Date().toISOString();

const base = process.env.VITE_AISPACE_BASE && process.env.VITE_AISPACE_BASE !== '/'
  ? ('/' + process.env.VITE_AISPACE_BASE).replace(/\/+/g, '/').replace(/\/+$/, '')
  : '/';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const srcDir = path.resolve(rootDir, './src');
const replaceHealthBuildTime = (): Plugin => ({
  name: 'replace-health-build-time',
  apply: 'build',
  closeBundle() {
    const healthFile = path.resolve(rootDir, 'dist/api/ai/health.json');

    if (!fs.existsSync(healthFile)) {
      return;
    }

    const content = fs.readFileSync(healthFile, 'utf8');
    const nextContent = content.replace('__BUILD_TIME__', buildTime);

    fs.writeFileSync(healthFile, nextContent);
  },
});

export default defineConfig({
  base,
  plugins: [react(), replaceHealthBuildTime()],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      '@aispace': srcDir,
      '@': path.resolve(rootDir, 'src'),
      '@monaco-editor/react': path.resolve(rootDir, 'src/stubs/monaco-editor-react'),
      '@tanstack/react-query': path.resolve(rootDir, 'src/lib/react-query-shim'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('node_modules/react-dom') || /node_modules\/(?:react|react\-dom)\//.test(id)) {
            return 'vendor-react';
          }

          if (id.includes('node_modules/firebase/')) {
            return 'vendor-firebase';
          }

          if (id.includes('node_modules/monaco-editor')) {
            return 'vendor-monaco';
          }

          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-tanstack';
          }

          return undefined;
        },
      },
    },
  },
});
