import { command } from 'clide-js';
import deleteCommand from './delete.js';
import updateCommand from './update.js';

export default command({
  description: 'Refresh the cache for a repository by deleting and updating it',

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

  handler: async ({ options, fork, next }) => {
    const owner = await options.owner({
      prompt: 'Enter repository owner/organization',
    });
    const repo = await options.repo({
      prompt: 'Enter repository name',
    });
    await fork({
      commands: [deleteCommand],
      optionValues: { owner, repo },
    });
    next(
      fork({
        commands: [updateCommand],
        optionValues: { owner, repo },
      })
    );
  },
});
