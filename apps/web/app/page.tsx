import { BalancerFlowPreview } from "../components/preview-balancer-variants";
import { LiveOverview } from "../components/live-overview";
import { LiveRuns } from "../components/live-runs";
import { PnlPortfolio } from "../components/pnl-portfolio";
import { ReportsList } from "../components/reports-list";
import { formatUsd } from "../lib/format";
import { getPreviewDashboardData } from "../lib/preview-dashboard";
import {
  getPublicOverviewData,
  getPublicPositionsData,
  getPublicRunsData,
  getPublicTradesData,
  getReportsData,
  getSpectatorClosedPositionsData,
  isSpectatorWalletMode
} from "../lib/public-wallet";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const spectatorMode = isSpectatorWalletMode();

  if (spectatorMode) {
    const data = await getPreviewDashboardData();
    return <BalancerFlowPreview data={data} />;
  }

  const [overview, positions, trades, runs, reports, closedPositions] = await Promise.all([
    getPublicOverviewData(),
    getPublicPositionsData(),
    getPublicTradesData(),
    getPublicRunsData(),
    getReportsData(),
    getSpectatorClosedPositionsData()
  ]);

  return (
    <div className="page-stack">
      <section className="lead-grid">
        <div className="panel page-lead page-lead-primary">
          <div>
            <p className="panel-kicker">围观面板</p>
            <h2>一个只读页面看完实时净值、持仓、成交和报告。</h2>
          </div>
          <p className="panel-note">这个站点会轮询公共接口，让外部用户在不接触管理权限的前提下看到账户变化。</p>
          <p className="panel-note">这个页面对外保持只读，实际操作控制仍然和公开围观界面分开。</p>
        </div>

        <aside className="panel page-brief">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">一眼看完</p>
              <h2>页面摘要</h2>
            </div>
          </div>
          <dl className="brief-grid">
            <div>
              <dt>账户总额</dt>
              <dd>{formatUsd(overview.total_equity_usd)}</dd>
            </div>
            <div>
              <dt>当前持仓市场</dt>
              <dd>{positions.length}</dd>
            </div>
            <div>
              <dt>活动记录数</dt>
              <dd>不在主页展示</dd>
            </div>
            <div>
              <dt>现金部分</dt>
              <dd>内部跟踪</dd>
            </div>
          </dl>
        </aside>
      </section>

      <div className="dashboard-grid">
        <LiveOverview initialData={overview} />
        <PnlPortfolio
          initialOverview={overview}
          initialPositions={positions}
          initialTrades={trades}
          initialClosedPositions={closedPositions}
          spectatorMode={spectatorMode}
        />
      </div>

      <div className="dashboard-grid dashboard-grid-secondary">
        <LiveRuns
          initialData={runs}
        />
        <ReportsList
          initialData={reports.map((report) => ({
            ...report,
            published_at_utc: String(report.published_at_utc)
          }))}
          endpoint="/api/public/reports"
          title="Pulse, review, monitor, and rebalance artifacts"
          kicker="Reports"
        />
      </div>
    </div>
  );
}
