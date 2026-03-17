import { describe, expect, it } from "vitest";
import { parseRoughLoopMarkdown, serializeRoughLoopDocument, type RoughLoopDocument } from "./markdown.js";

describe("rough loop markdown", () => {
  it("round-trips a Chinese task card and keeps the English mirror compatible", () => {
    const source = `# Rough Loop
英文版见 [rough-loop.en.md](rough-loop.en.md)。

## Rules（规则）
- 所有任务都必须写明完成定义、验证命令和允许改动路径。

## Queue（待执行）
### RL-001 | 完成 Rough Loop 文档

#### Title（标题）
完成 Rough Loop 文档

#### Status（状态）
todo

#### Priority（优先级）
P1

#### Depends On（依赖任务）
- none

#### Allowed Paths（允许改动路径）
- rough-loop.md
- rough-loop.en.md

#### Definition of Done（完成定义）
- 两份文档同时更新

#### Verification（验证命令）
- pnpm test

#### Context（上下文）
- 保持文档结构稳定

#### Latest Result（最近结果）
- 尚未开始

#### Attempts（尝试次数）
0

## Running（进行中）
暂无任务。

## Blocked（阻塞）
暂无任务。

## Done（已完成）
暂无任务。
`;

    const parsed = parseRoughLoopMarkdown(source, "zh");
    expect(parsed.queue).toHaveLength(1);
    expect(parsed.queue[0]?.allowedPaths).toEqual(["rough-loop.md", "rough-loop.en.md"]);

    const serializedChinese = serializeRoughLoopDocument(parsed, "zh");
    const reparsedChinese = parseRoughLoopMarkdown(serializedChinese, "zh");
    const serializedEnglish = serializeRoughLoopDocument(parsed, "en");
    const reparsedEnglish = parseRoughLoopMarkdown(serializedEnglish, "en");

    expect(reparsedChinese.queue[0]?.title).toBe("完成 Rough Loop 文档");
    expect(reparsedEnglish.queue[0]?.id).toBe("RL-001");
  });

  it("creates an empty document with the expected sections", () => {
    const document: RoughLoopDocument = {
      locale: "zh",
      rules: ["规则一"],
      queue: [],
      running: [],
      blocked: [],
      done: []
    };

    const serialized = serializeRoughLoopDocument(document, "zh");
    expect(serialized).toContain("## Queue（待执行）");
    expect(serialized).toContain("请在这里追加新的任务卡片。");
  });
});
