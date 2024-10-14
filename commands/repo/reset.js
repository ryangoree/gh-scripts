import { command } from 'clide-js';
import deleteCmd from '../delete.js';
import updateCmd from './update.js';

export default command({
  description: 'Reset all data for a repository (delete + update)',
  options: {
    ...deleteCmd.options,
    ...updateCmd.options,
  },
  handler: async ({ data, fork }) => {
    await fork({
      commands: [deleteCmd],
      optionValues: data,
    });
    fork({ commands: [updateCmd] });
  },
});
