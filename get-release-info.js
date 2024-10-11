#!/usr/bin/env node
// import semver from 'semver';
// import web3 from './web3.json';

const DAY_MS = 1000 * 60 * 60 * 24;

const args = process.argv.slice(2);
const owner = args[0];
const repo = args[1];
const updateCache = args[2] === 'true';

const cachePath = `./cache/${owner}--${repo}.json`;
let cachedData = require(cachePath);
let lastUpdated = cachedData?.lastUpdated;

if (!cachedData || updateCache) {
  const pageSize = 100;
  let page = 1;
  let foundNew = false;
  let hasMore = true;

  while (hasMore) {
    const { data: fetchedReleases } = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: pageSize,
      page,
    });
    const latestFetched = fetchedReleases[0];

    // No releases
    if (!latestFetched) {
      break;
    }

    // Check if if the latest release is older than the last update
    if (!foundNew) {
      if (new Date(latestFetched.published_at).getTime() <= lastUpdated) {
        // No new releases
        break;
      } else {
        foundNew = true;
        lastUpdated = Date.now();
      }
    }

    // const release = {
    //   tag: '',
    //   published_at: '',
    //   url: '',
    // }

    // Update cache
    if (!cachedData) {
      cachedData = {
        lastUpdated,
        releaseCount: fetchedReleases.length,
        releases: fetchedReleases,
      };
      hasMore = fetchedReleases.length === pageSize;
    } else {
      const latestCachedPublishDate = new Date(
        cachedData?.releases[0].published_at
      );
      const newReleases = fetchedReleases.filter((r) => {
        return new Date(r.published_at) > latestCachedPublishDate;
      });
      cachedData.releases.unshift(...newReleases);
      hasMore = newReleases.length === pageSize;
    }
  } // end while
} // end if (!data || updateCache)

const { data } = await octokit.rest.repos.listReleases({
  owner,
  repo,
  per_page: 3,
});

const releaseCount = cachedData.length;

const latestReleaseData = cachedData[0];
const latest = semver.parse(latestReleaseData.tag_name);
const latestReleaseDate = new Date(latestReleaseData.published_at).getTime();
const latestReleaseAge = (Date.now() - latestReleaseDate) / DAY_MS;

console.log({
  releaseCount,
  latest,
  latestReleaseDate,
  latestReleaseAge,
});

const majorReleases = [];
const minorReleases = [];
const patchReleases = [];

// if (latest.minor === '0') {
//   majorReleases.push(latest);
// } else if (latest.patch === '0') {
//   minorReleases.push(latest);
// }

// FIXME: replace web3 with entries
// for (const r of entries.reverse()) {
//   // for (const r of web3.reverse()) {
//   const version = semver.parse(r.tagName);
//   if (version.major > currentVersion.major) {
//     majorReleases.push(r);
//   } else if (version.minor > currentVersion.minor) {
//     minorReleases.push(r);
//   } else if (version.patch > currentVersion.patch) {
//     patchReleases.push(r);
//   }
// }
