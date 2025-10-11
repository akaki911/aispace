import type { Request, Response, Router } from 'express';

export function registerAiAdminKeyRotationRoute(router: Router): void {
  router.post('/api/ai-admin/keys/rotate', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement AI admin key rotation.' });
  });
}
