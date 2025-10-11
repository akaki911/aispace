import type { Request, Response, Router } from 'express';
import {
  buildFileTree,
  countTreeItems,
  ensureDeveloperAccess,
  HttpError,
  resolveProjectPath,
} from './utils';

export function registerFilesTreeRoute(router: Router): void {
  router.get('/api/files/tree', async (req: Request, res: Response) => {
    try {
      ensureDeveloperAccess(res);

      const requestedPath = typeof req.query.path === 'string' ? req.query.path : '';
      const { absolute, relative } = resolveProjectPath(requestedPath);

      const tree = await buildFileTree(absolute, relative);

      res.json({
        success: true,
        data: tree,
        root: relative || '.',
        count: tree.length,
        totalItems: countTreeItems(tree),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ success: false, error: error.message });
        return;
      }

      console.error('Failed to build file tree', error);
      res.status(500).json({ success: false, error: 'internal_error' });
    }
  });
}
