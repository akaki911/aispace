import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const buildTime = new Date().toISOString();

const replaceHealthBuildTime = (): Plugin => ({
  name: 'replace-health-build-time',
  apply: 'build',
  closeBundle() {
    const healthFile = path.resolve(__dirname, 'dist/api/ai/health.json');

    if (!fs.existsSync(healthFile)) {
      return;
    }

    const content = fs.readFileSync(healthFile, 'utf8');
    const nextContent = content.replace('__BUILD_TIME__', buildTime);

    fs.writeFileSync(healthFile, nextContent);
  },
});

export default defineConfig({
  base: '/',
  plugins: [react(), replaceHealthBuildTime()],
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      '@aispace': path.resolve(__dirname, 'src'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
