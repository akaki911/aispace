import type { Readable } from 'node:stream';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { stat } from 'node:fs/promises';
import archiver from 'archiver';
import { glob } from 'glob';

export interface CreateZipStreamOptions {
  label?: string;
}

const DEFAULT_LABEL = 'aispace-backend-endpoints';
const ROUTES_ROOT = path.resolve(__dirname, '..', 'routes');
const ROUTE_DIRECTORIES = [
  'ai_admin',
  'admin/secrets',
  'system',
  'files',
  'safety-switch',
  'auto-improve',
  'dev/tests',
] as const;

interface ArchiveEntry {
  absolutePath: string;
  archivePath: string;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function sanitizeLabel(rawLabel?: string): string {
  const fallback = rawLabel && rawLabel.trim().length > 0 ? rawLabel.trim() : DEFAULT_LABEL;
  return fallback.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

async function isDirectory(absolutePath: string): Promise<boolean> {
  try {
    const stats = await stat(absolutePath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

async function collectArchiveEntries(label: string): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];

  for (const relativeDir of ROUTE_DIRECTORIES) {
    const directorySegments = relativeDir.split('/');
    const absoluteDirectory = path.resolve(ROUTES_ROOT, ...directorySegments);

    if (!(await isDirectory(absoluteDirectory))) {
      continue;
    }

    const matches = await glob('**/*.{ts,js}', {
      cwd: absoluteDirectory,
      nodir: true,
      dot: false,
      absolute: false,
    });

    const posixRelativeDir = toPosixPath(relativeDir);

    for (const match of matches) {
      const archivePath = path.posix.join(label, posixRelativeDir, toPosixPath(match));
      entries.push({
        absolutePath: path.join(absoluteDirectory, match),
        archivePath,
      });
    }
  }

  return entries.sort((a, b) => a.archivePath.localeCompare(b.archivePath));
}

export async function createZipStream(options: CreateZipStreamOptions = {}): Promise<Readable> {
  const safeLabel = sanitizeLabel(options.label);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = new PassThrough();

  archive.on('error', (error) => {
    output.emit('error', error);
  });

  archive.on('warning', (warning) => {
    const warningWithCode = warning as { code?: string } | undefined;

    if (warningWithCode && warningWithCode.code === 'ENOENT') {
      console.warn('⚠️ ZIP warning:', warning);
      return;
    }

    output.emit('error', warning as Error);
  });

  archive.pipe(output);

  try {
    const entries = await collectArchiveEntries(safeLabel);

    if (entries.length === 0) {
      const placeholderPath = path.posix.join(safeLabel, 'README.txt');
      archive.append('No backend endpoint sources were found.', { name: placeholderPath });
    } else {
      for (const entry of entries) {
        archive.file(entry.absolutePath, { name: entry.archivePath });
      }
    }
  } catch (error) {
    queueMicrotask(() => {
      output.emit('error', error as Error);
    });

    archive.destroy?.();
    return output;
  }

  archive.finalize().catch((error: Error) => {
    output.emit('error', error);
  });

  return output;
}
