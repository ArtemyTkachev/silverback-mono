import { afterEach, expect, test } from 'vitest';

import { core } from '../../core';
import { setConfig } from '../../tools/config';
import { TaskController } from '../../tools/queue';
import { serveStartTask } from './serveStart';
import { serveStopTask } from './serveStop';

const commands = {
  clean: '',
  build: '',
  deploy: '',
};

afterEach(async () => {
  await serveStopTask(new TaskController());
});

test('serve works', async () => {
  setConfig({
    commands: {
      ...commands,
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  await serveStartTask(new TaskController());
});

test('serve can timeout', async () => {
  const output: Array<string> = [];
  core.output.listen((chunk) => {
    output.push(chunk);
  });
  setConfig({
    commands: {
      ...commands,
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'BAD PATTERN',
        readyTimeout: 10,
      },
    },
  });
  await serveStartTask(new TaskController());
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "serve"; while true; do sleep 86400; done"\n',
    'serve\n',
    '⚠️ Could not find the serve ready pattern in 10ms\n',
  ]);
  expect(core.serveProcess).not.toBe(null);
});

test('serve can be restarted', async () => {
  const output: Array<string> = [];
  core.output.listen((chunk) => {
    output.push(chunk);
  });
  setConfig({
    commands: {
      ...commands,
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  await serveStartTask(new TaskController());
  await serveStopTask(new TaskController());
  await serveStartTask(new TaskController());
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "serve"; while true; do sleep 86400; done"\n',
    'serve\n',
    'ℹ️ Killing command: "echo "serve"; while true; do sleep 86400; done"\n',
    '❌ Command exited with 130: "echo "serve"; while true; do sleep 86400; done"\n',
    'ℹ️ Starting command: "echo "serve"; while true; do sleep 86400; done"\n',
    'serve\n',
  ]);
});

test('start serve can be called multiple times', async () => {
  const output: Array<string> = [];
  core.output.listen((chunk) => {
    output.push(chunk);
  });
  setConfig({
    commands: {
      ...commands,
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 1000,
      },
    },
  });
  await serveStartTask(new TaskController());
  await serveStartTask(new TaskController());
  await serveStartTask(new TaskController());
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "serve"; while true; do sleep 86400; done"\n',
    'serve\n',
  ]);
});

test('serve task can be cancelled while serving', async () => {
  setConfig({
    commands: {
      ...commands,
      serve: {
        command: 'echo "serve"; while true; do sleep 86400; done',
        readyPattern: 'serve',
        readyTimeout: 100,
      },
    },
  });
  const controller = new TaskController();
  await serveStartTask(controller);
  controller.cancel();
  expect(core.serveProcess).not.toBeNull();
  const { exitCode } = await core.serveProcess!.result;
  expect(exitCode).toBe(130);
  expect(core.serveProcess).toBeNull();
});

test('serve task can be cancelled while starting', async () => {
  const output: Array<string> = [];
  core.output.listen((chunk) => {
    output.push(chunk);
  });
  setConfig({
    commands: {
      ...commands,
      serve: {
        command:
          'echo "starting"; sleep .5; echo "started"; while true; do sleep 86400; done',
        readyPattern: 'started',
        readyTimeout: 4000,
      },
    },
  });
  const controller = new TaskController();
  serveStartTask(controller);
  expect(core.serveProcess).not.toBeNull();
  controller.cancel();
  await core.serveProcess!.result;
  expect(core.serveProcess).toBeNull();
  expect(output).toStrictEqual([
    'ℹ️ Starting command: "echo "starting"; sleep .5; echo "started"; while true; do sleep 86400; done"\n',
    'ℹ️ Killing command: "echo "starting"; sleep .5; echo "started"; while true; do sleep 86400; done"\n',
    'starting\n',
    '❌ Command exited with 130: "echo "starting"; sleep .5; echo "started"; while true; do sleep 86400; done"\n',
  ]);
});
