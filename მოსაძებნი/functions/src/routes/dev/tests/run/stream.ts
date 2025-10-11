import type { Request, Response, Router } from 'express';

export function registerDevTestsRunStreamRoute(router: Router): void {
  router.get('/api/dev/tests/run/stream/:id', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement dev test stream endpoint.' });
  });
}
