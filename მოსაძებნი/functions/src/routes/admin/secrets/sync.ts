import type { Request, Response, Router } from 'express';

export function registerAdminSecretsSyncRoute(router: Router): void {
  router.post('/api/admin/secrets/sync', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement secrets sync.' });
  });
}
