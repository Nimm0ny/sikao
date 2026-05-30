#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const SPEC_PATH = resolve(REPO_ROOT, 'services', 'api', 'spec', 'openapi.json');
const OUT_PATH = resolve(REPO_ROOT, 'packages', 'api-client', 'src', 'types', 'api.generated.ts');
const require = createRequire(import.meta.url);

if (!existsSync(SPEC_PATH)) {
  throw new Error(`OpenAPI spec not found: ${SPEC_PATH}`);
}

let openapiTypescriptCli;
try {
  const openapiTypescriptPackageJson = require.resolve('openapi-typescript/package.json');
  openapiTypescriptCli = resolve(dirname(openapiTypescriptPackageJson), 'bin', 'cli.js');
} catch {
  throw new Error('openapi-typescript CLI not resolvable from apps/web workspace');
}

execFileSync(process.execPath, [openapiTypescriptCli, SPEC_PATH, '-o', OUT_PATH], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});
