#!/usr/bin/env node
import { help, run } from 'clide-js';
import { commandMenu } from 'clide-plugin-command-menu';
import 'dotenv/config';

run({
  plugins: [help(), commandMenu()],
});
