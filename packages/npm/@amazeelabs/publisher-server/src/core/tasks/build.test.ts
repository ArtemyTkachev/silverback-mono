import { beforeEach, expect, test } from 'vitest';

import { core } from '../core';
import { setConfig } from '../tools/config';
import { TaskController } from '../tools/queue';
import { resetState } from '../tools/testing';
import { buildTask } from './build';

let output: Array<string> = [];

beforeEach(async () => {
  await resetState();

  core.output.listen((chunk) => {
    output.push(chunk);
  });
  output = [];

  setConfig({
    commands: {
      clean: 'echo "clean"',
      build: 'echo "build"',
      deploy: 'echo "deploy"',
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
    persistentBuilds: {
      buildPaths: ['build', '.cache'],
      saveTo: '/tmp/build',
    },
  });
});

test('only the first build loads the saved build', async () => {
  const controller = new TaskController();

  await buildTask()(controller);
  expect(output).toContain('ℹ️ Loading the build\n');
  expect(output).toContain('ℹ️ Saving the build\n');

  output = [];

  await buildTask()(controller);
  expect(output).not.toContain('ℹ️ Loading the build\n');
  expect(output).toContain('ℹ️ Saving the build\n');
});
