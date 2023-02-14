import { beforeEach, expect, test } from 'vitest';

import { core } from '../../core';
import { setConfig } from '../../tools/config';
import { TaskController } from '../../tools/queue';
import { resetState } from '../../tools/testing';
import { buildDeployTask } from './buildDeploy';

let output: Array<string> = [];

beforeEach(async () => {
  await resetState();

  core.output.listen((chunk) => {
    output.push(chunk);
  });
  output = [];
});

test('3 deploy attempts', async () => {
  setConfig({
    commands: {
      clean: 'echo "clean"',
      build: 'echo "build"',
      deploy: 'echo "deploy fail"; exit 1',
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  await buildDeployTask(new TaskController());
  expect(core.state.buildStatus.deploy).toBe('Error');
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "deploy fail"; exit 1"\n',
    'deploy fail\n',
    '❌ Command exited with 1: "echo "deploy fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "deploy fail"; exit 1"\n',
    'deploy fail\n',
    '❌ Command exited with 1: "echo "deploy fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "deploy fail"; exit 1"\n',
    'deploy fail\n',
    '❌ Command exited with 1: "echo "deploy fail"; exit 1"\n',
  ]);
});

test('deploy continues after few failing attempts', async () => {
  let attempt = 0;
  setConfig({
    commands: {
      clean: 'echo "clean"',
      build: 'echo "build"',
      get deploy(): string {
        attempt++;
        return attempt === 3
          ? 'echo "deploy success"'
          : 'echo "deploy fail"; exit 1';
      },
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  await buildDeployTask(new TaskController());
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "deploy fail"; exit 1"\n',
    'deploy fail\n',
    '❌ Command exited with 1: "echo "deploy fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "deploy fail"; exit 1"\n',
    'deploy fail\n',
    '❌ Command exited with 1: "echo "deploy fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "deploy success""\n',
    'deploy success\n',
    '✅ Command exited: "echo "deploy success""\n',
  ]);
  expect(core.state.buildStatus.deploy).toBe('Success');
});

test('a cancelled deploy results in the error state', async () => {
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
  });
  const controller = new TaskController();
  const resolved = buildDeployTask(controller);
  controller.cancel();
  await resolved;
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "deploy""\n',
    'ℹ️ Killing command: "echo "deploy""\n',
    'deploy\n',
    '✅ Command exited: "echo "deploy""\n',
  ]);
  expect(core.state.buildStatus.deploy).toBe('Error');
});
