import { command } from 'clide-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import semver from 'semver';
import {
  avgTimeBetween,
  getCachePath,
  loadCache,
  medianTimeBetween,
  parseTag,
} from '../utils.js';
import updateCommand from './update.js';

const DAY_MS = 1000 * 60 * 60 * 24;

export default command({
  description: 'Print release stats for a repository',
  options: {
    owner: {
      alias: ['o'],
      description: 'The owner of the repository',
      type: 'string',
      required: true,
      default: 'ryangoree',
    },
    repo: {
      alias: ['r'],
      description: 'The repository name',
      type: 'string',
      required: true,
      default: 'clide-js',
    },
    update: {
      alias: ['u'],
      description: 'Update the cache before running',
      type: 'boolean',
      default: false,
    },
    'out-file': {
      alias: ['out', 'f'],
      description: 'The file to write the output to',
      type: 'string',
    },
  },
  handler: async ({ options, fork, next, end }) => {
    const owner = await options.owner();
    const repo = await options.repo();
    const update = await options.update();
    const cachePath = getCachePath(owner, repo);
    const cacheName = basename(cachePath);
    const cachedStatsPath = resolve(
      dirname(cachePath),
      './release-stats/',
      `${cacheName}`
    );

    let stats;

    if (update) {
      await fork({
        commands: [updateCommand],
        optionValues: { owner, repo },
      });
    } else if (existsSync(cachedStatsPath)) {
      stats = JSON.parse(readFileSync(cachedStatsPath, 'utf8'));
    } else {
      const { data } = loadCache(owner, repo);

      if (!data) {
        console.error(
          `No cache found for ${owner}/${repo}. Run with --update / -u to fetch the latest data.`
        );
        return end();
      }

      const { lastUpdated, releaseCount, releases } = data;

      console.log(`Counting release stats for ${owner}/${repo}
  Last updated: ${lastUpdated}
  Total releases: ${releaseCount}`);

      stats = {};
      for (const release of releases) {
        const tag = parseTag(release.tag);
        if (!tag) {
          console.error('\n  Invalid tag:', release, '\n');
          continue;
        }

        const projectName =
          tag.scope && tag.name ? `${tag.scope}/${tag.name}` : tag.name || repo;
        const projectData = (stats[projectName] ||= {
          latest: release,
          original: release,
          majorReleases: [],
          minorReleases: [],
          patchReleases: [],
        });

        const version = semver.parse(release.version);

        if (!version) {
          console.error('\n  Invalid version:', release, '\n');
          continue;
        }

        if (version.prerelease.length) {
          continue;
        }

        const originalVersion = semver.parse(projectData.original.version);
        if (!originalVersion || version.major < originalVersion.major) {
          projectData.original = release;
          projectData.majorReleases.push(release);
        } else if (version.minor < originalVersion.minor) {
          projectData.original = release;
          projectData.minorReleases.push(release);
        } else if (version.patch < originalVersion.patch) {
          projectData.original = release;
          projectData.patchReleases.push(release);
        }
      }

      console.log(`  Writing cache...`);
      mkdirSync(dirname(cachedStatsPath), { recursive: true });
      writeFileSync(cachedStatsPath, JSON.stringify(stats, null, 2));
    }

    console.log(`
  Projects: ${Object.entries(stats)
    .map(([name, { latest, majorReleases, minorReleases, patchReleases }]) => {
      const majorReleaseDates = majorReleases.map(
        (r) => new Date(r.published_at)
      );
      const minorReleaseDates = minorReleases.map(
        (r) => new Date(r.published_at)
      );
      const patchReleaseDates = patchReleases.map(
        (r) => new Date(r.published_at)
      );
      return `
    ${name}: (${latest.version})
      major: ${majorReleases.length}
        avg days between: ${(
          avgTimeBetween(majorReleaseDates) / DAY_MS
        ).toFixed(1)}
        median days between: ${(
          medianTimeBetween(majorReleaseDates) / DAY_MS
        ).toFixed(1)}
      minor: ${minorReleases.length}
        avg days between: ${(
          avgTimeBetween(minorReleaseDates) / DAY_MS
        ).toFixed(1)}
        median days between: ${(
          medianTimeBetween(minorReleaseDates) / DAY_MS
        ).toFixed(1)}
      patch: ${patchReleases.length}
        avg days between: ${(
          avgTimeBetween(patchReleaseDates) / DAY_MS
        ).toFixed(1)}
        median days between: ${(
          medianTimeBetween(patchReleaseDates) / DAY_MS
        ).toFixed(1)}`;
    })
    .join('')}`);

    let outFile = await options.outFile();
    if (outFile !== undefined) {
      // Flag provided with no value, interpret as `true`
      if (!outFile) {
        outFile = `${repo}.json`;
        // const basePath = dirname(new URL(import.meta.url).pathname);
        // outFile = relative(basePath, './stats/', cachePath);
      }
      console.log(`
  Writing stats to ${outFile}`);
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, JSON.stringify(stats, null, 2));
      console.log(`  Stats written to ${outFile}`);
    }

    next(stats);
  },
});
