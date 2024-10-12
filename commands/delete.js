import { command } from 'clide-js';
import { existsSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { getCachePath, recursiveRead } from '../utils.js';

export default command({
  description: 'Delete all cached data for a repository',

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
  },

  handler: async ({ options, next }) => {
    const owner = await options.owner({
      prompt: 'Enter repository owner/organization',
    });
    const repo = await options.repo({
      prompt: 'Enter repository name',
    });

    // Delete the cache
    const path = getCachePath(owner, repo);
    const doesExist = existsSync(path);
    if (doesExist) {
      console.log(`Deleting cache at ${path}`);
      rmSync(path);
    }

    // Delete any keyed cache
    const filename = basename(path);
    recursiveRead(dirname(path), {
      onDir: (dirPath) => {
        const path = resolve(dirPath, filename);
        if (existsSync(path)) {
          console.log(`  Deleting keyed cache at ${path}`);
          rmSync(path);
        }
      },
    });

    console.log('  Cache deleted\n');

    next(doesExist);
  },
});
