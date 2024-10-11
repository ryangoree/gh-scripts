import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const basePath = dirname(new URL(import.meta.url).pathname);

export function getCachePath(owner, repo, subDir) {
  const dirPathParts = [basePath, './.cache/'];
  if (subDir) {
    dirPathParts.push(subDir);
  }
  return resolve(...dirPathParts, `${owner}--${repo}.json`);
}

export function loadCache(owner, repo, subDir) {
  const cachePath = getCachePath(owner, repo, subDir);
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
  const diffs = [];

  for (const [i, timestamp] of timestamps.entries()) {
    if (i === 0) continue;
    diffs.push(timestamps[i - 1] - timestamp);
  }

  diffs.sort((a, b) => a - b);

  if (diffs.length % 2) {
    const midIndex = Math.floor(diffs.length / 2);
    return avgTimeBetween(diffs.slice(midIndex - 1, midIndex + 1));
  }

  return diffs[diffs.length / 2];
}
