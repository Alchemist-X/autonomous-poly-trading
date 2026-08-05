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
  "Will the U.S. invade Iran before 2027?": "美国 2027 年前入侵伊朗？",
  "us-x-iran-effective-ceasfire-by-july-31-20260715194822045": "美伊 7/31 前达成有效停火？",
  "israel-x-iran-ceasefire-continues-through-july-31-20260716224448968-384-155-519-798-243":
    "以伊停火延续至 7/31？",
  "israel-x-iran-ceasefire-continues-through-august-15-20260716224448969-246-815-987-693":
    "以伊停火延续至 8/15？",
  "will-the-us-announce-an-iran-ceasefire-by-july-31-20260718000915875": "美国 7/31 前宣布停止对伊军事行动？",
  "will-nvidia-be-the-largest-company-in-the-world-by-market-cap-on-july-31-20260624192329841":
    "英伟达 7/31 全球市值第一？",
  "will-hamas-agree-to-disarm-by-december-31": "哈马斯 12/31 前同意解除武装？",
  "iran-leadership-change-by-august-31-669": "伊朗 8/31 前领导层更替？",
  "strait-of-hormuz-traffic-returns-to-normal-by-august-31-20260702154212320":
    "霍尔木兹海峡 8/31 前恢复正常通航？",
  "strait-of-hormuz-traffic-returns-to-normal-by-september-30-20260702154339440":
    "霍尔木兹海峡 9/30 前恢复正常通航？",
  "will-nicols-maduro-be-the-leader-of-venezuela-end-of-2026": "马杜罗 2026 年底仍是委内瑞拉领导人？",
  "us-announces-end-of-iranian-blockade-by-august-7-2026-20260727171523690": "美国 8/7 前宣布解除对伊封锁？",
  "US x Iran Effective Ceasefire by July 31?": "美伊 7/31 前达成有效停火？",
  "Israel x Iran ceasefire continues through July 31?": "以伊停火延续至 7/31？",
  "Israel x Iran ceasefire continues through August 15?": "以伊停火延续至 8/15？",
  "US announces halt in Iran offensive operations by July 31?": "美国 7/31 前宣布停止对伊军事行动？",
  "Will NVIDIA be the largest company in the world by market cap on July 31?": "英伟达 7/31 全球市值第一？",
  "Will Hamas agree to disarm by December 31?": "哈马斯 12/31 前同意解除武装？",
  "Iran leadership change by August 31?": "伊朗 8/31 前领导层更替？",
  "Strait of Hormuz traffic returns to normal by August 31?": "霍尔木兹海峡 8/31 前恢复正常通航？",
  "Strait of Hormuz traffic returns to normal by September 30?": "霍尔木兹海峡 9/30 前恢复正常通航？",
  "Will Nicolás Maduro be the leader of Venezuela end of 2026?": "马杜罗 2026 年底仍是委内瑞拉领导人？",
  "US announces end of Iranian blockade by August 7, 2026?": "美国 8/7 前宣布解除对伊封锁？",
  "Will WTI Crude Oil (WTI) hit (HIGH) $95 in July?": "WTI 原油 7 月最高价触及 $95？"
};

// Editorial context for known closed round trips, keyed by slug@closedDate.
const TRADE_NOTES: Record<string, string> = {
  "us-x-iran-diplomatic-meeting-by-july-31-2026-20260622191708361@2026-07-05":
    "退出后市场以 NO 结算——反事实检验里最赚的一次常规退出（α +$594）",
  "mojtaba-khamenei-seen-in-public-by-july-15-155@2026-07-15":
    "持有 12 天到临近结算；这次 0.994 卖出正是 99% 钳位强制的（saturated-hold 修复的起因）",
  "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17@2026-07-15":
    "agent 估 19.5% vs 市场 6.4%，4 小时后止损",
  "will-iran-announce-withdrawal-from-mou-negotiations-by-july-17@2026-07-16":
    "止损 4 小时后原方向重新进场，再次止损；事件最终未发生",
  "strait-of-hormuz-traffic-returns-to-normal-by-july-31@2026-07-27":
    "saturated-hold 多次拦截负 edge 强卖后持有到临近结算，0.9945 清仓——修复（PR #91）上线后的代表性赢单",
  "us-x-iran-effective-ceasfire-by-july-31-20260715194822045@2026-07-26":
    "开仓次日止损；7/27 又在 0.466 重进同市场（第二回合 8/4 再止损）",
  "israel-x-iran-ceasefire-continues-through-july-31-20260716224448968-384-155-519-798-243@2026-07-27":
    "以伊停火系列第一次止损",
  "will-the-us-announce-an-iran-ceasefire-by-july-31-20260718000915875@2026-07-27":
    "开仓 73 分钟即止损——本轮最快的一笔",
  "israel-x-iran-ceasefire-continues-through-july-31-20260716224448968-384-155-519-798-243@2026-07-28":
    "止损后 7 小时原方向重进，再止损（冷却期缺口重演）",
  "will-nvidia-be-the-largest-company-in-the-world-by-market-cap-on-july-31-20260624192329841@2026-07-29":
    "止损后市场最终以 YES 结算——反事实最差的一次退出（α −$1,838）；成本含 $45 入场费",
  "israel-x-iran-ceasefire-continues-through-july-31-20260716224448968-384-155-519-798-243@2026-07-30":
    "同一市场第三次进场第三次止损；三回合合计 −$601",
  "israel-x-iran-ceasefire-continues-through-august-15-20260716224448969-246-815-987-693@2026-07-31":
    "以伊停火题材换 8/15 到期日再进，第四次止损",
  "will-hamas-agree-to-disarm-by-december-31@2026-07-31":
    "止损卖在 0.11 后 NO 价反弹到 ~0.40（α −$869）；8/1 又在 0.36 重进同市场（现持仓中）",
  "us-x-iran-effective-ceasfire-by-july-31-20260715194822045@2026-08-04":
    "7/27 重进的第二回合，拖过到期日后 8/4 止损离场"
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
