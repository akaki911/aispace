import type { Request, Response, Router } from 'express';

export function registerSafetySwitchConfirmRoute(router: Router): void {
  router.post('/api/safety-switch/confirm/:id', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement safety switch confirmation.' });
  });
}
