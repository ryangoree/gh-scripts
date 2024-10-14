import { command } from 'clide-js';

export default command({
  description: 'Commands for managing repositories',
  requiresSubcommand: true,

  options: {
    o: {
      alias: ['owner'],
      description: 'The owner of the repository',
      type: 'string',
      required: true,
    },
    n: {
      alias: ['name', 'r', 'repo'],
      description: 'The repository name',
      type: 'string',
      required: true,
    },
  },

  handler: async ({ options, next }) => {
    const owner = await options.owner({
      prompt: 'Enter repository owner/organization',
    });
    const name = await options.name({
      prompt: 'Enter repository name',
    });

    next({ owner, name });
  },
});
