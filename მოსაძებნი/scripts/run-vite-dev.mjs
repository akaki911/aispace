import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Explicitly load the ESM build of Vite's Node API to avoid the deprecated CJS wrapper warning.
const require = createRequire(import.meta.url);
const vitePackagePath = require.resolve('vite/package.json');
const viteNodeEntryPath = path.join(path.dirname(vitePackagePath), 'dist/node/index.js');
const { createServer } = await import(pathToFileURL(viteNodeEntryPath).href);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const port = Number(process.env.PORT || process.env.FRONTEND_PORT || 5000);
const host = process.env.HOST || process.env.FRONTEND_HOST || '0.0.0.0';
const clearScreenEnv = process.env.CLEAR_SCREEN ?? process.env.VITE_CLEAR_SCREEN;
const clearScreen = typeof clearScreenEnv === 'string' ? clearScreenEnv !== 'false' : false;

async function startViteDevServer() {
  try {
    const server = await createServer({
      configFile: path.join(projectRoot, 'vite.config.mts'),
      root: projectRoot,
      clearScreen,
      server: {
        host,
        port,
        strictPort: true
      }
    });

    await server.listen();
    server.printUrls();

    const shutdown = async signal => {
      console.log(`\n🛑 [Vite Runner] Received ${signal}, shutting down...`);
      await server.close();
      process.exit(0);
    };

    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => {
      process.on(signal, () => {
        shutdown(signal).catch(error => {
          console.error('❌ [Vite Runner] Failed to shut down cleanly:', error);
          process.exit(1);
        });
      });
    });
  } catch (error) {
    console.error('❌ Failed to start Vite dev server via ESM runner:', error);
    process.exit(1);
  }
}

startViteDevServer();
