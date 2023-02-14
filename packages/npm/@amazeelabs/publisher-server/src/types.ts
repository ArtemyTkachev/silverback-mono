export type Config = {
  commands: {
    clean: string;
    build: string;
    deploy: string;
    serve: {
      command: string;
      readyPattern: string;
      readyTimeout: number;
    };
  };
  persistentBuilds?: {
    buildPaths: Array<string>;
    saveTo: string;
  };
};
