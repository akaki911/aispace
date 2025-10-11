import type { Request, Response, Router } from 'express';

export function registerDevTestsStopRoute(router: Router): void {
  router.delete('/api/dev/tests/stop', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement dev test stop endpoint.' });
  });
}
