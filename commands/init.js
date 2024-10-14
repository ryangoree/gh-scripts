import { command } from 'clide-js';
import { sql } from '../data/sql.js';

export default command({
  description: 'Initialize the database (local sqlite3)',

  options: {
    force: {
      alias: ['f'],
      description: 'Force the initialization (drop all tables)',
      type: 'boolean',
      default: false,
    },
  },

  handler: async ({ options }) => {
    let force = await options.force();
    await sql.sync({ force });
    console.log('Database initialized');
  },
});
