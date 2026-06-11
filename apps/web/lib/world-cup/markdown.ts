// Minimal markdown -> HTML for our own generated forecast reports only.
// The harness emits a controlled subset (headings, bold, links, tables, lists,
// blockquotes, hr), so a tiny renderer beats adding a markdown dependency.
// All text is HTML-escaped first; only constructs we emit are transformed.

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\s*\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(
      /(^|[^"(>])(https?:\/\/[^\s<)，。；]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
    );
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableDivider(line: string): boolean {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line);
}

function renderTable(rows: string[]): string {
  const cells = (row: string): string[] =>
    row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const [head = "", ...body] = rows.filter((r) => !isTableDivider(r));
  const th = cells(head).map((c) => `<th>${inline(c)}</th>`).join("");
  const trs = body
    .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function mdToHtml(md: string): string {
  const lines = escapeHtml(md.replaceAll("\r\n", "\n")).split("\n");
  const out: string[] = [];
  let i = 0;
  let listType: "ul" | "ol" | null = null;

  const closeList = (): void => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (isTableRow(line)) {
      closeList();
      const rows: string[] = [];
      while (i < lines.length && isTableRow(lines[i] ?? "")) {
        rows.push(lines[i] ?? "");
        i += 1;
      }
      out.push(renderTable(rows));
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = (heading[1] ?? "#").length;
      out.push(`<h${level}>${inline(heading[2] ?? "")}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      closeList();
      out.push("<hr/>");
      i += 1;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        parts.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(`<blockquote>${parts.map((p) => inline(p)).join("<br/>")}</blockquote>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      const wanted: "ul" | "ol" = bullet ? "ul" : "ol";
      if (listType !== wanted) {
        closeList();
        out.push(`<${wanted}>`);
        listType = wanted;
      }
      out.push(`<li>${inline((bullet ?? numbered)?.[1] ?? "")}</li>`);
      i += 1;
      continue;
    }

    if (line.trim() === "") {
      closeList();
      i += 1;
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
    i += 1;
  }
  closeList();
  return out.join("\n");
}
