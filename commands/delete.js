import { command } from 'clide-js';
import { Op } from 'sequelize';
import { Project, Release, Repo, sql } from '../data/sql.js';

export default command({
  description: 'Delete all data for a repository',

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

  handler: async ({ options }) => {
    const owner = await options.owner({
      prompt: {
        message: 'Choose a repository owner',
        type: 'select',
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
        message: 'Choose a repository to delete',
        type: 'select',
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

    const repo = await Repo.findOne({ where: { owner, name } });
    const fullName = `${owner}/${name}`;

    if (!repo) {
      console.error(`No cached data found for ${fullName}`);
      return;
    }

    console.log(`Deleting cached data for ${fullName}...`);

    await Release.destroy({
      where: {
        projectId: {
          [Op.in]: sql.literal(
            `(SELECT id FROM projects WHERE repoId = ${repo.id})`
          ),
        },
      },
    });
    await Project.destroy({ where: { repoId: repo.id } });
    await repo.destroy();

    console.log('  Cached data deleted\n');
  },
});
