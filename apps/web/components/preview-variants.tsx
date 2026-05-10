import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate, formatPct, formatUsd } from "../lib/format";
import type { PreviewDashboardData } from "../lib/preview-dashboard";

const previewRoutes = [
  {
    href: "/previews/atlas",
    name: "版本 A",
    title: "Atlas",
    summary: "偏公开展示站。强调账户规模、代表仓位和模型解释，适合第一次点进来的人。"
  },
  {
    href: "/previews/ledger",
    name: "版本 B",
    title: "Ledger",
    summary: "偏研究周报。把账户看成一份持续更新的交易笔记，更强调时间线和上下文。"
  },
  {
    href: "/previews/mission-control",
    name: "版本 C",
    title: "Mission Control",
    summary: "偏交易监控。信息密度更高，但仍控制可读性，适合高频查看账户波动。"
  },
  {
    href: "/previews/balancer-core",
    name: "版本 D",
    title: "Balancer Core",
    summary: "参考 Balancer 的深色流动感，首屏把单位净值 NAV 和 AI terminal 同时推到最明显位置。"
  },
  {
    href: "/previews/balancer-research",
    name: "版本 E",
    title: "Balancer Research",
    summary: "把 NAV、持仓操作理由和事件聚类做成研究型页面，更适合解释为什么要调仓。"
  },
  {
    href: "/previews/balancer-flow",
    name: "版本 F",
    title: "Balancer Flow",
    summary: "更像 AI 自主交易首页，强调终端式流动输出、事件主题暴露和 Polymarket 市场跳转。"
  },
  {
    href: "/previews/nav",
    name: "版本 G",
    title: "NAV Beacon",
    summary: "把单位净值放到第一屏，先看账户曲线，再看资金结构。"
  },
  {
    href: "/previews/terminal",
    name: "版本 H",
    title: "Terminal",
    summary: "用终端式流动输出解释模型每一步在做什么，细到搜索记录和 agent 指令。"
  },
  {
    href: "/previews/clusters",
    name: "版本 I",
    title: "Clusters",
    summary: "把持仓按政治、体育、宏观等主题分组，并且所有市场都跳 Polymarket。"
  },
  {
    href: "/previews/pizza-ledger-folio",
    name: "Pizza A",
    title: "Folio",
    summary: "沿用 Pizza 实盘数据和原 ledger 信息结构，但改成偏研究简报的纸面卡片风格。"
  },
  {
    href: "/previews/pizza-ledger-terminal",
    name: "Pizza B",
    title: "Terminal",
    summary: "沿用同一组 Pizza 交易数据，改成高密度 operator terminal 风格，适合频繁扫盘。"
  },
  {
    href: "/previews/pizza-ledger-exchange",
    name: "Pizza C",
    title: "Exchange",
    summary: "沿用同一组 Pizza 交易数据，改成清爽券商看板风格，强调 NAV、ROI 和 ledger 可读性。"
  }
] as const;

function shortenAddress(address: string | null | undefined): string {
  if (!address) {
    return "未配置";
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function clipText(value: string | null | undefined, maxLength = 180): string {
  if (!value) {
    return "暂无可展示的说明。";
  }

  const normalized = value
    .replace(/[#>*_`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function toMarketLabel(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .slice(0, 9)
    .join(" ");
}

function sparklinePath(points: PreviewDashboardData["overview"]["equity_curve"], width = 320, height = 84): string {
  if (points.length === 0) {
    return "";
  }

  const values = points.map((point) => point.total_equity_usd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.total_equity_usd - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function PositiveNegativeValue({ value, suffix = "", isPercent = false }: { value: number; suffix?: string; isPercent?: boolean }) {
  const tone = value >= 0 ? "is-positive" : "is-negative";
  const display = isPercent ? formatPct(value) : `${value.toFixed(2)}${suffix}`;
  return <span className={tone}>{display}</span>;
}

function Sparkline({ data, className }: { data: PreviewDashboardData; className?: string }) {
  const d = sparklinePath(data.overview.equity_curve);

  return (
    <div className={`preview-sparkline ${className ?? ""}`.trim()}>
      <svg viewBox="0 0 320 84" aria-label="净值曲线">
        <path className="preview-sparkline-area" d={`${d} L 320 84 L 0 84 Z`} />
        <path className="preview-sparkline-line" d={d} />
      </svg>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  note
}: {
  eyebrow: string;
  title: string;
  note: string;
}) {
  return (
    <header className="preview-section-title">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      <span>{note}</span>
    </header>
  );
}

function PositionList({ data, compact = false }: { data: PreviewDashboardData; compact?: boolean }) {
  return (
    <div className={`preview-position-list${compact ? " is-compact" : ""}`}>
      {data.topPositions.map((position, index) => (
        <article key={position.id} className="preview-position-item">
          <div>
            <span className="preview-index">{String(index + 1).padStart(2, "0")}</span>
            <h3>{toMarketLabel(position.market_slug)}</h3>
            <p>{position.outcome_label} · {formatDate(position.updated_at)}</p>
          </div>
          <dl>
            <div>
              <dt>仓位市值</dt>
              <dd>{formatUsd(position.current_value_usd)}</dd>
            </div>
            <div>
              <dt>当前价格</dt>
              <dd>{position.current_price.toFixed(3)}</dd>
            </div>
            <div>
              <dt>浮动 P&L</dt>
              <dd><PositiveNegativeValue value={position.unrealized_pnl_pct} isPercent /></dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function TradeList({ data }: { data: PreviewDashboardData }) {
  return (
    <div className="preview-trade-list">
      {data.recentTrades.map((trade) => (
        <article key={trade.id} className="preview-trade-item">
          <div className="preview-trade-main">
            <strong>{trade.side === "BUY" ? "买入" : "卖出"}</strong>
            <span>{toMarketLabel(trade.market_slug)}</span>
          </div>
          <div className="preview-trade-meta">
            <span>{formatUsd(trade.filled_notional_usd || trade.requested_notional_usd)}</span>
            <span>{trade.avg_price == null ? "未回填价格" : `均价 ${trade.avg_price.toFixed(3)}`}</span>
            <span>{formatDate(trade.timestamp_utc)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function PulseCards({ data }: { data: PreviewDashboardData }) {
  const items = data.pulseExamples.slice(0, 3);

  if (items.length === 0) {
    return (
      <div className="preview-empty-state">
        <strong>当前没有可展示的 pulse 样本。</strong>
        <span>本地预览仍然保留了结构，后续接入新样本时会自动填充。</span>
      </div>
    );
  }

  return (
    <div className="preview-pulse-grid">
      {items.map((item) => (
        <article key={item.run_id} className="preview-pulse-card">
          <div className="preview-pulse-head">
            <span>{item.pulse_evidence_status === "present" ? "证据已保存" : "证据缺失"}</span>
            <strong>{formatUsd(item.recommended_notional_usd)}</strong>
          </div>
          <h3>{toMarketLabel(item.market_slug)}</h3>
          <p>{clipText(item.decision_reason_md, 120)}</p>
          <dl>
            <div>
              <dt>pulse 时间</dt>
              <dd>{formatDate(item.pulse_published_at_utc ?? item.generated_at_utc)}</dd>
            </div>
            <div>
              <dt>真实成交</dt>
              <dd>{item.executed_trade_count} 笔</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function PreviewNote({ children }: { children: ReactNode }) {
  return <p className="preview-note">{children}</p>;
}

export function PreviewHub({ data }: { data: PreviewDashboardData }) {
  return (
    <div className="preview-root preview-hub">
      <section className="preview-hub-hero">
        <div>
          <p className="preview-eyebrow">Local Preview Lab</p>
          <h1>给同一个 Polymarket 账户做九套不同的展示层。</h1>
          <PreviewNote>
            这些版本都接现在这套公开数据，只改页面语言、视觉风格和信息组织方式。你可以先本地挑方向，再决定替换正式站。
          </PreviewNote>
        </div>
        <div className="preview-summary-board">
          <article>
            <span>账户总额</span>
            <strong>{formatUsd(data.overview.total_equity_usd)}</strong>
          </article>
          <article>
            <span>现金</span>
            <strong>{formatUsd(data.overview.cash_balance_usd)}</strong>
          </article>
          <article>
            <span>持仓数</span>
            <strong>{data.overview.open_positions}</strong>
          </article>
          <article>
            <span>钱包</span>
            <strong>{shortenAddress(data.profile?.address)}</strong>
          </article>
        </div>
      </section>

      <section className="preview-card-grid">
        {previewRoutes.map((route) => (
          <article key={route.href} className="preview-route-card">
            <p>{route.name}</p>
            <h2>{route.title}</h2>
            <span>{route.summary}</span>
            <Link href={route.href}>打开本地预览</Link>
          </article>
        ))}
      </section>
    </div>
  );
}

export function AtlasPreview({ data }: { data: PreviewDashboardData }) {
  return (
    <div className="preview-root preview-atlas">
      <section className="preview-atlas-hero">
        <div className="preview-atlas-copy">
          <p className="preview-eyebrow">Atlas / Public Observatory</p>
          <h1>先告诉访客这个账户现在有多少钱、压在哪些题上、刚刚做了什么。</h1>
          <PreviewNote>
            这版最像一个真正对外公开的围观站。它默认先回答陌生访客的三个问题：账户规模、代表仓位、最近动作。
          </PreviewNote>
          <div className="preview-chip-row">
            <span>公开钱包</span>
            <span>实时访问更新</span>
            <span>模型过程可见</span>
          </div>
        </div>
        <aside className="preview-atlas-rail">
          <article>
            <span>账户总额</span>
            <strong>{formatUsd(data.overview.total_equity_usd)}</strong>
          </article>
          <article>
            <span>现金部分</span>
            <strong>{formatUsd(data.overview.cash_balance_usd)}</strong>
          </article>
          <article>
            <span>回撤</span>
            <strong><PositiveNegativeValue value={data.overview.drawdown_pct} isPercent /></strong>
          </article>
          <article>
            <span>最后运行</span>
            <strong>{formatDate(data.overview.last_run_at)}</strong>
          </article>
        </aside>
      </section>

      <section className="preview-atlas-band">
        <SectionTitle eyebrow="净值" title="一个更像公开产品首页的总览" note="大数字 + 一条曲线，先给用户一个规模感。" />
        <div className="preview-atlas-band-grid">
          <div className="preview-surface-card is-tall">
            <Sparkline data={data} className="is-atlas" />
          </div>
          <div className="preview-surface-card">
            <h3>钱包</h3>
            <p>{shortenAddress(data.profile?.address)}</p>
            <span>{data.profile?.display_name ?? "未公开昵称"}</span>
          </div>
          <div className="preview-surface-card">
            <h3>最近 pulse</h3>
            <p>{data.latestPulse ? toMarketLabel(data.latestPulse.market_slug) : "暂无样本"}</p>
            <span>{data.latestPulse ? clipText(data.latestPulse.decision_reason_md, 70) : "等待新样本"}</span>
          </div>
        </div>
      </section>

      <section className="preview-split-grid">
        <div className="preview-surface-card">
          <SectionTitle eyebrow="Top Positions" title="最值得盯的仓位" note="按当前仓位市值排序，不需要先点进持仓页。" />
          <PositionList data={data} compact />
        </div>
        <div className="preview-surface-card">
          <SectionTitle eyebrow="Latest Trades" title="最近成交" note="每条记录只保留方向、金额、价格和时间。" />
          <TradeList data={data} />
        </div>
      </section>

      <section className="preview-surface-card">
        <SectionTitle eyebrow="Explainability" title="把模型过程直接展示出来" note="不是只放数字，还要给围观者一个解释入口。" />
        <PulseCards data={data} />
      </section>
    </div>
  );
}

export function LedgerPreview({ data }: { data: PreviewDashboardData }) {
  return (
    <div className="preview-root preview-ledger">
      <section className="preview-ledger-hero">
        <div>
          <p className="preview-eyebrow">Ledger / Research Letter</p>
          <h1>把一个实时账户改写成持续更新的交易笔记，而不是控制台。</h1>
        </div>
        <dl className="preview-ledger-strip">
          <div>
            <dt>今天看到的账户总额</dt>
            <dd>{formatUsd(data.overview.total_equity_usd)}</dd>
          </div>
          <div>
            <dt>已开仓市场</dt>
            <dd>{data.overview.open_positions}</dd>
          </div>
          <div>
            <dt>最新成交时间</dt>
            <dd>{formatDate(data.recentTrades[0]?.timestamp_utc ?? null)}</dd>
          </div>
        </dl>
      </section>

      <section className="preview-ledger-columns">
        <article className="preview-ledger-sheet">
          <SectionTitle eyebrow="读者先看" title="这份页面适合想长期跟踪账户的人" note="弱化交易终端感，强化‘这几天发生了什么’。" />
          <PreviewNote>
            这版不是把所有字段一次扔给用户，而是把信息整理成几段可读内容：账户概况、最近行为、代表仓位，以及模型给过什么理由。
          </PreviewNote>
          <Sparkline data={data} className="is-ledger" />
        </article>

        <article className="preview-ledger-sheet">
          <SectionTitle eyebrow="现在持有什么" title="账户快照" note="保留最少但够用的数字。" />
          <div className="preview-fact-stack">
            <div>
              <span>现金</span>
              <strong>{formatUsd(data.overview.cash_balance_usd)}</strong>
            </div>
            <div>
              <span>高水位</span>
              <strong>{formatUsd(data.overview.high_water_mark_usd)}</strong>
            </div>
            <div>
              <span>当前回撤</span>
              <strong><PositiveNegativeValue value={data.overview.drawdown_pct} isPercent /></strong>
            </div>
          </div>
        </article>
      </section>

      <section className="preview-ledger-columns">
        <article className="preview-ledger-sheet">
          <SectionTitle eyebrow="最近动作" title="时间线" note="比表格更像直播记录。" />
          <div className="preview-timeline">
            {data.recentActivity.slice(0, 6).map((item) => (
              <article key={item.id}>
                <strong>{item.side === "SELL" ? "卖出 / 回收" : item.side === "BUY" ? "买入 / 支出" : item.type}</strong>
                <p>{toMarketLabel(item.market_slug)}</p>
                <span>{formatUsd(item.usdc_size)} · {formatDate(item.timestamp_utc)}</span>
              </article>
            ))}
          </div>
        </article>

        <article className="preview-ledger-sheet">
          <SectionTitle eyebrow="代表仓位" title="这几个题最能代表当前账户" note="让读者先看到最重要的 4 笔，而不是一整页列表。" />
          <PositionList data={data} />
        </article>
      </section>

      <section className="preview-ledger-sheet">
        <SectionTitle eyebrow="模型解释" title="为什么会下这几笔" note="把 pulse 摘要做成一组研究卡片。" />
        <PulseCards data={data} />
      </section>
    </div>
  );
}

export function MissionControlPreview({ data }: { data: PreviewDashboardData }) {
  return (
    <div className="preview-root preview-mission">
      <section className="preview-mission-hero">
        <div className="preview-mission-copy">
          <p className="preview-eyebrow">Mission Control / Trading Monitor</p>
          <h1>更接近“实时监控席位”，但不把字段挤成一团。</h1>
          <PreviewNote>
            这版保留更高的信息密度，用来频繁刷新看账户变化，但每块信息都控制在一眼能扫完的层级里。
          </PreviewNote>
        </div>
        <div className="preview-mission-scoreboard">
          <article>
            <span>总额</span>
            <strong>{formatUsd(data.overview.total_equity_usd)}</strong>
          </article>
          <article>
            <span>现金</span>
            <strong>{formatUsd(data.overview.cash_balance_usd)}</strong>
          </article>
          <article>
            <span>持仓</span>
            <strong>{data.overview.open_positions}</strong>
          </article>
          <article>
            <span>回撤</span>
            <strong><PositiveNegativeValue value={data.overview.drawdown_pct} isPercent /></strong>
          </article>
        </div>
      </section>

      <section className="preview-mission-grid">
        <article className="preview-mission-panel is-wide">
          <SectionTitle eyebrow="Equity" title="净值监控" note="第一屏直接放曲线和关键数字。" />
          <Sparkline data={data} className="is-mission" />
          <div className="preview-stat-row">
            <div>
              <span>高水位</span>
              <strong>{formatUsd(data.overview.high_water_mark_usd)}</strong>
            </div>
            <div>
              <span>最后运行</span>
              <strong>{formatDate(data.overview.last_run_at)}</strong>
            </div>
            <div>
              <span>风险事件</span>
              <strong>{data.overview.latest_risk_event ?? "暂无"}</strong>
            </div>
          </div>
        </article>

        <article className="preview-mission-panel">
          <SectionTitle eyebrow="Pulse" title="最近策略输出" note="把推荐逻辑和实盘结果放一起。" />
          <PulseCards data={data} />
        </article>

        <article className="preview-mission-panel">
          <SectionTitle eyebrow="Positions" title="当前暴露" note="按仓位市值排序，快速看到哪几笔最重要。" />
          <PositionList data={data} compact />
        </article>

        <article className="preview-mission-panel">
          <SectionTitle eyebrow="Tape" title="最近成交" note="保留交易席位感，但避免密集字段重叠。" />
          <TradeList data={data} />
        </article>
      </section>
    </div>
  );
}
