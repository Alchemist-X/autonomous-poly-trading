import { describe, expect, it } from "vitest";
import { investmentHref, stripInvestmentLocale } from "./routes";

describe("investment report language navigation", () => {
  it.each([
    "/investment-analysis/meta-capex-6m",
    "/investment-analysis/meta-capex-6m/en",
    "/investment-analysis/meta-capex-6m/zh-TW/",
    "/zh-CN/investment-analysis/meta-capex-6m",
    "/apps/web/zh-CN/investment-analysis/meta-capex-6m",
    "/apps/web/en/investment-analysis/meta-capex-6m",
    "/apps/web/zh-TW/investment-analysis/meta-capex-6m"
  ])("keeps language links public when the current path is %s", (pathname) => {
    const current = stripInvestmentLocale(pathname);
    expect(investmentHref(current, "en")).toBe("/investment-analysis/meta-capex-6m/en");
    expect(investmentHref(current, "zh-CN")).toBe("/investment-analysis/meta-capex-6m");
    expect(investmentHref(current, "zh-TW")).toBe("/investment-analysis/meta-capex-6m/zh-TW");
  });

  it("switches the collection language without leaking the deployment path", () => {
    expect(investmentHref(stripInvestmentLocale("/apps/web/zh-CN/investment-analysis"), "en"))
      .toBe("/investment-analysis/en");
  });
});
