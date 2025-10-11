import type { Request, Response, Router } from 'express';

export function registerFilesSaveRoute(router: Router): void {
  router.post('/api/files/save', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement file save/upload endpoint.' });
  });
}
