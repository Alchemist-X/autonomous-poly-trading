import {
  createTerminalPrinter,
  type Tone
} from "@autopoly/terminal-ui";

export interface ProgressUpdate {
  percent: number;
  label: string;
  detail?: string;
}

export interface ProgressHeartbeat extends ProgressUpdate {
  elapsedMs: number;
  timeoutMs?: number;
}

export interface ProgressReporter {
  info(message: string): void;
  stage(update: ProgressUpdate): void;
  heartbeat(update: ProgressHeartbeat): void;
  done(message: string): void;
  fail(message: string): void;
}

function resolveTone(percent: number): Tone {
  if (percent >= 100) {
    return "success";
  }
  if (percent >= 85) {
    return "accent";
  }
  if (percent >= 50) {
    return "info";
  }
  return "accent";
}

export function createTerminalProgressReporter(input?: {
  enabled?: boolean;
  stream?: NodeJS.WritableStream;
}): ProgressReporter {
  const printer = createTerminalPrinter({
    enabled: input?.enabled ?? true,
    stream: input?.stream ?? process.stdout
  });

  return {
    info(message) {
      printer.note("info", message);
    },
    stage(update) {
      printer.progress({
        ...update,
        tone: resolveTone(update.percent)
      });
    },
    heartbeat(update) {
      printer.progress({
        ...update,
        tone: resolveTone(update.percent)
      });
    },
    done(message) {
      printer.note("success", message);
    },
    fail(message) {
      printer.note("error", message);
    }
  };
}
