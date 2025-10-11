import type { Request, Response, Router } from 'express';

export function registerAiAdminRestoreRoute(router: Router): void {
  router.post('/api/ai-admin/restore', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement AI admin restore endpoint.' });
  });
}
