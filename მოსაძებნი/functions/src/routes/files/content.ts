import type { Request, Response, Router } from 'express';

export function registerFilesContentRoute(router: Router): void {
  router.get('/api/files/content/:path', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement file content retrieval.' });
  });
}
