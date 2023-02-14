import { expect, test } from 'vitest';

import { Queue, Task } from './queue';

test('Queue works', async () => {
  // I could not make it work with fake timers :(

  const log: string[] = [];

  const queue = new Queue();

  const task: (number: number) => Task = (number) => async (controller) => {
    log.push(`task ${number} start`);
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        log.push(`task ${number} resolve`);
        resolve(null);
      }, 200);
      controller.onCancel(() => {
        log.push(`task ${number} cancel`);
        clearTimeout(timeout);
        resolve(null);
      });
    });
  };

  queue.add(task(1));
  queue.add(task(2));
  queue.add(task(3));

  expect(queue.hasPendingTasks()).toBe(true);

  queue.run();

  setTimeout(() => {
    log.push('clear');
    queue.clear();
  }, 300);

  await queue.whenIdle;

  expect(queue.hasPendingTasks()).toBe(false);
  expect(log).toStrictEqual([
    'task 1 start',
    'task 1 resolve',
    'task 2 start',
    'clear',
    'task 2 cancel',
  ]);
});
