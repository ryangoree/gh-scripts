import { command } from 'clide-js';
import statsCommand from '../../stats.js';

export default command({
  ...statsCommand,
  handler: async ({ params, fork }) => {
    return fork({
      commands: [statsCommand],
      optionValues: {
        owner: params.owner,
        repo: params.repo,
      },
    });
  },
});
