import type { Request, Response, Router } from 'express';

export function registerFilesTreeRoute(router: Router): void {
  router.get('/api/files/tree', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement file tree listing.' });
  });
}
