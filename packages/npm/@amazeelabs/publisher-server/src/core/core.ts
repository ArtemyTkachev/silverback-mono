import { buildTask } from './tasks/build';
import { buildLoadTask } from './tasks/build/buildLoad';
import { buildSaveTask } from './tasks/build/buildSave';
import { cleanRunTask } from './tasks/clean/cleanRun';
import { serveStopTask } from './tasks/serve/serveStop';
import { Pipe } from './tools/pipe';
import { Queue } from './tools/queue';
import { Process } from './tools/runner';

type ProcessStatus = 'Idle' | 'InProgress' | 'Success' | 'Error';

enum ApplicationState {
  /**
   * The application is starting and not yet available.
   */
  Starting = 'starting',
  /**
   * A fatal error during startup happened, application is not available.
   */
  Fatal = 'fatal',
  /**
   * A build error happened. Application is still available, but not up-to-date.
   */
  Error = 'error',
  /**
   * Application is updating, but still available.
   */
  Updating = 'updating',
  /**
   * Application is up-to-date.
   */
  Ready = 'ready',
}

class Core {
  state: {
    buildNumber: number;
    buildStatus: {
      build: ProcessStatus;
      deploy: ProcessStatus;
    };
    cleanStatus: ProcessStatus;
  } = {
    buildNumber: 0,
    buildStatus: {
      build: 'Idle',
      deploy: 'Idle',
    },
    cleanStatus: 'Idle',
  };

  serveProcess: Process | null = null;

  output = new Pipe();

  queue = new Queue();

  start = (options?: { skipInitialBuild?: boolean }): void => {
    this.queue.add(buildTask(options));
    this.queue.run();
  };

  build = (): void => {
    // Consider any pending task a build task.
    if (!this.queue.hasPendingTasks()) {
      this.queue.add(buildTask());
    }
  };

  clean = (): void => {
    this.queue.clear().then(() => {
      this.queue.add(serveStopTask);
      this.queue.add(cleanRunTask);
      this.queue.add(buildTask());
    });
  };

  buildSave = (): void => {
    if (core.queue.hasPendingTasks() || core.queue.hasActiveTasks()) {
      throw new Error('Cannot save a build while queue is running.');
    }
    this.queue.add(buildSaveTask);
    this.queue.run();
  };

  buildLoad = (): void => {
    if (core.queue.hasPendingTasks() || core.queue.hasActiveTasks()) {
      throw new Error('Cannot load a build while queue is running.');
    }
    this.queue.add(buildLoadTask);
    this.queue.run();
  };

  getStatus = (): ApplicationState => {
    const {
      buildStatus: { build, deploy },
      cleanStatus: clean,
      buildNumber,
    } = this.state;
    if (build === 'Error' || deploy === 'Error' || clean === 'Error') {
      return buildNumber === 1
        ? ApplicationState.Fatal
        : ApplicationState.Error;
    }
    if (
      build === 'InProgress' ||
      deploy === 'InProgress' ||
      clean === 'InProgress'
    ) {
      return buildNumber === 1
        ? ApplicationState.Starting
        : ApplicationState.Updating;
    }
    if (build === 'Success' && deploy === 'Success') {
      return ApplicationState.Ready;
    }
    return ApplicationState.Error;
  };
}

export const core = new Core();
