import { describe, expect, it } from "vitest";
import { parseAtom, stripHtml } from "./feed.js";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Information</title>
  <link rel="hub" href="https://theinformation.superfeedr.com/"/>
  <entry>
    <id>tag:www.theinformation.com,2005:Article/12345</id>
    <published>2026-08-21T17:55:36Z</published>
    <updated>2026-08-21T18:10:00Z</updated>
    <title>Exclusive: OpenAI Integrates ChatGPT into Apple Messages on Mac</title>
    <author><name>Jane Reporter</name></author>
    <link rel="alternate" href="https://www.theinformation.com/briefings/openai-integrates-chatgpt"/>
    <content type="html">&lt;p&gt;OpenAI said it would &amp;amp; integrate ChatGPT &lt;b&gt;deeply&lt;/b&gt; into Messages.&lt;/p&gt;</content>
  </entry>
  <entry>
    <id>tag:www.theinformation.com,2005:Article/12346</id>
    <published>2026-08-21T14:12:21Z</published>
    <title>Nvidia to Reportedly Pay $6 Billion for Chip Startup</title>
    <link rel="alternate" href="https://www.theinformation.com/articles/nvidia-pay-6-billion"/>
    <content type="html"><![CDATA[<p>Nvidia is close to a deal, Bloomberg reported.</p>]]></content>
  </entry>
  <entry>
    <id>tag:www.theinformation.com,2005:Article/12347</id>
    <title>Missing published — must be skipped</title>
  </entry>
</feed>`;

describe("parseAtom", () => {
  const items = parseAtom(FIXTURE, "2026-08-22T00:00:00.000Z");

  it("parses entries and skips malformed ones", () => {
    expect(items).toHaveLength(2);
  });

  it("extracts fields, decodes entities, strips html", () => {
    const first = items[0];
    expect(first.id).toBe("tag:www.theinformation.com,2005:Article/12345");
    expect(first.publishedUtc).toBe("2026-08-21T17:55:36.000Z");
    expect(first.updatedUtc).toBe("2026-08-21T18:10:00.000Z");
    expect(first.author).toBe("Jane Reporter");
    expect(first.teaser).toContain("OpenAI said it would & integrate ChatGPT deeply");
    expect(first.teaser).not.toContain("<");
  });

  it("classifies kind by url path and prefix from title", () => {
    expect(items[0].kind).toBe("briefing");
    expect(items[0].prefix).toBe("exclusive");
    expect(items[1].kind).toBe("article");
    expect(items[1].prefix).toBe("reportedly"); // aggregation → t0 needs verification
  });

  it("handles CDATA content", () => {
    expect(items[1].teaser).toBe("Nvidia is close to a deal, Bloomberg reported.");
  });
});

describe("stripHtml", () => {
  it("converts breaks/paragraphs to newlines and decodes entities", () => {
    expect(stripHtml("a&lt;b<br/>c</p>d &amp; e")).toBe("a<b\nc\nd & e");
  });
});
