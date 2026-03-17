import type { RoughLoopTask } from "@autopoly/contracts";
import type { GitStatus } from "./git.js";

function formatList(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return `- ${emptyText}`;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildTaskPrompt(input: {
  task: RoughLoopTask;
  repoStatus: GitStatus;
  verificationCommands: string[];
  relaxGuardrails: boolean;
}): string {
  const allowedPaths = input.task.allowedPaths.length === 0 && input.relaxGuardrails
    ? ["<entire-repository>"]
    : input.task.allowedPaths;
  const guardrailLines = input.relaxGuardrails
    ? [
      "- 当前处于显式放宽护栏模式，可以在整个仓库内修改代码并接受脏工作树。",
      "- 仍然不要执行危险 git 操作，例如 reset --hard、checkout --、clean -fd、force push。",
      "- 完成后请在输出末尾写一行 ROUGH_LOOP_SUMMARY: <一句话总结>。",
      "- 如果任务需要人工判断，可以输出 ROUGH_LOOP_BLOCKED: <原因>。"
    ]
    : [
      "- 只修改 Allowed Paths 列出的路径，以及系统维护的 rough-loop.md / rough-loop.en.md。",
      "- 不要读取或改动任何 secrets、.env.aizen、私钥、生产 host 配置。",
      "- 不要执行危险 git 操作，例如 reset --hard、checkout --、clean -fd、force push。",
      "- 完成后请在输出末尾写一行 ROUGH_LOOP_SUMMARY: <一句话总结>。",
      "- 如果任务需要人工判断、缺少必要信息、或会触碰高风险资源，请不要继续修改，并输出 ROUGH_LOOP_BLOCKED: <原因>。"
    ];

  return [
    "你是这个仓库的 Rough Loop 执行器，负责持续完成一个明确的代码任务。",
    "",
    "必须遵守以下规则：",
    "- 代码注释必须是英文。",
    "- 面向阅读的 Markdown 必须保证中文主文件和英文副本同步维护。",
    ...guardrailLines,
    "",
    "当前任务卡片：",
    `- ID: ${input.task.id}`,
    `- Title: ${input.task.title}`,
    `- Priority: ${input.task.priority}`,
    `- Status: ${input.task.status}`,
    `- Attempts: ${input.task.attempts}`,
    "",
    "Allowed Paths:",
    formatList(allowedPaths, input.relaxGuardrails ? "<entire-repository>" : "none"),
    "",
    "Definition of Done:",
    formatList(input.task.definitionOfDone, "missing"),
    "",
    "Verification Commands:",
    formatList(input.verificationCommands, "missing"),
    "",
    "Context:",
    formatList(input.task.context, "none"),
    "",
    "Current repo status before this attempt:",
    input.repoStatus.clean
      ? "- Working tree is clean."
      : formatList(input.repoStatus.changedFiles, "working tree is clean"),
    "",
    "直接在仓库内完成任务，不要输出长篇解释。只在最后输出必要摘要行。"
  ].join("\n");
}
