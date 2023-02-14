import { core } from '../../core';
import { getConfig } from '../../tools/config';
import { Task } from '../../tools/queue';
import { run } from '../../tools/runner';

export const buildDeployTask: Task = async (controller) => {
  core.state.buildStatus.deploy = 'InProgress';

  let cancelled = false;
  controller.onCancel(() => {
    cancelled = true;
  });

  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const process = run({ command: getConfig().commands.deploy, controller });
    const { exitCode } = await process.result;
    if (cancelled) {
      core.state.buildStatus.deploy = 'Error';
      return;
    }
    if (exitCode === 0) {
      core.state.buildStatus.deploy = 'Success';
      return;
    }
  }

  core.state.buildStatus.deploy = 'Error';
};
