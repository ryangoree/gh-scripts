import { command } from 'clide-js';
import { Repo } from '../data/sql.js';

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
      prompt: {
        message: 'Enter repository owner/organization',
        type: 'autocomplete',
        choices: async () => {
          const repos = await Repo.findAll({
            attributes: ['owner'],
            group: ['owner'],
          });
          return repos.map((r) => ({
            title: r.owner,
            value: r.owner,
          }));
        },
      },
    });

    const name = await options.name({
      prompt: {
        message: 'Enter repository name',
        type: 'autocomplete',
        choices: async () => {
          const repos = await Repo.findAll({
            attributes: ['name'],
            where: { owner },
          });
          return repos.map((r) => ({
            title: r.name,
            value: r.name,
          }));
        },
      },
    });

    next({ owner, name });
  },
});
