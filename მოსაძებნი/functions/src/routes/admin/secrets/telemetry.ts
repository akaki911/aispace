import type { Request, Response, Router } from 'express';

export function registerAdminSecretsTelemetryRoute(router: Router): void {
  router.get('/api/admin/secrets/telemetry', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement secrets telemetry.' });
  });
}
