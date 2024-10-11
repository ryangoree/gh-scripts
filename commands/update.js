import { command } from 'clide-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Octokit } from 'octokit';
import semver from 'semver';
import { getCachePath } from '../utils.js';

export default command({
  description: 'Update the cache for a repository',
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
    pages: {
      alias: ['p', 'max-pages'],
      description: 'The number of pages to fetch',
      type: 'number',
      default: 5,
    },
    'page-size': {
      alias: ['s'],
      description: 'The number of releases per page',
      type: 'number',
    },
    token: {
      alias: ['t'],
      description: 'The GitHub token to use for authentication',
      type: 'secret',
      required: true,
      default: process.env.GITHUB_TOKEN,
    },
  },
  handler: async ({ options, next }) => {
    const owner = await options.owner();
    const repo = await options.repo();
    const { pages, token } = await options.get(['pages', 'token']);

    // Cache
    const cachePath = getCachePath(owner, repo);
    const cachedData = existsSync(cachePath)
      ? JSON.parse(readFileSync(cachePath, 'utf8'))
      : undefined;
    const latestReleaseDateCached = new Date(
      cachedData?.releases[0].published_at || 0
    );

    const pageSize = options.values.pageSize ?? cachedData ? 30 : 100;

    // GitHub Client
    const octokit = new Octokit({ auth: token });

    console.log(`Fetching releases for ${owner}/${repo}
  last updated: ${cachedData ? Date(cachedData.lastUpdated) : 'never'}
  max pages: ${pages}
  page size: ${pageSize}`);

    const releases = [];
    for (let page = 1; page <= pages; page++) {
      console.log(`Fetching page ${page}...`);

      // Fetch a page of releases
      let { data: fetchedReleases } = await octokit.rest.repos
        .listReleases({
          owner,
          repo,
          per_page: pageSize,
          page,
        })
        .catch((err) => {
          console.error('Error fetching releases:', err);
          process.exit(1);
        });

      // Filter out releases that are already cached
      if (cachedData) {
        fetchedReleases = fetchedReleases.filter(
          (r) => new Date(r.published_at) > latestReleaseDateCached
        );
      }

      // No releases
      if (!fetchedReleases.length) {
        console.log('No new releases found...');
        break;
      }

      // Prep releases
      fetchedReleases = fetchedReleases.map((r) => ({
        version: semver.clean(r.tag_name.replace(/(^.+@)?v?/, '')),
        published_at: r.published_at,
        tag: r.tag_name,
        url: r.html_url,
      }));

      // Update data
      releases.push(...fetchedReleases);

      if (fetchedReleases.length < pageSize) {
        console.log('No more releases to fetch...');
        break;
      }

      // Wait a second before fetching the next page
      setTimeout(() => {}, 1000);
    }

    if (cachedData) {
      releases.push(...cachedData.releases);
    }

    console.log('Writing cache...');

    const newData = {
      lastUpdated: new Date().toISOString(),
      releaseCount: releases.length,
      releases,
    };
    writeFileSync(cachePath, JSON.stringify(newData, null, 2));

    console.log(`Cache updated:
  path: ${cachePath}
  last updated: ${cachedData?.lastUpdated || 'n/a'} -> ${newData.lastUpdated}
  release count: ${cachedData?.releaseCount || 0} -> ${newData.releaseCount}
  new releases: ${releases.length - (cachedData?.releaseCount || 0)}`);

    next(newData);
  },
});
