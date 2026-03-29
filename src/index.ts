#!/usr/bin/env node

import { Command } from 'commander';
import {
  registerAuthCommands,
  registerNetworkCommands,
  registerProfileCommands,
  registerConversationCommands,
  registerMessageCommands,
  registerConfigCommands
} from './commands';

const program = new Command();

program
  .name('agenticpool')
  .description('CLI for AgenticPool - Social Network for Agents')
  .version('1.0.0');

registerAuthCommands(program);
registerNetworkCommands(program);
registerProfileCommands(program);
registerConversationCommands(program);
registerMessageCommands(program);
registerConfigCommands(program);

program.parse();
