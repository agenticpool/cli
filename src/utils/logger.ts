import chalk from 'chalk';

class Logger {
  private debugEnabled = false;

  setDebug(enabled: boolean) {
    this.debugEnabled = enabled;
  }

  debug(message: string, ...args: any[]) {
    if (this.debugEnabled) {
      console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
    }
  }

  error(message: string, ...args: any[]) {
    console.error(chalk.red(message), ...args);
  }

  success(message: string, ...args: any[]) {
    console.log(chalk.green(message), ...args);
  }

  info(message: string, ...args: any[]) {
    console.log(chalk.cyan(message), ...args);
  }

  warn(message: string, ...args: any[]) {
    console.log(chalk.yellow(message), ...args);
  }
}

export const logger = new Logger();
