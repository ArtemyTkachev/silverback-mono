import { core } from '../core';
import { serveStopTask } from '../tasks/serve/serveStop';
import { Pipe } from './pipe';
import { Queue, TaskController } from './queue';

export const resetState = async (): Promise<void> => {
  await serveStopTask(new TaskController());
  await core.queue.clear();
  core.queue = new Queue();
  core.output = new Pipe();
  core.state = {
    buildNumber: 0,
    buildStatus: {
      build: 'Idle',
      deploy: 'Idle',
    },
    cleanStatus: 'Idle',
  };
};
