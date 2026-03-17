import util from "node:util";

type TerminalStream = NodeJS.WritableStream & {
  isTTY?: boolean;
};

export interface TerminalCapabilities {
  isTTY: boolean;
  colorEnabled: boolean;
  dynamicEnabled: boolean;
}

export type Tone = "accent" | "info" | "success" | "warn" | "error" | "muted" | "plain";

export interface ProgressLineInput {
  percent: number;
  label: string;
  detail?: string;
  elapsedMs?: number;
  timeoutMs?: number;
  tone?: Tone;
}

export interface TerminalPrinter {
  readonly capabilities: TerminalCapabilities;
  blank(): void;
  line(message?: string): void;
  section(title: string, detail?: string): void;
  note(tone: Tone, label: string, detail?: string): void;
  keyValue(label: string, value: string | number | boolean | null | undefined, tone?: Tone): void;
  table(rows: Array<[string, string]>, tone?: Tone): void;
  list(items: string[], tone?: Tone): void;
  progress(input: ProgressLineInput): void;
  json(value: unknown): void;
}

export interface PrettyServiceLogger {
  level: string;
  child(bindings: Record<string, unknown>): PrettyServiceLogger;
  trace(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fatal(...args: unknown[]): void;
}

export interface TerminalErrorSummaryInput {
  title: string;
  stage: string;
  error: unknown;
  context?: Array<[string, string]>;
  artifactDir?: string;
  rawSummary?: string;
  nextSteps?: string[];
}

const ANSI = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  blue: "\u001B[34m",
  magenta: "\u001B[35m",
  cyan: "\u001B[36m",
  gray: "\u001B[90m"
} as const;

const SPINNER_FRAMES = ["-", "\\", "|", "/"] as const;

function colorize(enabled: boolean, code: string, value: string): string {
  return enabled ? `${code}${value}${ANSI.reset}` : value;
}

function toToneColor(tone: Tone): string {
  switch (tone) {
    case "accent":
      return ANSI.cyan;
    case "info":
      return ANSI.blue;
    case "success":
      return ANSI.green;
    case "warn":
      return ANSI.yellow;
    case "error":
      return ANSI.red;
    case "muted":
      return ANSI.gray;
    case "plain":
    default:
      return "";
  }
}

function toBadgeLabel(tone: Tone): string {
  switch (tone) {
    case "accent":
      return "RUN";
    case "info":
      return "INFO";
    case "success":
      return "OK";
    case "warn":
      return "WARN";
    case "error":
      return "ERR";
    case "muted":
      return "...";
    case "plain":
    default:
      return "LOG";
  }
}

function formatTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stringifyValue(value: unknown): string {
  if (value == null) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return util.inspect(value, {
    depth: 2,
    colors: false,
    breakLength: 120,
    compact: true
  });
}

function compactInspect(value: unknown): string {
  const rendered = stringifyValue(value);
  return rendered.length > 180 ? `${rendered.slice(0, 177)}...` : rendered;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }
  return compactInspect(error);
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function renderBar(percent: number, tone: Tone, capabilities: TerminalCapabilities): string {
  const width = 24;
  const clamped = clampPercent(percent);
  const filled = Math.round((clamped / 100) * width);
  const color = toToneColor(tone);
  const left = "#".repeat(filled);
  const right = "-".repeat(width - filled);
  const renderedLeft = colorize(capabilities.colorEnabled, color || ANSI.cyan, left);
  const renderedRight = colorize(capabilities.colorEnabled, ANSI.gray, right);
  return `[${renderedLeft}${renderedRight}]`;
}

function renderBadge(tone: Tone, capabilities: TerminalCapabilities): string {
  const label = `[${toBadgeLabel(tone)}]`;
  const color = toToneColor(tone) || ANSI.cyan;
  return colorize(capabilities.colorEnabled, `${ANSI.bold}${color}`, label);
}

function renderMuted(capabilities: TerminalCapabilities, value: string): string {
  return colorize(capabilities.colorEnabled, ANSI.gray, value);
}

function renderStrong(capabilities: TerminalCapabilities, value: string, tone: Tone = "plain"): string {
  const color = toToneColor(tone);
  return colorize(capabilities.colorEnabled, `${ANSI.bold}${color}`, value);
}

function renderFrame(frameIndex: number, capabilities: TerminalCapabilities, tone: Tone): string {
  const frame = capabilities.dynamicEnabled
    ? SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length] ?? ">"
    : ">";
  return colorize(capabilities.colorEnabled, toToneColor(tone) || ANSI.cyan, frame);
}

function renderTiming(capabilities: TerminalCapabilities, elapsedMs?: number, timeoutMs?: number): string | null {
  if (typeof elapsedMs !== "number") {
    return null;
  }
  const elapsed = `elapsed ${formatDuration(elapsedMs)}`;
  if (typeof timeoutMs === "number") {
    return renderMuted(capabilities, `${elapsed} / timeout ${formatDuration(timeoutMs)}`);
  }
  return renderMuted(capabilities, elapsed);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatRatioPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function detectTerminalCapabilities(stream: TerminalStream = process.stdout): TerminalCapabilities {
  const isTTY = Boolean(stream.isTTY);
  const noColor = typeof process.env.NO_COLOR === "string";
  const forceColor = process.env.FORCE_COLOR != null && process.env.FORCE_COLOR !== "0";
  const ci = process.env.CI != null && process.env.CI !== "0" && process.env.CI.toLowerCase() !== "false";
  const termIsDumb = (process.env.TERM ?? "").toLowerCase() === "dumb";
  const colorEnabled = !noColor && (forceColor || isTTY);
  return {
    isTTY,
    colorEnabled,
    dynamicEnabled: colorEnabled && isTTY && !ci && !termIsDumb
  };
}

export function shouldUseHumanOutput(stream: NodeJS.WritableStream = process.stdout): boolean {
  return detectTerminalCapabilities(stream).isTTY;
}

export function shouldUsePrettyServiceLogger(stream: NodeJS.WritableStream = process.stdout): boolean {
  return process.env.NODE_ENV !== "production" && shouldUseHumanOutput(stream);
}

export function renderProgressLine(
  input: ProgressLineInput,
  capabilities: TerminalCapabilities,
  frameIndex = 0
): string {
  const percent = clampPercent(input.percent);
  const tone = input.tone ?? "accent";
  const parts = [
    renderMuted(capabilities, `[${formatTimestamp()}]`),
    renderFrame(frameIndex, capabilities, tone),
    renderBar(percent, tone, capabilities),
    renderStrong(capabilities, `${String(percent).padStart(3, " ")}%`, tone),
    renderStrong(capabilities, input.label, tone)
  ];

  if (input.detail) {
    parts.push(renderMuted(capabilities, `| ${input.detail}`));
  }

  const timing = renderTiming(capabilities, input.elapsedMs, input.timeoutMs);
  if (timing) {
    parts.push("|");
    parts.push(timing);
  }

  return parts.join(" ");
}

export function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}

export function createTerminalPrinter(input?: {
  stream?: TerminalStream;
  enabled?: boolean;
  capabilities?: TerminalCapabilities;
}): TerminalPrinter {
  const stream = input?.stream ?? process.stdout;
  const enabled = input?.enabled ?? true;
  const capabilities = input?.capabilities ?? detectTerminalCapabilities(stream);
  let frameIndex = 0;

  function write(line = "") {
    if (!enabled) {
      return;
    }
    stream.write(`${line}\n`);
  }

  return {
    capabilities,
    blank() {
      write("");
    },
    line(message = "") {
      write(message);
    },
    section(title, detail) {
      write("");
      const headline = renderStrong(capabilities, `=== ${title} ===`, "accent");
      write(detail ? `${headline} ${renderMuted(capabilities, detail)}` : headline);
    },
    note(tone, label, detail) {
      write(`${renderBadge(tone, capabilities)} ${renderStrong(capabilities, label, tone)}${detail ? ` ${renderMuted(capabilities, `| ${detail}`)}` : ""}`);
    },
    keyValue(label, value, tone = "muted") {
      const renderedLabel = renderMuted(capabilities, `${label}:`);
      const renderedValue = tone === "plain"
        ? stringifyValue(value)
        : renderStrong(capabilities, stringifyValue(value), tone);
      write(`  ${renderedLabel} ${renderedValue}`);
    },
    table(rows, tone = "plain") {
      const width = rows.reduce((max, [label]) => Math.max(max, label.length), 0);
      for (const [label, value] of rows) {
        const renderedLabel = renderMuted(capabilities, `${label.padEnd(width, " ")} :`);
        const renderedValue = tone === "plain" ? value : renderStrong(capabilities, value, tone);
        write(`  ${renderedLabel} ${renderedValue}`);
      }
    },
    list(items, tone = "plain") {
      for (const item of items) {
        const rendered = tone === "plain" ? item : renderStrong(capabilities, item, tone);
        write(`  - ${rendered}`);
      }
    },
    progress(progressInput) {
      write(renderProgressLine(progressInput, capabilities, frameIndex));
      frameIndex += 1;
    },
    json(value) {
      write(JSON.stringify(value, null, 2));
    }
  };
}

export function printErrorSummary(printer: TerminalPrinter, input: TerminalErrorSummaryInput) {
  printer.section(input.title);
  printer.note("error", input.stage, getErrorMessage(input.error));

  const rows: Array<[string, string]> = [["Stage", input.stage]];
  if (input.artifactDir) {
    rows.push(["Artifact Dir", input.artifactDir]);
  }
  if (input.rawSummary) {
    rows.push(["Raw Error", input.rawSummary]);
  }
  if (input.context && input.context.length > 0) {
    rows.push(...input.context);
  }
  printer.table(rows);

  if (input.nextSteps && input.nextSteps.length > 0) {
    printer.section("Next Steps");
    printer.list(input.nextSteps, "warn");
  }
}

function extractLogRecord(args: unknown[]): {
  message: string;
  context: Record<string, unknown>;
  error: Error | null;
} {
  const parts: string[] = [];
  const context: Record<string, unknown> = {};
  let error: Error | null = null;

  for (const arg of args) {
    if (arg instanceof Error) {
      error = arg;
      continue;
    }
    if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") {
      parts.push(String(arg));
      continue;
    }
    if (arg && typeof arg === "object") {
      Object.assign(context, arg as Record<string, unknown>);
    }
  }

  if (!parts.length && typeof context.msg === "string") {
    parts.push(context.msg);
    delete context.msg;
  }

  return {
    message: parts.join(" ").trim() || (error ? error.message : ""),
    context,
    error
  };
}

function summarizeFastifyContext(context: Record<string, unknown>): {
  summary: string[];
  extras: Record<string, unknown>;
} {
  const extras = { ...context };
  const summary: string[] = [];

  const request = extras.req as Record<string, unknown> | undefined;
  if (request && typeof request === "object") {
    const method = typeof request.method === "string" ? request.method : null;
    const url = typeof request.url === "string" ? request.url : null;
    if (method || url) {
      summary.push([method, url].filter(Boolean).join(" "));
    }
    delete extras.req;
  }

  const response = extras.res as Record<string, unknown> | undefined;
  if (response && typeof response === "object") {
    const statusCode = typeof response.statusCode === "number" ? response.statusCode : null;
    if (statusCode != null) {
      summary.push(`status ${statusCode}`);
    }
    delete extras.res;
  }

  if (typeof extras.responseTime === "number") {
    summary.push(`${extras.responseTime.toFixed(1)}ms`);
    delete extras.responseTime;
  }

  if (typeof extras.jobId === "string") {
    summary.push(`job ${extras.jobId}`);
    delete extras.jobId;
  }

  if (typeof extras.name === "string") {
    summary.push(extras.name);
    delete extras.name;
  }

  if (extras.err instanceof Error) {
    delete extras.err;
  }

  if (extras.error instanceof Error) {
    delete extras.error;
  }

  return { summary, extras };
}

function logTone(level: string): Tone {
  switch (level) {
    case "trace":
    case "debug":
      return "muted";
    case "info":
      return "info";
    case "warn":
      return "warn";
    case "error":
    case "fatal":
      return "error";
    default:
      return "plain";
  }
}

export function createPrettyServiceLogger(input: {
  serviceName: string;
  stream?: NodeJS.WritableStream;
  capabilities?: TerminalCapabilities;
  bindings?: Record<string, unknown>;
}): PrettyServiceLogger {
  const printer = createTerminalPrinter({
    stream: input.stream ?? process.stdout,
    capabilities: input.capabilities
  });
  const bindings = input.bindings ?? {};

  function emit(level: string, args: unknown[]) {
    const record = extractLogRecord(args);
    const mergedContext = {
      ...bindings,
      ...record.context
    };
    const summary = summarizeFastifyContext(mergedContext);
    const error = record.error ?? (mergedContext.error instanceof Error ? mergedContext.error : null) ?? (mergedContext.err instanceof Error ? mergedContext.err : null);
    const extras = stripUndefined(summary.extras);
    const detailParts = [
      ...summary.summary
    ];

    if (Object.keys(extras).length > 0) {
      detailParts.push(compactInspect(extras));
    }
    if (error) {
      detailParts.push(error.stack ?? error.message);
    }

    printer.note(
      logTone(level),
      `${input.serviceName} ${level.toUpperCase()}${record.message ? ` ${record.message}` : ""}`,
      detailParts.join(" | ")
    );
  }

  return {
    level: "info",
    child(childBindings) {
      return createPrettyServiceLogger({
        serviceName: input.serviceName,
        stream: input.stream,
        capabilities: printer.capabilities,
        bindings: {
          ...bindings,
          ...childBindings
        }
      });
    },
    trace(...args) {
      emit("trace", args);
    },
    debug(...args) {
      emit("debug", args);
    },
    info(...args) {
      emit("info", args);
    },
    warn(...args) {
      emit("warn", args);
    },
    error(...args) {
      emit("error", args);
    },
    fatal(...args) {
      emit("fatal", args);
    }
  };
}
