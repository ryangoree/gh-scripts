import { command } from 'clide-js';
import { Octokit } from 'octokit';
import semver from 'semver';
import { Project, Release, Repo } from '../../data/sql.js';
import { parseTag } from '../../utils.js';

export default command({
  description: 'Update the data for a repository by fetching new releases',

  options: {
    o: {
      alias: ['owner'],
      description:
        'The owner or organization of the repository to fetch data for',
      type: 'string',
      required: true,
    },
    n: {
      alias: ['name', 'r', 'repo'],
      description: 'The name of the repository to fetch data for',
      type: 'string',
      required: true,
    },
    t: {
      alias: ['token', 'github-token'],
      description: 'The GitHub token to use for authentication',
      type: 'secret',
      required: true,
      default: process.env.GITHUB_TOKEN,
    },
    p: {
      alias: ['pages', 'max-pages'],
      description: 'The max number of pages to fetch',
      type: 'number',
      default: 5,
    },
    s: {
      alias: ['size', 'page-size'],
      description: 'The number of releases to fetch per page. Max 100',
      type: 'number',
    },
  },

  handler: async ({ data, options }) => {
    const { owner, name } = data;
    const [repo, isNew] = await Repo.findOrCreate({
      where: { owner, name },
      include: {
        model: Project,
        attributes: ['id'],
        include: {
          model: Release,
          attributes: ['id'],
        },
      },
    });
    const fullName = `${owner}/${name}`;
    const lastUpdated = !isNew ? new Date(repo.updatedAt) : null;
    const existingProjectCount = repo.projects?.length || 0;
    const existingReleaseCount =
      repo.projects?.flatMap((p) => p.releases).length || 0;

    // Prep GitHub client
    const token = await options.token();
    const gh = new Octokit({ auth: token });
    const maxPages = await options.maxPages();
    let pageSize = await options.pageSize();

    if (!pageSize) pageSize = isNew ? 100 : 30;
    if (pageSize > 100) {
      console.warn('Page size too large, setting to 100...');
      pageSize = 100;
    }

    console.log(`Fetching releases for ${fullName}...
  Last updated: ${lastUpdated || 'never'}
  Max pages: ${maxPages}
  Page size: ${pageSize}`);

    let newProjectCount = 0;
    let newReleaseCount = 0;
    for (let page = 1; page <= maxPages; page++) {
      console.log(`  Fetching page ${page}...`);

      // Fetch a page of releases
      let { data: newReleases } = await gh.rest.repos
        .listReleases({
          owner,
          repo: name,
          per_page: pageSize,
          page,
        })
        .catch((err) => {
          console.error('  Error fetching releases:', err);
          process.exit(1);
        });

      // Filter out seen
      if (lastUpdated) {
        newReleases = newReleases.filter(
          (r) => new Date(r.published_at) > lastUpdated
        );
      }

      // No new
      if (!newReleases.length) {
        console.log('  No new releases found...');
        break;
      }

      // Save new
      for (const { tag_name, published_at, html_url } of newReleases) {
        const parsedTag = parseTag(tag_name);
        const version = semver.valid(
          semver.coerce(tag_name, {
            includePrerelease: true,
          })
        );
        const [project, isNewProject] = await Project.findOrCreate({
          where: {
            // Default to repo name if valid tag, null if not
            name: parsedTag?.project || (!!parsedTag ? name : null),
            repoId: repo.id,
          },
        });
        const [, isNewRelease] = await Release.findOrCreate({
          where: {
            projectId: project.id,
            tag: tag_name,
          },
          defaults: {
            version,
            date: published_at,
            tag: tag_name,
            url: html_url,
            projectId: project.id,
          },
        });

        if (isNewProject) newProjectCount++;
        if (isNewRelease) newReleaseCount++;
      }

      // Reached end
      if (newReleases.length < pageSize) {
        console.log('  No more releases to fetch...');
        break;
      }

      // Reached max pages
      if (page === maxPages) {
        console.warn(`  Reached max pages: ${maxPages}`);
      } else {
        // Wait a second before fetching the next page
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`
Data updated for ${fullName}
  Repo ID: ${repo.id}
  Last updated: ${
    lastUpdated?.toISOString() || 'n/a'
  } -> ${repo.updatedAt.toISOString()}
  Project count: ${existingProjectCount} -> ${
      existingProjectCount + newProjectCount
    } (${newProjectCount} new)
  Release count: ${existingReleaseCount} -> ${
      existingReleaseCount + newReleaseCount
    } (${newReleaseCount} new)
`);
  },
});
