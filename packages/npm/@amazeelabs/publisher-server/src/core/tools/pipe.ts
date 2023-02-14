type Severity = 'info' | 'warning' | 'error' | 'success';

export class Pipe {
  listeners: Array<(chunk: string) => void> = [];
  write = (chunk: string, severity?: Severity): void => {
    const string = `${prefix(severity)}${chunk}`;
    this.listeners.forEach((listener) => listener(string));
  };
  listen = (callback: (chunk: string) => void): void => {
    this.listeners.push(callback);
  };
}

const prefix = (severity: Severity | undefined): string => {
  switch (severity) {
    case 'info':
      return 'ℹ️ ';
    case 'warning':
      return '⚠️ ';
    case 'error':
      return '❌ ';
    case 'success':
      return '✅ ';
    case undefined:
      return '';
  }
};
