import type { Request, Response, Router } from 'express';

export function registerAiAdminFallbackRoute(router: Router): void {
  router.post('/api/ai-admin/fallback', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement AI admin fallback plan.' });
  });
}
