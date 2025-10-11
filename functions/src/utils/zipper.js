'use strict';

const path = require('path');
const fsp = require('fs/promises');
const { PassThrough } = require('stream');
const archiver = require('archiver');
const { glob } = require('glob');

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
];

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function sanitizeLabel(label) {
  const next = typeof label === 'string' && label.trim().length > 0 ? label.trim() : DEFAULT_LABEL;
  return next.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

async function isDirectory(absolutePath) {
  try {
    const stats = await fsp.stat(absolutePath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

async function collectArchiveEntries(label) {
  const entries = [];

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

async function createZipStream(options = {}) {
  const safeLabel = sanitizeLabel(options.label);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = new PassThrough();

  archive.on('error', (error) => {
    output.emit('error', error);
  });

  archive.on('warning', (warning) => {
    if (warning && warning.code === 'ENOENT') {
      console.warn('⚠️ ZIP warning:', warning);
      return;
    }

    output.emit('error', warning);
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
      output.emit('error', error);
    });

    if (typeof archive.destroy === 'function') {
      archive.destroy();
    }

    return output;
  }

  archive.finalize().catch((error) => {
    output.emit('error', error);
  });

  return output;
}

module.exports = { createZipStream };
