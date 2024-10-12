import { command } from 'clide-js';
import { writeFileSync } from 'node:fs';
import { Octokit } from 'octokit';
import semver from 'semver';
import { loadCache } from '../utils.js';

export default command({
  description: 'Update the cache for a repository',

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
    const owner = await options.owner({
      prompt: 'Enter repository owner/organization',
    });
    const repo = await options.repo({
      prompt: 'Enter repository name',
    });

    // Cache
    const { cachePath, data: cachedData } = loadCache(owner, repo);
    const latestReleaseDateCached = new Date(
      cachedData?.releases[0].published_at || 0
    );

    let {
      pages,
      pageSize = cachedData ? 30 : 100,
      token,
    } = await options.get(['pages', 'page-size', 'token']);

    // GitHub Client
    const octokit = new Octokit({ auth: token });

    console.log(`Fetching releases for ${owner}/${repo}
  Last updated: ${cachedData ? Date(cachedData.lastUpdated) : 'never'}
  Max pages: ${pages}
  Page size: ${pageSize}`);

    const releases = [];
    for (let page = 1; page <= pages; page++) {
      console.log(`  Fetching page ${page}...`);

      // Fetch a page of releases
      let { data: fetchedReleases } = await octokit.rest.repos
        .listReleases({
          owner,
          repo,
          per_page: pageSize,
          page,
        })
        .catch((err) => {
          console.error('  Error fetching releases:', err);
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
        console.log('  No new releases found...');
        break;
      }

      // Prep releases
      fetchedReleases = fetchedReleases.map(
        ({ published_at, tag_name, html_url }) => ({
          version: semver.clean(tag_name.replace(/(^.+@)?v?/, '')),
          published_at,
          tag: tag_name,
          url: html_url,
        })
      );

      // Update data
      releases.push(...fetchedReleases);

      if (fetchedReleases.length < pageSize) {
        console.log('  No more releases to fetch...');
        break;
      }

      if (page === pages) {
        console.log(`  Reached max pages: ${pages}`);
      } else {
        // Wait a second before fetching the next page
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (cachedData) {
      releases.push(...cachedData.releases);
    }

    console.log('  Writing cache...');

    const newData = {
      lastUpdated: new Date().toISOString(),
      releaseCount: releases.length,
      releases,
    };
    writeFileSync(cachePath, JSON.stringify(newData, null, 2));

    console.log(`
Cache updated:
  Path: ${cachePath}
  Last updated: ${cachedData?.lastUpdated || 'n/a'} -> ${newData.lastUpdated}
  Release count: ${cachedData?.releaseCount || 0} -> ${newData.releaseCount}
  New releases: ${releases.length - (cachedData?.releaseCount || 0)}
`);

    next(newData);
  },
});
