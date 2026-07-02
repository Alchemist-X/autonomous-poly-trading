// Tiny levelled stdout logger (INFO/WARN/ERR per repo terminal conventions).

function line(level: string, msg: string): string {
  return `[${new Date().toISOString()}] ${level} ${msg}\n`;
}

export const log = {
  info: (msg: string): void => {
    process.stdout.write(line("INFO", msg));
  },
  warn: (msg: string): void => {
    process.stderr.write(line("WARN", msg));
  },
  error: (msg: string): void => {
    process.stderr.write(line("ERR ", msg));
  }
};
