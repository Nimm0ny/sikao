import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';

export const PROTOTYPE_ROUTE_PREFIX = '/__proto__';

type Next = (err?: unknown) => void;
type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: Next,
) => void | Promise<void>;

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

export function getPrototypeRoot(appRoot: string): string {
  return resolve(appRoot, '../../.tmp_review');
}

export function resolvePrototypeFile(appRoot: string, requestUrl: string): string | null {
  const pathname = requestUrl.split('?')[0] ?? '';
  if (!pathname.startsWith(`${PROTOTYPE_ROUTE_PREFIX}/`)) {
    return null;
  }

  const relativePath = decodeURIComponent(pathname.slice(PROTOTYPE_ROUTE_PREFIX.length + 1));
  if (relativePath.length === 0 || relativePath.includes('\0')) {
    return null;
  }

  const root = getPrototypeRoot(appRoot);
  const candidate = resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }

  return candidate;
}

function getContentType(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

async function findServableFile(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  const fileStat = statSync(filePath);
  if (fileStat.isFile()) {
    return filePath;
  }
  if (!fileStat.isDirectory()) {
    return null;
  }

  const indexPath = resolve(filePath, 'index.html');
  if (!existsSync(indexPath)) {
    return null;
  }

  const indexStat = statSync(indexPath);
  return indexStat.isFile() ? indexPath : null;
}

export function createPrototypeHostMiddleware(appRoot: string): Middleware {
  return async (req, res, next) => {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      next();
      return;
    }

    if (!req.url) {
      next();
      return;
    }

    const requestedFile = resolvePrototypeFile(appRoot, req.url);
    if (!requestedFile) {
      next();
      return;
    }

    const servableFile = await findServableFile(requestedFile);
    if (!servableFile) {
      res.statusCode = 404;
      res.end('Prototype asset not found.');
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', getContentType(servableFile));

    if (method === 'HEAD') {
      res.statusCode = 200;
      res.end();
      return;
    }

    createReadStream(servableFile).pipe(res);
  };
}
