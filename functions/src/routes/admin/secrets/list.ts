import type { Request, Response, Router } from 'express';

export function registerAdminSecretsListRoute(router: Router): void {
  router.get('/api/admin/secrets', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement secrets listing.' });
  });
}
