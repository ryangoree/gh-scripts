import { command } from 'clide-js';
import semver from 'semver';
import { loadCache } from '../utils.js';

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
  },
  handler: async ({ options, next }) => {
    const owner = await options.owner();
    const repo = await options.repo();

    // Load cached data
    const { lastUpdated, releaseCount, releases } = loadCache(owner, repo);

    console.log(`${owner}/${repo}
    Last updated: ${lastUpdated}
    Total releases: ${releaseCount}
    `);

    const majorReleases = [];
    const minorReleases = [];
    const patchReleases = [];

    // {
    //   "version": "1.3.1",
    //   "published_at": "2023-12-15T08:51:56Z",
    //   "tag": "v1.3.1",
    //   "url": "https://github.com/ryangoree/tesm-node/releases/tag/v1.3.1"
    // },

    for (const release of releases) {
      const version = semver.parse(release.version);
      if (!version) {
        console.log('Invalid version:', release);
        break;
      }
      if (version.patch === 0) {
        if (version.minor === 0) {
          majorReleases.push(release);
        } else {
          minorReleases.push(release);
        }
      } else {
        patchReleases.push(release);
      }
    }

    console.log('  Major releases:', majorReleases);
  },
});
