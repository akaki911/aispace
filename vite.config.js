import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@aispace': path.resolve(__dirname, 'src'),
            '@': path.resolve(__dirname, 'src'),
            '@monaco-editor/react': path.resolve(__dirname, 'src/stubs/monaco-editor-react'),
        },
    },
});
