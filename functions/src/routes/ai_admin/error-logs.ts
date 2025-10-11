import type { Request, Response, Router } from 'express';

export function registerAiAdminErrorLogsRoute(router: Router): void {
  router.get('/api/ai-admin/error-logs', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement AI admin error logs retrieval.' });
  });
}
