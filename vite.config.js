import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var buildTime = new Date().toISOString();
var replaceHealthBuildTime = function () { return ({
    name: 'replace-health-build-time',
    apply: 'build',
    closeBundle: function () {
        var healthFile = path.resolve(__dirname, 'dist/api/ai/health.json');
        if (!fs.existsSync(healthFile)) {
            return;
        }
        var content = fs.readFileSync(healthFile, 'utf8');
        var nextContent = content.replace('__BUILD_TIME__', buildTime);
        fs.writeFileSync(healthFile, nextContent);
    },
}); };
export default defineConfig({
    base: '/',
    plugins: [react(), replaceHealthBuildTime()],
    define: {
        __BUILD_TIME__: JSON.stringify(buildTime),
    },
    resolve: {
        alias: {
            '@aispace': '/src',
        },
    },
});
