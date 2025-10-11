import type { Request, Response, Router } from 'express';

export function registerAutoImproveSseRoute(router: Router): void {
  router.get('/api/ai/autoimprove/monitor/stream', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement auto-improve monitor stream.' });
  });
}
