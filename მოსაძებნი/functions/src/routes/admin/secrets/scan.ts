import type { Request, Response, Router } from 'express';

export function registerAdminSecretsScanRoute(router: Router): void {
  router.post('/api/admin/secrets/scan', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement secrets scanning.' });
  });
}
