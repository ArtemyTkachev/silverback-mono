import { core } from '../../core';
import { getConfig } from '../../tools/config';
import { Task } from '../../tools/queue';

export const buildLoadTask: Task = async () => {
  if (!getConfig().persistentBuilds) {
    return;
  }
  core.output.write('Loading the build\n', 'info');
  // AXXX build load
};
