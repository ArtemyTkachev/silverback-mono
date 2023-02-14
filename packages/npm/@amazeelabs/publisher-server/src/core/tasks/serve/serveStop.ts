import { core } from '../../core';
import { Task } from '../../tools/queue';

export const serveStopTask: Task = async () => {
  await core.serveProcess?.kill();
};
