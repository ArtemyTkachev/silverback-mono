export class TaskController {
  cancelCallbacks: Array<() => void> = [];
  cancel = (): void => {
    this.cancelCallbacks.forEach((callback) => callback());
  };
  onCancel = (callback: () => void): void => {
    this.cancelCallbacks.push(callback);
  };
}

type TaskPromise = Promise<unknown>;

export type Task = (controller: TaskController) => TaskPromise;

export class Queue {
  whenIdle = Promise.resolve();

  #resolveWhenIdle = (): void => {};
  #newWhenIdlePromise = (): Promise<void> => {
    return new Promise<void>((resolve) => {
      this.#resolveWhenIdle = resolve;
    });
  };

  #started = false;
  #tasks: Array<Task> = [];
  #currentTask: {
    promise: TaskPromise;
    controller: TaskController;
  } | null = null;

  add = (task: Task): void => {
    if (!this.#tasks.length && !this.#currentTask) {
      this.whenIdle = this.#newWhenIdlePromise();
    }
    this.#tasks.push(task);
    if (this.#started) {
      setImmediate(this.run);
    }
  };

  run = (): void => {
    this.#started = true;
    if (this.#currentTask) {
      return;
    }
    (async (): Promise<void> => {
      while (this.#tasks.length) {
        const task = this.#tasks.shift()!;
        const controller = new TaskController();
        const promise = task(controller);
        this.#currentTask = {
          promise,
          controller,
        };
        await promise;
        this.#currentTask = null;
      }
      this.#resolveWhenIdle();
    })();
  };

  clear = async (): Promise<void> => {
    this.#tasks = [];
    if (this.#currentTask) {
      this.#currentTask.controller.cancel();
      await this.#currentTask.promise;
    }
  };

  hasPendingTasks = (): boolean => this.#tasks.length > 0;

  hasActiveTasks = (): boolean => !!this.#currentTask;
}
