import { Config } from '../../types';

let _config: Config | null = null;

export const getConfig = (): Config => {
  if (!_config) {
    throw new Error('Config is not set');
  }
  return _config;
};

export const setConfig = (config: Config): void => {
  _config = config;
};
