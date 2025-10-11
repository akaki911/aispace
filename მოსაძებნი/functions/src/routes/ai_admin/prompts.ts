import type { Request, Response, Router } from 'express';

export function registerAiAdminPromptsRoute(router: Router): void {
  router.post('/api/ai-admin/prompts', (_req: Request, res: Response) => {
    res.status(501).json({ message: 'TODO: implement AI admin prompt management.' });
  });
}
