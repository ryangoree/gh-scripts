import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const basePath = dirname(new URL(import.meta.url).pathname);

export function getCachePath(owner, repo) {
  return resolve(basePath, `./.cache/${owner}--${repo}.json`);
}

export function loadCache(owner, repo) {
  const cachePath = getCachePath(owner, repo);
  return {
    cachePath,
    data: existsSync(cachePath)
      ? JSON.parse(readFileSync(cachePath, 'utf8'))
      : undefined,
  };
}

export function parseTag(tag) {
  const match = tag.match(
    /^([^@\s]+\/)?((@([^\/\s]*))?\/?([^\s]+)@)?v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
  );

  if (!match) {
    return null;
  }

  const [
    // Full match
    _,
    // path (e.g. "refs/tags/")
    __,
    // Full prefix minus the optional "v" (e.g. refs/tags/@scope/name@)
    ___,
    // Scope with the "@" (e.g. "@scope")
    ____,
    scope,
    name,
    major,
    minor,
    patch,
    prerelease,
    build,
  ] = match;

  return {
    scope,
    name,
    major: +major,
    minor: +minor,
    patch: +patch,
    prerelease,
    build,
  };
}

export function avgTimeBetween(timestamps) {
  if (timestamps.length <= 1) return 0;
  return (timestamps[0] - timestamps.at(-1)) / (timestamps.length - 1);
}

export function medianTimeBetween(timestamps) {
  if (timestamps.length <= 1) return 0;
  const leftIndex = Math.floor(timestamps.length / 2);
  const left = timestamps[leftIndex];
  const right = timestamps[leftIndex + 1];
  return left - right;
}
