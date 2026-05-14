#!/usr/bin/env node
/**
 * Slice 3b · openapi-typescript wrapper.
 *
 * 输入: ../apps/exam-api/spec/openapi.json (BE export 出的 OpenAPI 3.x)
 * 输出: src/types/api.generated.ts (写入 SHA-256 头, 给 R1 follow-up
 *        CI lint:types-fresh 比对 spec hash 用)
 *
 * 增量引入策略 (plan D1=B): 老 src/types/api.d.ts 手写文件并行不动, 本 slice
 * 仅消费 study-plan 相关 narrow 类型. 后续 slice 逐步迁移.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, '..');
const SPEC_PATH = resolve(FRONTEND_ROOT, '..', 'apps', 'exam-api', 'spec', 'openapi.json');
const OUT_PATH = resolve(FRONTEND_ROOT, 'src', 'types', 'api.generated.ts');

const specContent = readFileSync(SPEC_PATH, 'utf8');
const specHash = createHash('sha256').update(specContent).digest('hex').slice(0, 16);

// Run openapi-typescript CLI; capture stdout. Fail-fast: any error throws.
const generated = execFileSync(
  'npx',
  ['--no-install', 'openapi-typescript', SPEC_PATH],
  { cwd: FRONTEND_ROOT, encoding: 'utf8', shell: true }
);

const header = `/**
 * AUTO-GENERATED · DO NOT EDIT.
 * Regenerate via: npm run generate:types
 *
 * Source: apps/exam-api/spec/openapi.json
 * Spec SHA-256 (first 16 hex): ${specHash}
 *
 * R1 follow-up: lint:types-fresh CI step compares this hash to spec to detect drift.
 */
`;

writeFileSync(OUT_PATH, header + generated, 'utf8');
console.log(`generate-types: wrote ${OUT_PATH} (spec hash ${specHash})`);
