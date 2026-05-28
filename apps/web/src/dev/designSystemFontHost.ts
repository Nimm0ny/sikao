import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

export const DESIGN_SYSTEM_FONT_ROUTE_PREFIX = '/__design-system-fonts';

type Next = (err?: unknown) => void;
type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: Next,
) => void | Promise<void>;

const CONTENT_TYPES: Record<string, string> = {
  '.woff2': 'font/woff2',
};

export function getDesignSystemFontRoot(appRoot: string): string {
  return resolve(appRoot, '../../packages/design-system/src/fonts');
}

export function resolveDesignSystemFontFile(appRoot: string, requestUrl: string): string | null {
  const pathname = requestUrl.split('?')[0] ?? '';
  if (!pathname.startsWith(`${DESIGN_SYSTEM_FONT_ROUTE_PREFIX}/`)) {
    return null;
  }

  const relativePath = decodeURIComponent(pathname.slice(DESIGN_SYSTEM_FONT_ROUTE_PREFIX.length + 1));
  if (relativePath.length === 0 || relativePath.includes('\0')) {
    return null;
  }

  const root = getDesignSystemFontRoot(appRoot);
  const candidate = resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }

  return (
    extname(candidate).toLowerCase() === '.woff2' &&
    existsSync(candidate) &&
    statSync(candidate).isFile()
  ) ? candidate : null;
}

function getContentType(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function listDesignSystemFonts(appRoot: string): Array<{ fileName: string; bytes: Uint8Array }> {
  const root = getDesignSystemFontRoot(appRoot);
  return readdirSync(root)
    .filter((entry) => entry.endsWith('.woff2') && statSync(join(root, entry)).isFile())
    .map((entry) => ({
      fileName: entry,
      bytes: readFileSync(join(root, entry)),
    }));
}

export function createDesignSystemFontHostMiddleware(appRoot: string): Middleware {
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

    const requestedFile = resolveDesignSystemFontFile(appRoot, req.url);
    if (!requestedFile) {
      next();
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', getContentType(requestedFile));

    if (method === 'HEAD') {
      res.statusCode = 200;
      res.end();
      return;
    }

    createReadStream(requestedFile).pipe(res);
  };
}
