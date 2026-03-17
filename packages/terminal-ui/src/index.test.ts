import { describe, expect, it } from "vitest";
import {
  createTerminalPrinter,
  detectTerminalCapabilities,
  getErrorMessage,
  printErrorSummary,
  renderProgressLine,
  stripAnsi
} from "./index.js";

function createFakeStream(isTTY: boolean) {
  let output = "";
  return ({
    isTTY,
    write(chunk: string) {
      output += chunk;
      return true;
    },
    read() {
      return output;
    }
  } as unknown) as NodeJS.WritableStream & { isTTY: boolean; read(): string };
}

describe("terminal ui", () => {
  it("detects tty capabilities", () => {
    const previousCi = process.env.CI;
    const previousNoColor = process.env.NO_COLOR;
    const previousForceColor = process.env.FORCE_COLOR;
    try {
      delete process.env.CI;
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = "1";
      const stream = createFakeStream(true);
      const capabilities = detectTerminalCapabilities(stream);

      expect(capabilities.isTTY).toBe(true);
      expect(capabilities.colorEnabled).toBe(true);
    } finally {
      if (previousCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = previousCi;
      }
      if (previousNoColor === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previousNoColor;
      }
      if (previousForceColor === undefined) {
        delete process.env.FORCE_COLOR;
      } else {
        process.env.FORCE_COLOR = previousForceColor;
      }
    }
  });

  it("renders progress lines with timing data", () => {
    const line = renderProgressLine({
      percent: 56,
      label: "Rendering full pulse with Codex",
      detail: "full-pulse-report.md",
      elapsedMs: 20_000,
      timeoutMs: 1_500_000
    }, {
      isTTY: false,
      colorEnabled: false,
      dynamicEnabled: false
    }, 2);

    expect(line).toContain("56%");
    expect(line).toContain("Rendering full pulse with Codex");
    expect(line).toContain("elapsed 00:20 / timeout 25:00");
  });

  it("writes key values without ansi when colors are disabled", () => {
    const stream = createFakeStream(false);
    const printer = createTerminalPrinter({
      stream,
      capabilities: {
        isTTY: false,
        colorEnabled: false,
        dynamicEnabled: false
      }
    });

    printer.section("Summary");
    printer.keyValue("Status", "awaiting-approval", "accent");

    expect(stripAnsi(stream.read())).toContain("Status:");
    expect(stripAnsi(stream.read())).toContain("awaiting-approval");
  });

  it("prints structured error summaries", () => {
    const stream = createFakeStream(false);
    const printer = createTerminalPrinter({
      stream,
      capabilities: {
        isTTY: false,
        colorEnabled: false,
        dynamicEnabled: false
      }
    });

    printErrorSummary(printer, {
      title: "Live Test Failed",
      stage: "sync",
      error: new Error("sync job failed"),
      context: [["Run ID", "run-123"], ["Market", "fed-cut-rates-by-june"]],
      artifactDir: "/tmp/live-test/run-123",
      nextSteps: ["Inspect execution-summary.json", "Retry after fixing Redis"]
    });

    const output = stripAnsi(stream.read());
    expect(output).toContain("Live Test Failed");
    expect(output).toContain("sync job failed");
    expect(output).toContain("Run ID");
    expect(output).toContain("/tmp/live-test/run-123");
  });

  it("extracts safe error messages", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage("plain")).toBe("plain");
    expect(getErrorMessage({ reason: "bad state" })).toContain("bad state");
  });
});
