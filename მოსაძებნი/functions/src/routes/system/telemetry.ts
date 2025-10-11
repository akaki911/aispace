import type { Request, Response, Router } from 'express';

export function registerSystemTelemetryRoute(router: Router): void {
  router.get('/api/system/telemetry', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement system telemetry endpoint.' });
  });
}
