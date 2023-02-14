import { core } from '../../core';
import { getConfig } from '../../tools/config';
import { Task } from '../../tools/queue';

export const buildSaveTask: Task = async () => {
  if (!getConfig().persistentBuilds) {
    return;
  }
  core.output.write('Saving the build\n', 'info');
  // AXXX build save
};
