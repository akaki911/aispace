import type { Request, Response, Router } from 'express';

export function registerAiAdminUserBanRoute(router: Router): void {
  router.post('/api/ai-admin/users/:id/ban', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement AI admin user ban workflow.' });
  });
}
