#!/usr/bin/env node
import { Octokit } from 'octokit';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import semver from 'semver';
import 'dotenv/config';

// Settings
const args = process.argv.slice(2);
const owner = args[0];
const repo = args[1];
const maxRequests = args[2] || 5;
const pageSize = 100;

// Cache
const cachePath = `./cache/${owner}--${repo}.json`;
const cachedData = existsSync(cachePath)
  ? JSON.parse(readFileSync(cachePath, 'utf8'))
  : undefined;
const latestReleaseDateCached = new Date(
  cachedData?.releases[0].published_at || 0
);

// GitHub Client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

console.log(`Fetching releases for ${owner}/${repo}
  page size: ${pageSize}
  max requests: ${maxRequests}
  last updated: ${cachedData ? Date(cachedData.lastUpdated) : 'never'}`);

const releases = [];
for (let page = 1; page <= maxRequests; page++) {
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
  newData.releaseCount += fetchedReleases.length;
  newData.releases.unshift(...fetchedReleases);

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
writeFileSync(
  cachePath,
  JSON.stringify(
    {
      lastUpdated: Date.now(),
      releaseCount: releases.length,
      releases,
    },
    null,
    2
  )
);
console.log('Done!');
