import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import zhCN from "./messages/zh-CN.json";
import zhTW from "./messages/zh-TW.generated.json";

// The three locale resources must expose the exact same key set, otherwise a
// page renders raw key names (or English fallbacks) for the drifted locale.
// zh-TW is generated from zh-CN, so a mismatch there usually means the
// generator was not re-run after editing zh-CN.
const LOCALES: ReadonlyArray<readonly [name: string, resource: Record<string, string>]> = [
  ["en.json", en],
  ["zh-CN.json", zhCN],
  ["zh-TW.generated.json", zhTW]
];

function diff(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  return [...a].filter((key) => !b.has(key)).sort();
}

describe("world-cup message resources", () => {
  const referenceKeys = new Set(Object.keys(en));

  it.each(LOCALES.slice(1))("%s has the same key set as en.json", (_name, resource) => {
    const keys = new Set(Object.keys(resource));
    // Assert on the concrete key names so a failure prints exactly which
    // keys are missing from / extra in the locale under test.
    expect({
      missingComparedToEn: diff(referenceKeys, keys),
      extraComparedToEn: diff(keys, referenceKeys)
    }).toEqual({ missingComparedToEn: [], extraComparedToEn: [] });
  });

  // Empty strings are allowed (e.g. en "winSuffix" is intentionally "") but
  // every value must still be a string, not a nested object or null.
  it.each(LOCALES)("%s has only string values", (_name, resource) => {
    const invalid = Object.entries(resource)
      .filter(([, value]) => typeof value !== "string")
      .map(([key]) => key);
    expect(invalid).toEqual([]);
  });
});
