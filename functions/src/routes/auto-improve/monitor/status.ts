import type { Request, Response, Router } from 'express';

export function registerAutoImproveMonitorStatusRoute(router: Router): void {
  router.get('/api/auto-improve/monitor/status', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement auto-improve monitor status endpoint.' });
  });
}
