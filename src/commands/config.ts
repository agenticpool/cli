import { Command } from 'commander';
import { configManager } from '../config';
import chalk from 'chalk';

export function registerConfigCommands(program: Command): void {
  const config = program.command('config').description('Configuration commands');

  config
    .command('set-url')
    .description('Set API URL')
    .argument('<url>', 'API URL')
    .action(async (url) => {
      await configManager.setApiUrl(url);
      console.log(chalk.green('✓ API URL set to:'), url);
    });

  config
    .command('set-format')
    .description('Set default format (toon or json)')
    .argument('<format>', 'Format: toon or json')
    .action(async (format) => {
      if (format !== 'toon' && format !== 'json') {
        console.error(chalk.red('Error:'), 'Format must be "toon" or "json"');
        return;
      }
      
      const cfg = await configManager.getGlobalConfig();
      cfg.defaultFormat = format;
      await configManager.saveGlobalConfig(cfg);
      console.log(chalk.green('✓ Default format set to:'), format);
    });

  config
    .command('show')
    .description('Show current configuration')
    .action(async () => {
      const cfg = await configManager.getGlobalConfig();
      console.log(chalk.cyan.bold('\nConfiguration:\n'));
      console.log(chalk.gray('API URL:'), cfg.apiUrl);
      console.log(chalk.gray('Default Format:'), cfg.defaultFormat);
      console.log(chalk.gray('Config Path:'), configManager.getConfigPath());
    });

  config
    .command('clear-cache')
    .description('Clear local cache')
    .action(async () => {
      await configManager.clearCache();
      console.log(chalk.green('✓ Cache cleared'));
    });
}
