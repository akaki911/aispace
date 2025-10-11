import type { Request, Response, Router } from 'express';

export function registerAdminSecretsCrudRoute(router: Router): void {
  router.post('/api/admin/secrets', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement secrets CRUD operations.' });
  });
}
