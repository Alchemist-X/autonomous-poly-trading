import { roughLoopPrioritySchema, roughLoopTaskSchema, roughLoopTaskStatusSchema, type RoughLoopTask } from "@autopoly/contracts";

export type RoughLoopLocale = "zh" | "en";
type RoughLoopSection = "rules" | "queue" | "running" | "blocked" | "done";
type RoughLoopField =
  | "title"
  | "status"
  | "priority"
  | "dependsOn"
  | "allowedPaths"
  | "definitionOfDone"
  | "verification"
  | "context"
  | "latestResult"
  | "attempts";

export interface RoughLoopDocument {
  locale: RoughLoopLocale;
  rules: string[];
  queue: RoughLoopTask[];
  running: RoughLoopTask[];
  blocked: RoughLoopTask[];
  done: RoughLoopTask[];
}

interface DraftTask {
  id: string;
  headingTitle: string;
  section: Exclude<RoughLoopSection, "rules">;
  fields: Map<RoughLoopField, string[]>;
  createdOrder: number;
}

const sectionHeadingMap: Record<string, RoughLoopSection> = {
  "rules": "rules",
  "rules（规则）": "rules",
  "规则": "rules",
  "queue": "queue",
  "queue（待执行）": "queue",
  "待执行": "queue",
  "running": "running",
  "running（进行中）": "running",
  "进行中": "running",
  "blocked": "blocked",
  "blocked（阻塞）": "blocked",
  "阻塞": "blocked",
  "done": "done",
  "done（已完成）": "done",
  "已完成": "done"
};

const fieldHeadingMap: Record<string, RoughLoopField> = {
  "title": "title",
  "title（标题）": "title",
  "标题": "title",
  "status": "status",
  "status（状态）": "status",
  "状态": "status",
  "priority": "priority",
  "priority（优先级）": "priority",
  "优先级": "priority",
  "depends on": "dependsOn",
  "depends on（依赖任务）": "dependsOn",
  "依赖任务": "dependsOn",
  "allowed paths": "allowedPaths",
  "allowed paths（允许改动路径）": "allowedPaths",
  "允许改动路径": "allowedPaths",
  "definition of done": "definitionOfDone",
  "definition of done（完成定义）": "definitionOfDone",
  "完成定义": "definitionOfDone",
  "verification": "verification",
  "verification（验证命令）": "verification",
  "验证命令": "verification",
  "context": "context",
  "context（上下文）": "context",
  "上下文": "context",
  "latest result": "latestResult",
  "latest result（最近结果）": "latestResult",
  "最近结果": "latestResult",
  "attempts": "attempts",
  "attempts（尝试次数）": "attempts",
  "尝试次数": "attempts"
};

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase();
}

function stripCodeTicks(value: string): string {
  return value.replace(/^`|`$/g, "").trim();
}

function parseList(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^- /, "").trim())
    .filter((line) => line.toLowerCase() !== "none" && line !== "无");
}

function parseScalar(lines: string[], fallback = ""): string {
  const joined = lines.map((line) => line.trim()).filter(Boolean).join(" ").trim();
  return stripCodeTicks(joined || fallback);
}

function fieldLabel(field: RoughLoopField, locale: RoughLoopLocale): string {
  if (locale === "zh") {
    switch (field) {
      case "title":
        return "Title（标题）";
      case "status":
        return "Status（状态）";
      case "priority":
        return "Priority（优先级）";
      case "dependsOn":
        return "Depends On（依赖任务）";
      case "allowedPaths":
        return "Allowed Paths（允许改动路径）";
      case "definitionOfDone":
        return "Definition of Done（完成定义）";
      case "verification":
        return "Verification（验证命令）";
      case "context":
        return "Context（上下文）";
      case "latestResult":
        return "Latest Result（最近结果）";
      case "attempts":
        return "Attempts（尝试次数）";
    }
  }

  switch (field) {
    case "title":
      return "Title";
    case "status":
      return "Status";
    case "priority":
      return "Priority";
    case "dependsOn":
      return "Depends On";
    case "allowedPaths":
      return "Allowed Paths";
    case "definitionOfDone":
      return "Definition of Done";
    case "verification":
      return "Verification";
    case "context":
      return "Context";
    case "latestResult":
      return "Latest Result";
    case "attempts":
      return "Attempts";
  }
}

function sectionLabel(section: RoughLoopSection, locale: RoughLoopLocale): string {
  if (locale === "zh") {
    switch (section) {
      case "rules":
        return "Rules（规则）";
      case "queue":
        return "Queue（待执行）";
      case "running":
        return "Running（进行中）";
      case "blocked":
        return "Blocked（阻塞）";
      case "done":
        return "Done（已完成）";
    }
  }

  switch (section) {
    case "rules":
      return "Rules";
    case "queue":
      return "Queue";
    case "running":
      return "Running";
    case "blocked":
      return "Blocked";
    case "done":
      return "Done";
  }
}

function emptySectionText(section: Exclude<RoughLoopSection, "rules">, locale: RoughLoopLocale): string {
  if (locale === "zh") {
    return section === "queue" ? "请在这里追加新的任务卡片。" : "暂无任务。";
  }
  return section === "queue" ? "Add new task cards here." : "No tasks.";
}

function linkLine(locale: RoughLoopLocale): string {
  return locale === "zh"
    ? "英文版见 [rough-loop.en.md](rough-loop.en.md)。"
    : "Chinese version: [rough-loop.md](rough-loop.md).";
}

function finalizeTask(draft: DraftTask): RoughLoopTask {
  const title = parseScalar(draft.fields.get("title") ?? [], draft.headingTitle);
  const statusValue = parseScalar(draft.fields.get("status") ?? [], draft.section === "done" ? "done" : draft.section);
  const priorityValue = parseScalar(draft.fields.get("priority") ?? [], "P2");
  const attemptsValue = Number.parseInt(parseScalar(draft.fields.get("attempts") ?? [], "0"), 10);
  const section = draft.section;
  const status = roughLoopTaskStatusSchema.options.includes(statusValue as (typeof roughLoopTaskStatusSchema.options)[number])
    ? statusValue
    : section === "queue"
      ? "todo"
      : section;
  const priority = roughLoopPrioritySchema.options.includes(priorityValue as (typeof roughLoopPrioritySchema.options)[number])
    ? priorityValue
    : "P2";

  return roughLoopTaskSchema.parse({
    id: draft.id,
    title,
    status,
    priority,
    dependsOn: parseList(draft.fields.get("dependsOn") ?? []),
    allowedPaths: parseList(draft.fields.get("allowedPaths") ?? []),
    definitionOfDone: parseList(draft.fields.get("definitionOfDone") ?? []),
    verification: parseList(draft.fields.get("verification") ?? []),
    context: parseList(draft.fields.get("context") ?? []),
    latestResult: parseList(draft.fields.get("latestResult") ?? []),
    attempts: Number.isFinite(attemptsValue) && attemptsValue >= 0 ? attemptsValue : 0,
    section,
    createdOrder: draft.createdOrder
  });
}

function parseTaskHeading(line: string): { id: string; title: string } {
  const value = line.replace(/^###\s+/, "").trim();
  const [rawId, ...rest] = value.split("|");
  const id = (rawId ?? "").trim();
  const title = rest.join("|").trim();
  return {
    id,
    title
  };
}

export function parseRoughLoopMarkdown(content: string, locale: RoughLoopLocale): RoughLoopDocument {
  const document: RoughLoopDocument = {
    locale,
    rules: [],
    queue: [],
    running: [],
    blocked: [],
    done: []
  };
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let currentSection: RoughLoopSection | null = null;
  let currentField: RoughLoopField | null = null;
  let currentTask: DraftTask | null = null;
  let createdOrder = 0;

  const flushTask = () => {
    if (!currentTask) {
      return;
    }
    const task = finalizeTask(currentTask);
    document[task.section].push(task);
    currentTask = null;
    currentField = null;
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushTask();
      const heading = normalizeHeading(line.replace(/^##\s+/, ""));
      currentSection = sectionHeadingMap[heading] ?? null;
      currentField = null;
      continue;
    }

    if (line.startsWith("### ")) {
      flushTask();
      if (!currentSection || currentSection === "rules") {
        continue;
      }
      const { id, title } = parseTaskHeading(line);
      currentTask = {
        id,
        headingTitle: title,
        section: currentSection,
        fields: new Map<RoughLoopField, string[]>(),
        createdOrder: createdOrder++
      };
      currentField = null;
      continue;
    }

    if (line.startsWith("#### ")) {
      if (!currentTask) {
        continue;
      }
      const heading = normalizeHeading(line.replace(/^####\s+/, ""));
      currentField = fieldHeadingMap[heading] ?? null;
      if (currentField && !currentTask.fields.has(currentField)) {
        currentTask.fields.set(currentField, []);
      }
      continue;
    }

    if (currentTask && currentField) {
      currentTask.fields.get(currentField)?.push(line);
      continue;
    }

    if (currentSection === "rules") {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("英文版见") || trimmed.startsWith("Chinese version")) {
        continue;
      }
      document.rules.push(trimmed.replace(/^- /, "").trim());
    }
  }

  flushTask();
  return document;
}

function formatScalar(value: string): string[] {
  return value ? [value] : [];
}

function formatList(items: string[], emptyText = ""): string[] {
  if (items.length === 0) {
    return emptyText ? [emptyText] : [];
  }

  return items.map((item) => `- ${item}`);
}

function serializeTask(task: RoughLoopTask, locale: RoughLoopLocale): string {
  const lines: string[] = [
    `### ${task.id} | ${task.title}`,
    "",
    `#### ${fieldLabel("title", locale)}`,
    ...formatScalar(task.title),
    "",
    `#### ${fieldLabel("status", locale)}`,
    ...formatScalar(task.status),
    "",
    `#### ${fieldLabel("priority", locale)}`,
    ...formatScalar(task.priority),
    "",
    `#### ${fieldLabel("dependsOn", locale)}`,
    ...formatList(task.dependsOn, "none"),
    "",
    `#### ${fieldLabel("allowedPaths", locale)}`,
    ...formatList(task.allowedPaths),
    "",
    `#### ${fieldLabel("definitionOfDone", locale)}`,
    ...formatList(task.definitionOfDone),
    "",
    `#### ${fieldLabel("verification", locale)}`,
    ...formatList(task.verification),
    "",
    `#### ${fieldLabel("context", locale)}`,
    ...formatList(task.context),
    "",
    `#### ${fieldLabel("latestResult", locale)}`,
    ...formatList(task.latestResult),
    "",
    `#### ${fieldLabel("attempts", locale)}`,
    ...formatScalar(String(task.attempts)),
    ""
  ];

  return lines.join("\n");
}

export function serializeRoughLoopDocument(document: RoughLoopDocument, locale: RoughLoopLocale): string {
  const sections: Array<Exclude<RoughLoopSection, "rules">> = ["queue", "running", "blocked", "done"];
  const lines: string[] = [
    "# Rough Loop",
    linkLine(locale),
    "",
    `## ${sectionLabel("rules", locale)}`
  ];

  if (document.rules.length === 0) {
    lines.push(locale === "zh" ? "- 保持任务卡片结构稳定，不要手动改乱字段标题。" : "- Keep task-card headings stable and avoid free-form structural edits.");
  } else {
    lines.push(...document.rules.map((rule) => `- ${rule}`));
  }

  lines.push("");

  for (const section of sections) {
    lines.push(`## ${sectionLabel(section, locale)}`);
    const tasks = document[section];

    if (tasks.length === 0) {
      lines.push(emptySectionText(section, locale), "");
      continue;
    }

    const orderedTasks = [...tasks].sort((left, right) => left.createdOrder - right.createdOrder);
    for (const task of orderedTasks) {
      lines.push(serializeTask(task, locale));
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function createInitialRoughLoopDocument(locale: RoughLoopLocale): RoughLoopDocument {
  return {
    locale,
    rules: locale === "zh"
      ? [
        "所有任务都必须写明完成定义、验证命令和允许改动路径。",
        "默认只处理代码任务，不处理真实交易、生产部署和私钥操作。",
        "每次文档更新都要同步维护英文副本。"
      ]
      : [
        "Every task must define its done criteria, verification commands, and allowed edit paths.",
        "The loop only handles code tasks by default, not live trading, production deploys, or secret operations.",
        "Every documentation update must keep the English mirror in sync."
      ],
    queue: [],
    running: [],
    blocked: [],
    done: []
  };
}
