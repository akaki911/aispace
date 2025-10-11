import type { Request, Response, Router } from 'express';

export function registerAiAdminBackupRoute(router: Router): void {
  router.post('/api/ai-admin/backup', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement AI admin backup endpoint.' });
  });
}
