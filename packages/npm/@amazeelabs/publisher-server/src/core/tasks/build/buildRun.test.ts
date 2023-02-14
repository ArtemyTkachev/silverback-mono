import { beforeEach, expect, test } from 'vitest';

import { core } from '../../core';
import { setConfig } from '../../tools/config';
import { TaskController } from '../../tools/queue';
import { resetState } from '../../tools/testing';
import { buildRunTask } from './buildRun';

let output: Array<string> = [];

beforeEach(async () => {
  await resetState();

  core.output.listen((chunk) => {
    output.push(chunk);
  });
  output = [];
});

test('3 build attempts', async () => {
  core.state.buildNumber = 999;
  setConfig({
    commands: {
      clean: 'echo "clean"',
      build: 'echo "build fail"; exit 1',
      deploy: 'echo "deploy"',
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  await buildRunTask(new TaskController());
  expect(core.state.buildStatus.build).toBe('Error');
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "build fail"; exit 1"\n',
    'build fail\n',
    '❌ Command exited with 1: "echo "build fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "build fail"; exit 1"\n',
    'build fail\n',
    '❌ Command exited with 1: "echo "build fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "build fail"; exit 1"\n',
    'build fail\n',
    '❌ Command exited with 1: "echo "build fail"; exit 1"\n',
  ]);
});

test('first build failure triggers a clean', async () => {
  core.state.buildNumber = 1;
  setConfig({
    commands: {
      clean: 'echo "clean"',
      build: 'echo "build fail"; exit 1',
      deploy: 'echo "deploy"',
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  await buildRunTask(new TaskController());
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "build fail"; exit 1"\n',
    'build fail\n',
    '❌ Command exited with 1: "echo "build fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "clean""\n',
    'clean\n',
    '✅ Command exited: "echo "clean""\n',
    'ℹ️ Starting command: "echo "build fail"; exit 1"\n',
    'build fail\n',
    '❌ Command exited with 1: "echo "build fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "build fail"; exit 1"\n',
    'build fail\n',
    '❌ Command exited with 1: "echo "build fail"; exit 1"\n',
  ]);
  expect(core.state.buildStatus.build).toBe('Error');
});

test('build continues after few failing attempts', async () => {
  core.state.buildNumber = 999;
  let attempt = 0;
  setConfig({
    commands: {
      clean: 'echo "clean"',
      get build(): string {
        attempt++;
        return attempt === 3
          ? 'echo "build success"'
          : 'echo "build fail"; exit 1';
      },
      deploy: 'echo "deploy"',
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  await buildRunTask(new TaskController());
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "build fail"; exit 1"\n',
    'build fail\n',
    '❌ Command exited with 1: "echo "build fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "build fail"; exit 1"\n',
    'build fail\n',
    '❌ Command exited with 1: "echo "build fail"; exit 1"\n',
    'ℹ️ Starting command: "echo "build success""\n',
    'build success\n',
    '✅ Command exited: "echo "build success""\n',
  ]);
  expect(core.state.buildStatus.build).toBe('Success');
});

test('a cancelled build results in the error state', async () => {
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
  const resolved = buildRunTask(controller);
  controller.cancel();
  await resolved;
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "build""\n',
    'ℹ️ Killing command: "echo "build""\n',
    'build\n',
    '✅ Command exited: "echo "build""\n',
  ]);
  expect(core.state.buildStatus.build).toBe('Error');
});
