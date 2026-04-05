import { Command } from 'commander';
import { AuthHelper } from '../auth/AuthHelper';
const chalk = require('chalk');

export function registerProfileCommands(program: Command): void {
  const profile = program.command('profile').description('Profile management commands');

  profile
    .command('questions')
    .description('Get profile questions for a network')
    .requiredOption('-n, --network <id>', 'Network ID')
    .action(async (options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>(`/v1/networks/${options.network}/questions`);

        if (response.success && response.data) {
          if (response.data.length === 0) {
            console.log(chalk.yellow('No profile questions for this network.'));
            return;
          }

          console.log(chalk.green.bold('\nProfile Questions:\n'));

          response.data.forEach((q: any, index: number) => {
            console.log(chalk.cyan(`${index + 1}. ${q.question}`));
            console.log(chalk.gray(`   Required: ${q.required ? 'Yes' : 'No'}`));
            console.log();
          });
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to get questions');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  profile
    .command('set')
    .description('Set your profile for a network')
    .requiredOption('-n, --network <id>', 'Network ID')
    .option('-s, --short <desc>', 'Short description')
    .option('-l, --long <desc>', 'Long description')
    .option('-f, --long-file <file>', 'Read long description from file')
    .action(async (options: any) => {
      try {
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        let longDescription = options.long;
        if (options.longFile) {
          const filePath = options.longFile;
          longDescription = require('fs').readFileSync(filePath, 'utf-8');
        }

        const updateData: any = {};
        if (options.short) updateData.shortDescription = options.short;
        if (longDescription) updateData.longDescription = longDescription;

        const response = await client.put(`/v1/networks/${options.network}/profile`, updateData);

        if (response.success) {
          console.log(chalk.green('✓ Profile updated successfully!'));
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to update profile');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  profile
    .command('get')
    .description('Get your profile for a network')
    .requiredOption('-n, --network <id>', 'Network ID')
    .action(async (options: any) => {
      try {
        const { client, credentials } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.get<any>(`/v1/networks/${options.network}/profile`);

        if (response.success && response.data) {
          const profile = response.data;
          console.log(chalk.cyan.bold('\nYour Profile\n'));
          console.log(chalk.gray('Public Token:'), credentials.publicToken);
          console.log(chalk.gray('Role:'), profile.role || 'member');
           console.log(chalk.gray('Short Description:'), profile.shortDescription || '(none)');

          if (profile.longDescription) {
            console.log(chalk.gray('\nLong Description:'));
            console.log(profile.longDescription);
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to get profile');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  profile
    .command('build')
    .description('Build profile interactively')
    .requiredOption('-n, --network <id>', 'Network ID')
    .option('-i, --interactive', 'Interactive mode', true)
    .action(async (options: any) => {
      try {
        const { client } = await AuthHelper.ensureAuthenticated(options.network);
        const response = await client.get<any[]>(`/v1/networks/${options.network}/questions`);

        if (!response.success || !response.data || response.data.length === 0) {
          console.log(chalk.yellow('No profile questions for this network.'));
          return;
        }

        const questions = response.data;
        const answers: Record<string, string> = {};

        console.log(chalk.green.bold('\nBuilding Your Profile\n'));
        console.log(chalk.gray(`Found ${questions.length} profile questions\n`));

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          console.log(chalk.cyan(`${i + 1}. ${q.question}`));
          console.log(chalk.gray('   Required:'), q.required ? 'Yes' : 'No');

          if (q.required) {
            const answer = await askQuestion(q.question + ' ');
            if (!answer.trim()) {
              console.error(chalk.red('Required question missing answer. Please try again.'));
              process.exit(1);
            }
            answers[q.id || `question_${i}`] = answer;
          } else {
            const answer = await askQuestion(q.question + ' (optional): ');
            if (answer.trim()) {
              answers[q.id || `question_${i}`] = answer;
            }
          }

          console.log();
        }

        console.log(chalk.green.bold('\nCompleting profile...\n'));

        const completeResponse = await client.post(`/v1/networks/${options.network}/profile/complete`, {
          answers
        });

        if (completeResponse.success && completeResponse.data) {
          const data = completeResponse.data as any;
          console.log(chalk.green('✓ Profile built successfully!\n'));
          console.log(chalk.cyan('Completion:'), `${data.completionPercentage}%`);

          if (data.recommendations && data.recommendations.conversationsToJoin && data.recommendations.conversationsToJoin.length > 0) {
            console.log(chalk.yellow('\nRecommended conversations to join:'));
            data.recommendations.conversationsToJoin.forEach((convId: string) => {
              console.log(chalk.gray('  -'), convId);
            });
          }

          if (data.recommendations && data.recommendations.networkStrengths && data.recommendations.networkStrengths.length > 0) {
            console.log(chalk.yellow('\nYour network strengths:'));
            data.recommendations.networkStrengths.forEach((strength: string) => {
              console.log(chalk.gray('  -'), strength);
            });
          }
        } else {
          console.error(chalk.red('Error:'), completeResponse.error?.message || 'Failed to complete profile');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });
}

async function askQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setEncoding('utf-8');
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}
