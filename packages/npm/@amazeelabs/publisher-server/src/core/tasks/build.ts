import { core } from '../core';
import { Queue, Task } from '../tools/queue';
import { buildDeployTask } from './build/buildDeploy';
import { buildLoadTask } from './build/buildLoad';
import { buildRunTask } from './build/buildRun';
import { buildSaveTask } from './build/buildSave';
import { serveStartTask } from './serve/serveStart';

export const buildTask: (options?: { skipInitialBuild?: boolean }) => Task =
  (options) => (controller) => {
    core.state.buildNumber++;
    return new Promise<void>((resolve) => {
      const queue = new Queue();

      controller.onCancel(async () => {
        await queue.clear();
        resolve();
      });

      if (core.state.buildNumber === 1) {
        queue.add(buildLoadTask);
      }

      if (!options?.skipInitialBuild) {
        queue.add(buildRunTask);
      }

      queue.add(serveStartTask);

      if (!options?.skipInitialBuild) {
        queue.add(buildDeployTask);
        queue.add(buildSaveTask);
      }

      queue.run();
      queue.whenIdle.then(resolve);
    });
  };
