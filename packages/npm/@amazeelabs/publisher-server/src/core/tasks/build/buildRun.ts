import { core } from '../../core';
import { getConfig } from '../../tools/config';
import { Task } from '../../tools/queue';
import { run } from '../../tools/runner';
import { cleanRunTask } from '../clean/cleanRun';

export const buildRunTask: Task = async (controller) => {
  core.state.buildStatus.build = 'InProgress';

  let cancelled = false;
  controller.onCancel(() => {
    cancelled = true;
  });

  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt === 2 && core.state.buildNumber === 1) {
      // Try to clean if the first build failed.
      await cleanRunTask(controller);
      if (cancelled) {
        core.state.buildStatus.build = 'Error';
        return;
      }
    }
    const process = run({
      command: getConfig().commands.build,
      controller,
    });
    const { exitCode } = await process.result;
    if (cancelled) {
      core.state.buildStatus.build = 'Error';
      return;
    }
    if (exitCode === 0) {
      core.state.buildStatus.build = 'Success';
      return;
    }
  }

  core.state.buildStatus.build = 'Error';
};
