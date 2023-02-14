import { beforeEach, expect, test } from 'vitest';

import { core } from './core';
import { setConfig } from './tools/config';
import { resetState } from './tools/testing';

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
  });
});

test('start() should run the build task', async () => {
  core.start();
  await core.queue.whenIdle;
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "build""\n',
    'build\n',
    '✅ Command exited: "echo "build""\n',
    'ℹ️ Starting command: "echo "serve"; while true; do sleep 86400; done"\n',
    'serve\n',
    'ℹ️ Starting command: "echo "deploy""\n',
    'deploy\n',
    '✅ Command exited: "echo "deploy""\n',
  ]);
});

test('skipInitialBuild option', async () => {
  core.start({ skipInitialBuild: true });
  await core.queue.whenIdle;
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "serve"; while true; do sleep 86400; done"\n',
    'serve\n',
  ]);
});

test('multiple build() calls do queue a single build', async () => {
  core.start();
  core.build();
  core.build();
  core.build();
  await core.queue.whenIdle;
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "build""\n',
    'build\n',
    '✅ Command exited: "echo "build""\n',
    'ℹ️ Starting command: "echo "serve"; while true; do sleep 86400; done"\n',
    'serve\n',
    'ℹ️ Starting command: "echo "deploy""\n',
    'deploy\n',
    '✅ Command exited: "echo "deploy""\n',
    'ℹ️ Starting command: "echo "build""\n',
    'build\n',
    '✅ Command exited: "echo "build""\n',
    'ℹ️ Starting command: "echo "deploy""\n',
    'deploy\n',
    '✅ Command exited: "echo "deploy""\n',
  ]);
});

test('clean() restarts the build', async () => {
  setConfig({
    commands: {
      clean: 'echo "clean"',
      build: 'echo "build starting"; sleep 1; echo "build done"',
      deploy: 'echo "deploy"',
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  core.start();
  await new Promise((resolve) => setTimeout(resolve, 100));
  core.clean();
  await new Promise((resolve) => setTimeout(resolve, 200));
  await core.queue.whenIdle;
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "build starting"; sleep 1; echo "build done""\n',
    'build starting\n',
    'ℹ️ Killing command: "echo "build starting"; sleep 1; echo "build done""\n',
    '❌ Command exited with 130: "echo "build starting"; sleep 1; echo "build done""\n',
    'ℹ️ Starting command: "echo "clean""\n',
    'clean\n',
    '✅ Command exited: "echo "clean""\n',
    'ℹ️ Starting command: "echo "build starting"; sleep 1; echo "build done""\n',
    'build starting\n',
    'build done\n',
    '✅ Command exited: "echo "build starting"; sleep 1; echo "build done""\n',
    'ℹ️ Starting command: "echo "serve"; while true; do sleep 86400; done"\n',
    'serve\n',
    'ℹ️ Starting command: "echo "deploy""\n',
    'deploy\n',
    '✅ Command exited: "echo "deploy""\n',
  ]);
});
