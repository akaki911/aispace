import type { Request, Response, Router } from 'express';

export function registerDevTestsRunRoute(router: Router): void {
  router.post('/api/dev/tests/run', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement dev test run endpoint.' });
  });
}
