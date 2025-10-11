import type { Request, Response, Router } from 'express';

export function registerAutoImproveMonitorControlRoute(router: Router): void {
  router.post('/api/auto-improve/monitor/control', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement auto-improve monitor control endpoint.' });
  });
}
