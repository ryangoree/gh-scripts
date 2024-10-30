import { command } from 'clide-js';
import { Op } from 'sequelize';
import { Project, Release, Repo, sql } from '../../data/sql.js';

export default command({
  description: 'Delete all data for a repository',

  options: {
    o: {
      alias: ['owner'],
      description: 'The owner or organization of the repository to delete',
      type: 'string',
      required: true,
    },
    n: {
      alias: ['name', 'r', 'repo'],
      description: 'The name of the repository to delete',
      type: 'string',
      required: true,
    },
  },

  handler: async ({ data }) => {
    const { owner, name } = data;
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
