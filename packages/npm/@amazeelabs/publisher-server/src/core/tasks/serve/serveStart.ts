import { core } from '../../core';
import { getConfig } from '../../tools/config';
import { Task } from '../../tools/queue';
import { run } from '../../tools/runner';

export const serveStartTask: Task = async (controller) => {
  if (core.serveProcess) {
    return;
  }

  const promise = new Promise<void>((resolve) => {
    const _serveProcess = run({
      command: getConfig().commands.serve.command,
      controller,
    });
    core.serveProcess = _serveProcess;
    _serveProcess.result
      .then(() => {
        core.serveProcess = null;
        return;
      })
      .catch(() => {
        core.serveProcess = null;
      });
    _serveProcess.output.listen((chunk) => {
      if (chunk.includes(getConfig().commands.serve.readyPattern)) {
        resolve();
      }
    });
  });

  const timeout = getConfig().commands.serve.readyTimeout;
  const result = await Promise.any([
    promise.then(() => 'resolved'),
    new Promise((resolve) => setTimeout(resolve, timeout)).then(
      () => 'timeout',
    ),
  ]);
  if (result === 'timeout') {
    core.output.write(
      `⚠️ Could not find the serve ready pattern in ${timeout}ms\n`,
    );
  }
};
