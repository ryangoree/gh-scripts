import { command } from 'clide-js';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
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
  description: 'Get release stats for a repository',

  options: {
    owner: {
      alias: ['o'],
      description: 'The owner of the repository',
      type: 'string',
      required: true,
    },
    repo: {
      alias: ['r'],
      description: 'The repository name',
      type: 'string',
      required: true,
    },
    calc: {
      alias: ['re-calculate', 'c'],
      description: 'Recalculate the stats from cache',
      type: 'boolean',
      default: false,
    },
    update: {
      alias: ['u'],
      description: 'Update the cache before running',
      type: 'boolean',
      default: false,
    },
    out: {
      alias: ['out-file', 'f'],
      description: 'The file to write the output to',
      type: 'string',
    },
  },

  handler: async ({ client, options, fork, next, end }) => {
    const owner = await options.owner({
      prompt: 'Enter repository owner/organization',
    });
    const repo = await options.repo({
      prompt: 'Enter repository name',
    });

    const cachedStatsPath = getCachePath(owner, repo, 'stats');
    let stats;

    if (await options.update()) {
      await fork({
        commands: [updateCommand],
        optionValues: { owner, repo },
      });
    } else if ((await options.reCalculate()) && existsSync(cachedStatsPath)) {
      rmSync(cachedStatsPath);
    } else {
      const { data } = loadCache(owner, repo, 'stats');
      stats = data;
    }

    let { data } = loadCache(owner, repo);
    if (!data) {
      client.error(
        `No cache found for ${owner}/${repo}. Run with --update / -u to fetch the latest data.`
      );
      const update = await client.prompt({
        message: 'Would you like to refresh the cache now?',
        type: 'toggle',
        default: false,
      });
      if (update) {
        data = await fork({
          commands: [updateCommand],
          optionValues: { owner, repo },
        });
      } else {
        return end();
      }
    }

    if (!stats) {
      stats = {};
      const { lastUpdated, releaseCount, releases } = data;
      const majorVersions = new Map();
      const minorVersions = new Map();

      console.log(`Counting release stats for ${owner}/${repo}
  Last updated: ${lastUpdated}
  Total releases: ${releaseCount}`);

      for (const release of releases.reverse()) {
        const version = semver.parse(release.version);
        if (!version) {
          console.error('\n  Invalid version:', release, '\n');
          continue;
        }
        if (version.prerelease.length) {
          continue;
        }

        const saveData = {
          version: release.version,
          published_at: release.published_at,
          tag: release.tag,
          url: release.url,
        };

        const tag = parseTag(release.tag);
        if (!tag) {
          console.error('\n  Invalid tag:', release, '\n');
          continue;
        }
        const projectName =
          tag.scope && tag.name ? `${tag.scope}/${tag.name}` : tag.name || repo;
        const projectData = (stats[projectName] ??= {
          latest: saveData,
          original: saveData,
          majorReleases: [],
          minorReleases: [],
          patchReleases: [],
        });

        if (version.major && !majorVersions.has(version.major)) {
          majorVersions.set(version.major, version);
          projectData.majorReleases.unshift(saveData);
        } else if (
          version.minor &&
          !minorVersions.has(`${version.major}.${version.minor}`)
        ) {
          minorVersions.set(`${version.major}.${version.minor}`, version);
          projectData.minorReleases.unshift(saveData);
        } else {
          projectData.patchReleases.unshift(saveData);
        }

        const latestVersion = semver.parse(projectData.latest.version);
        if (semver.gt(version, latestVersion)) {
          projectData.latest = saveData;
        }
      }

      console.log(`  Writing cache...`);
      mkdirSync(dirname(cachedStatsPath), { recursive: true });
      writeFileSync(cachedStatsPath, JSON.stringify(stats, null, 2));
    }

    function getReleaseData(release) {
      return new Date(release.published_at);
    }

    console.log(`
Projects: ${Object.entries(stats)
      .map(
        ([name, { latest, majorReleases, minorReleases, patchReleases }]) => {
          const allReleaseDates = [
            ...majorReleases,
            ...minorReleases,
            ...patchReleases,
          ].map(getReleaseData);
          const majorReleaseDates = majorReleases.map(getReleaseData);
          const minorReleaseDates = minorReleases.map(getReleaseData);
          const patchReleaseDates = patchReleases.map(getReleaseData);
          return `
  ${name}: (${latest.version})
    major: ${majorReleases.length}
      avg days between: ${(avgTimeBetween(majorReleaseDates) / DAY_MS).toFixed(
        1
      )}
      median days between: ${(
        medianTimeBetween(majorReleaseDates) / DAY_MS
      ).toFixed(1)}
    minor: ${minorReleases.length}
      avg days between: ${(avgTimeBetween(minorReleaseDates) / DAY_MS).toFixed(
        1
      )}
      median days between: ${(
        medianTimeBetween(minorReleaseDates) / DAY_MS
      ).toFixed(1)}
    patch: ${patchReleases.length}
      avg days between: ${(avgTimeBetween(patchReleaseDates) / DAY_MS).toFixed(
        1
      )}
      median days between: ${(
        medianTimeBetween(patchReleaseDates) / DAY_MS
      ).toFixed(1)}
    total: ${data.releases.length}
      avg days between: ${(avgTimeBetween(allReleaseDates) / DAY_MS).toFixed(1)}
      median days between: ${(
        medianTimeBetween(allReleaseDates) / DAY_MS
      ).toFixed(1)}`;
        }
      )
      .join('')}`);

    let outFile = await options.outFile();
    if (outFile !== undefined) {
      outFile ||= `./out/${repo}.json`;
      console.log(`
  Writing stats to ${outFile}`);
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, JSON.stringify(stats, null, 2));
      console.log(`  Stats written to ${outFile}
`);
    }

    next(stats);
  },
});
