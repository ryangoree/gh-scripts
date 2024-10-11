import { command } from 'clide-js';
import statsCommand from '../../stats.js';

export default command({
  ...statsCommand,
  handler: async ({ params, fork }) => {
    const { owner, repo } = params;
    return fork({
      commands: [statsCommand],
      optionValues: { owner, repo },
    });
  },
});
