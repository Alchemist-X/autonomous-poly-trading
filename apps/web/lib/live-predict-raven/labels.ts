// Chinese display labels for the live-predict-raven page. The VM API speaks
// slugs + English question text; this map decorates both. Unknown keys fall
// back to the raw English string so new markets degrade gracefully.

const QUESTION_ZH: Record<string, string> = {
  "strait-of-hormuz-traffic-returns-to-normal-by-july-31": "霍尔木兹海峡 7/31 前恢复正常通航？",
  "strait-of-hormuz-traffic-returns-to-normal-by-december-31": "霍尔木兹海峡 12/31 前恢复正常通航？",
  "putin-out-before-2027": "普京 2027 年前卸任俄罗斯总统？",
  "putin-out-before-2027-346": "普京 2027 年前卸任俄罗斯总统？",
  "us-iran-final-nuclear-deal-by-september-30-2026": "美伊 9/30 前达成最终核协议？",
  "will-ukraine-recapture-crimean-territory-by-december-31-2026": "乌克兰 12/31 前收复克里米亚领土？",
  "will-the-us-invade-iran-before-2027": "美国 2027 年前入侵伊朗？",
  "us-x-iran-diplomatic-meeting-by-july-10-2026-20260622191708360": "美伊 7/10 前举行外交会晤？",
  "us-x-iran-diplomatic-meeting-by-july-31-2026-20260622191708361": "美伊 7/31 前举行外交会晤？",
  "nato-x-russia-military-clash-by-december-31-2026-244": "NATO 与俄罗斯年底前军事冲突？",
  "mojtaba-khamenei-seen-in-public-by-july-15-155": "Mojtaba Khamenei 7/15 前公开露面？",
  "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17": "伊朗 7/17 前宣布退出 MOU 谈判？",
  "US x Iran diplomatic meeting by July 10, 2026?": "美伊 7/10 前举行外交会晤？",
  "US x Iran diplomatic meeting by July 31, 2026?": "美伊 7/31 前举行外交会晤？",
  "NATO x Russia military clash by December 31, 2026?": "NATO 与俄罗斯年底前军事冲突？",
  "Mojtaba Khamenei seen in public by July 15?": "Mojtaba Khamenei 7/15 前公开露面？",
  "Will Iran announce withdrawal from MOU negotiations by July 17?": "伊朗 7/17 前宣布退出 MOU 谈判？",
  "China x Philippines military clash before 2027?": "中菲 2027 前军事冲突？",
  "Strait of Hormuz traffic returns to normal by July 31?": "霍尔木兹海峡 7/31 前恢复正常通航？",
  "Strait of Hormuz traffic returns to normal by December 31?": "霍尔木兹海峡 12/31 前恢复正常通航？",
  "Putin out as President of Russia by December 31, 2026?": "普京 2027 年前卸任俄罗斯总统？",
  "US-Iran Final Nuclear Deal by September 30, 2026?": "美伊 9/30 前达成最终核协议？",
  "Will Ukraine recapture Crimean territory by December 31, 2026?": "乌克兰 12/31 前收复克里米亚领土？",
  "Will the U.S. invade Iran before 2027?": "美国 2027 年前入侵伊朗？"
};

// Editorial context for known closed round trips, keyed by slug@closedDate.
const TRADE_NOTES: Record<string, string> = {
  "us-x-iran-diplomatic-meeting-by-july-31-2026-20260622191708361@2026-07-05":
    "退出后价格跌到 0.065 — 反事实检验里最赚的一次退出（α +$542）",
  "mojtaba-khamenei-seen-in-public-by-july-15-155@2026-07-15":
    "持有 12 天到临近结算；这次 0.994 卖出正是 99% 钳位强制的（saturated-hold 修复的起因）",
  "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17@2026-07-15":
    "agent 估 19.5% vs 市场 6.4%，4 小时后止损",
  "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17@2026-07-16":
    "止损 4 小时后原方向重新进场，再次止损；事件最终未发生"
};

export function zhQuestion(slugOrQuestion: string, fallback?: string): string {
  return QUESTION_ZH[slugOrQuestion] ?? fallback ?? slugOrQuestion;
}

export function tradeNote(slug: string, closedUtc: string): string | undefined {
  return TRADE_NOTES[`${slug}@${closedUtc.slice(0, 10)}`];
}

export function zhExitStyle(style: string): string {
  if (style === "market+limit") return "市价+限价两腿";
  if (style === "market") return "市价";
  if (style === "limit") return "限价";
  return style;
}

export function zhExitReason(reason: string): string {
  if (reason.startsWith("stop_loss")) return "止损";
  if (reason.startsWith("negative_edge")) {
    return reason.includes("limit_ttl_fallback") ? "负 edge 退出+限价单超时回落" : "负 edge 退出";
  }
  return reason;
}

/** ISO timestamp → "MM-DD HH:mm" (UTC). */
export function shortUtc(iso: string): string {
  return iso.length >= 16 ? `${iso.slice(5, 10)} ${iso.slice(11, 16)}` : iso;
}
