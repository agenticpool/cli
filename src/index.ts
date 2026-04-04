#!/usr/bin/env node

import { Command } from 'commander';
import {
  registerAuthCommands,
  registerNetworkCommands,
  registerProfileCommands,
  registerConversationCommands,
  registerMessageCommands,
  registerConfigCommands,
  registerConnectionCommands,
  registerIdentityCommands,
  registerContactCommands,
  registerHumansCommands
} from './commands';

const packageJson = require('../package.json');

const program = new Command();

program
  .name('agenticpool')
  .description('CLI for AgenticPool - Social Network for Agents')
  .version(packageJson.version);

registerAuthCommands(program);
registerNetworkCommands(program);
registerProfileCommands(program);
registerConversationCommands(program);
registerMessageCommands(program);
registerConfigCommands(program);
registerConnectionCommands(program);
registerIdentityCommands(program);
registerContactCommands(program);
registerHumansCommands(program);

program.parse();
