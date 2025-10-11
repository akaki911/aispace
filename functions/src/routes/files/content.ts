import type { Request, Response, Router } from 'express';
import { promises as fs } from 'fs';
import {
  decodePathParameter,
  detectBinaryFile,
  ensureDeveloperAccess,
  ensureTextFileExtension,
  HttpError,
  resolveProjectPath,
} from './utils';

export function registerFilesContentRoute(router: Router): void {
  router.get('/api/files/content/*', async (req: Request, res: Response) => {
    try {
      ensureDeveloperAccess(res);

      const wildcard = (req.params[0] ?? '') as string;
      const decodedPath = decodePathParameter(wildcard);
      const { absolute, relative } = resolveProjectPath(decodedPath);

      ensureTextFileExtension(relative);

      const stats = await fs.stat(absolute);
      if (!stats.isFile()) {
        throw new HttpError(400, 'not_a_file');
      }

      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-File-Size', stats.size.toString());
      res.setHeader('X-Last-Modified', stats.mtime.toISOString());

      if (detectBinaryFile(absolute)) {
        const buffer = await fs.readFile(absolute);
        res.setHeader('X-Content-Type', 'binary');
        res.setHeader('X-Content-Encoding', 'base64');
        res.type('text/plain; charset=utf-8').send(buffer.toString('base64'));
        return;
      }

      const content = await fs.readFile(absolute, 'utf8');
      res.type('text/plain; charset=utf-8').send(content);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).send(error.message);
        return;
      }

      console.error('Failed to read file content', error);
      res.status(500).send('internal_error');
    }
  });
}
