import type { Request, Response, Router } from 'express';

export function registerAutoImproveMetricsRoute(router: Router): void {
  router.get('/api/auto-improve/metrics', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement auto-improve metrics endpoint.' });
  });
}
