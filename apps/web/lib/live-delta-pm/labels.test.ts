import { describe, expect, it } from "vitest";
import { LANG_COOKIE_NAME, otherLang, parseLang, t } from "./i18n";
import {
  fmtDurationMs,
  fmtHours,
  fmtMinutes,
  labelAction,
  labelGuard,
  labelKind,
  labelPostEvent,
  labelPricedIn,
  labelTradeDirection,
  newsSourceName
} from "./labels";

// zh is the source of truth: the zh assertions below are byte-identical to the
// strings the page shipped with before the EN/中文 toggle existed.
describe("live-delta-pm bilingual labels", () => {
  it("keeps zh enum labels byte-identical to the original page", () => {
    expect(labelKind("zh", "article")).toBe("文章");
    expect(labelTradeDirection("zh", "long")).toBe("做多");
    expect(labelPricedIn("zh", "partial")).toBe("部分定价");
    expect(labelPricedIn("zh", "awaiting_market")).toBe("待行情");
    expect(labelAction("zh", "no_trade")).toBe("不开仓");
    expect(labelPostEvent("zh", "hard_floor_stop")).toBe("硬性红线止损（−20%）");
    expect(labelGuard("zh", "tier1_cap")).toBe("一档流动性上限");
    expect(labelGuard("zh", "cluster_cap:AI")).toBe("关联簇上限（AI）");
  });

  it("renders the en counterparts", () => {
    expect(labelKind("en", "article")).toBe("Article");
    expect(labelTradeDirection("en", "short")).toBe("Short");
    expect(labelPricedIn("en", "partial")).toBe("Partially priced");
    expect(labelAction("en", "no_trade")).toBe("No trade");
    expect(labelPostEvent("en", "hard_floor_stop")).toBe("Hard-floor stop (−20%)");
    expect(labelGuard("en", "cluster_cap:AI")).toBe("Cluster cap (AI)");
  });

  it("falls back to the raw string for unknown enums in both languages", () => {
    expect(labelKind("zh", "podcast")).toBe("podcast");
    expect(labelKind("en", "podcast")).toBe("podcast");
    expect(labelGuard("en", "mystery_cap")).toBe("mystery_cap");
    expect(newsSourceName("unknown-slug")).toBe("unknown-slug");
  });

  it("keeps zh duration words byte-identical and translates the units in en", () => {
    expect(fmtMinutes("zh", 43.2)).toBe("43.2 分钟");
    expect(fmtMinutes("en", 43.2)).toBe("43.2 min");
    expect(fmtMinutes("zh", 0.5)).toBe("30 秒");
    expect(fmtMinutes("en", 1500)).toBe("25.0 h");
    expect(fmtDurationMs("zh", 229646)).toBe("3.8 分钟");
    expect(fmtDurationMs("en", 229646)).toBe("3.8 min");
    expect(fmtDurationMs("zh", 158)).toBe("0.2 秒");
    expect(fmtHours("zh", 72)).toBe("72 小时（≈ 3 天）");
    expect(fmtHours("en", 72)).toBe("72 h (≈ 3 d)");
    expect(fmtHours("zh", 24)).toBe("24 小时");
    // Numbers themselves are language-independent.
    expect(fmtMinutes("zh", null)).toBe("—");
    expect(fmtMinutes("en", null)).toBe("—");
  });
});

describe("live-delta-pm i18n dictionary", () => {
  it("defaults to zh and only 'en' switches", () => {
    expect(parseLang(undefined)).toBe("zh");
    expect(parseLang("zh")).toBe("zh");
    expect(parseLang("en")).toBe("en");
    expect(parseLang("fr")).toBe("zh");
    expect(otherLang("zh")).toBe("en");
    expect(otherLang("en")).toBe("zh");
    expect(LANG_COOKIE_NAME).toBe("ldp_lang");
  });

  it("serves zh strings byte-identical to the original page copy", () => {
    const s = t("zh");
    expect(s("title")).toBe("Delta PM 决策链审计");
    expect(s("st2Title")).toBe("重要性检查");
    expect(s("st3Tag")).toBe("原 M1 · 闸门2");
    expect(s("bannerShadow")).toBe("Phase 0 影子模式 · 只记账，不下真实订单");
    expect(s("gateError")).toBe("访问码不对，再试一次。");
    expect(s("archiveEmpty")).toBe("该条早于原文存档功能（2026-08-23 起存档），无原文留档。");
  });

  it("serves en strings for the same keys", () => {
    const s = t("en");
    expect(s("title")).toBe("Delta PM Decision-Chain Audit");
    expect(s("st2Title")).toBe("Importance gate");
    expect(s("st3Title")).toBe("Priced-in gate");
    expect(s("verdictPass")).toBe("Clears threshold");
    expect(s("gateUnlock")).toBe("Unlock");
  });
});
