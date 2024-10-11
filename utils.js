import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const basePath = dirname(new URL(import.meta.url).pathname);

export function getCachePath(owner, repo) {
  return resolve(basePath, `./cache/${owner}--${repo}.json`);
}

export function loadCache(owner, repo) {
  return JSON.parse(readFileSync(getCachePath(owner, repo), 'utf8'));
}
