import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const QUERIES_DIR = resolve(ROOT, 'packages', 'api-client', 'src', 'queries');

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walk(fullPath));
      continue;
    }
    if (extname(fullPath) === '.ts') {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(QUERIES_DIR).filter((file) => !file.includes(`${resolve(QUERIES_DIR, '__tests__')}`));
const seen = new Map();
const duplicates = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const match = source.match(/all:\s*\[\s*'([^']+)'/);
  if (!match) {
    continue;
  }
  const prefix = match[1];
  const previous = seen.get(prefix);
  if (previous) {
    duplicates.push({ prefix, first: previous, second: basename(file) });
  } else {
    seen.set(prefix, basename(file));
  }
}

if (duplicates.length > 0) {
  for (const duplicate of duplicates) {
    console.error(
      `duplicate query key prefix "${duplicate.prefix}" in ${duplicate.first} and ${duplicate.second}`,
    );
  }
  process.exit(1);
}

console.log(`query-key-uniqueness: checked ${files.length} query files, no duplicate all-prefix found`);
