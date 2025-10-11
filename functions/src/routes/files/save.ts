import type { Request, Response, Router } from 'express';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import {
  decodePathParameter,
  ensureDeveloperAccess,
  ensureTextFileExtension,
  HttpError,
  resolveProjectPath,
} from './utils';

const readRequestBody = async (req: Request): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
};

const extractContent = async (req: Request): Promise<string> => {
  if (typeof req.body === 'string') {
    return req.body;
  }

  if (req.body && typeof req.body.content === 'string') {
    return req.body.content;
  }

  if (req.body && typeof req.body.data === 'string') {
    return req.body.data;
  }

  return readRequestBody(req);
};

const resolveRequestedPath = (req: Request): string => {
  const wildcard = (req.params[0] ?? '') as string;
  if (wildcard) {
    return decodePathParameter(wildcard);
  }

  if (req.body && typeof req.body.path === 'string') {
    return req.body.path;
  }

  return '';
};

const handleSaveRequest = async (req: Request, res: Response) => {
  try {
    ensureDeveloperAccess(res);

    const requestedPath = resolveRequestedPath(req);
    if (!requestedPath) {
      throw new HttpError(400, 'path_required');
    }

    const content = await extractContent(req);
    if (typeof content !== 'string') {
      throw new HttpError(400, 'content_required');
    }

    const { absolute, relative } = resolveProjectPath(requestedPath);
    ensureTextFileExtension(relative);

    await fs.mkdir(dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');

    const stats = await fs.stat(absolute);

    res.json({
      success: true,
      path: relative,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ success: false, error: error.message });
      return;
    }

    console.error('Failed to save file', error);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
};

export function registerFilesSaveRoute(router: Router): void {
  router.post('/api/files/save', handleSaveRequest);
  router.post('/api/files/save/*', handleSaveRequest);
}
