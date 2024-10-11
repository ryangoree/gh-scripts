import { command } from 'clide-js';
import { mkdirSync, writeFileSync } from 'node:fs';
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
  isMiddleware: false,
  requiresSubcommands: false,

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

  handler: async ({ client, options, fork, next, end }) => {
    const owner = await options.owner({
      prompt: 'Enter repository owner/organization',
    });
    const repo = await options.repo({
      prompt: 'Enter repository name',
    });
    const update = await options.update();

    const cachedStatsPath = getCachePath(owner, repo, 'stats');
    let stats;

    if (update) {
      await fork({
        commands: [updateCommand],
        optionValues: { owner, repo },
      });
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
        message: 'Would you like to update the cache now?',
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

      console.log(`Counting release stats for ${owner}/${repo}
  Last updated: ${lastUpdated}
  Total releases: ${releaseCount}`);

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
          original: undefined,
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

        const originalVersion =
          projectData.original && semver.parse(projectData.original.version);
        if (!originalVersion || version.major < originalVersion.major) {
          projectData.majorReleases.push(projectData.original);
          projectData.original = release;
        } else if (version.minor < originalVersion.minor) {
          projectData.minorReleases.push(projectData.original);
          projectData.original = release;
        } else if (version.patch < originalVersion.patch) {
          projectData.patchReleases.push(projectData.original);
          projectData.original = release;
        }
      }

      console.log(`  Writing cache...`);
      mkdirSync(dirname(cachedStatsPath), { recursive: true });
      writeFileSync(cachedStatsPath, JSON.stringify(stats, null, 2));
    }

    console.log(`
Projects: ${Object.entries(stats)
      .map(
        ([name, { latest, majorReleases, minorReleases, patchReleases }]) => {
          const allReleaseDates = [
            ...majorReleases,
            ...minorReleases,
            ...patchReleases,
          ].map((r) => new Date(r.published_at));
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
