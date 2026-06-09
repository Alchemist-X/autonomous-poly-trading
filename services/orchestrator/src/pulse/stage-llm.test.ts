import { describe, expect, it } from "vitest";
import { extractJsonValue } from "./stage-llm.js";

describe("stage LLM JSON extraction", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonValue('{"aiProb":0.22}')).toEqual({ aiProb: 0.22 });
  });

  it("parses a fenced ```json block", () => {
    const out = "Here is the model:\n```json\n{ \"nodes\": [1,2,3] }\n```\nDone.";
    expect(extractJsonValue(out)).toEqual({ nodes: [1, 2, 3] });
  });

  it("extracts the first balanced object embedded in prose", () => {
    const out = 'Thinking... the answer is {"value": 0.5, "note": "has } brace in string"} trailing text';
    expect(extractJsonValue(out)).toEqual({ value: 0.5, note: "has } brace in string" });
  });

  it("parses a top-level array", () => {
    expect(extractJsonValue("result: [ {\"id\":\"a\"}, {\"id\":\"b\"} ]")).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("throws on empty or JSON-free output", () => {
    expect(() => extractJsonValue("")).toThrow();
    expect(() => extractJsonValue("no json here at all")).toThrow();
  });
});
