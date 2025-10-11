import type { Request, Response, Router } from 'express';

export function registerAdminSecretsRollbackRoute(router: Router): void {
  router.post('/api/admin/secrets/rollback', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement secrets rollback.' });
  });
}
