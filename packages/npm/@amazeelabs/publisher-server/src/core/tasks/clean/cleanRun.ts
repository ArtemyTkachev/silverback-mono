import { getConfig } from '../../tools/config';
import { Task } from '../../tools/queue';
import { run } from '../../tools/runner';

export const cleanRunTask: Task = async (controller) => {
  const process = run({ command: getConfig().commands.clean, controller });
  await process.result;
};
