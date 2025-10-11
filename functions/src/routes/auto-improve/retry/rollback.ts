import type { Request, Response, Router } from 'express';

export function registerAutoImproveRetryRollbackRoute(router: Router): void {
  router.post('/api/auto-improve/retry/rollback', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement auto-improve retry rollback.' });
  });
}
