import type { Request, Response, Router } from 'express';

export function registerDevTestsIndexRoute(router: Router): void {
  router.get('/api/dev/tests', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement dev tests index endpoint.' });
  });
}
