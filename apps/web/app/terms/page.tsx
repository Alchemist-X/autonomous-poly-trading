import type { Metadata } from "next";
import { DISCLAIMER_FULL } from "../../lib/legal-copy";
import { WorldCupHeader } from "../../components/world-cup/wc-header";
import { LegalFooter } from "../../components/world-cup/legal-footer";
import styles from "../../components/world-cup/world-cup.module.css";

export const metadata: Metadata = {
  title: "Terms — World Cup Forecast",
  description: "Terms of use for the World Cup probability-research tool."
};

export default function TermsPage() {
  return (
    <div className={styles.shell}>
      <WorldCupHeader />
      <div className={styles.container}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>使用条款 / Terms of Use</h1>
        </section>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>性质 / Nature of the service</h2>
          <p className={styles.muted} style={{ lineHeight: 1.7 }}>
            {DISCLAIMER_FULL.zh}
          </p>
          <p className={styles.muted} style={{ lineHeight: 1.7, marginTop: 10 }}>
            {DISCLAIMER_FULL.en}
          </p>
        </div>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>不提供投注服务 / No wagering</h2>
          <p className={styles.muted} style={{ lineHeight: 1.7 }}>
            我们不接受、不撮合、不代理任何投注，不提供任何博彩平台的资金通道或返佣链接。本工具仅用于体育研究、概率教育与
            AI 能力评估。 We do not accept, place, broker, or facilitate any wagers, and we provide no funding path or
            affiliate link to any betting platform. This tool is for sports research, probability education, and AI
            capability evaluation only.
          </p>
        </div>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>数据来源 / Data</h2>
          <p className={styles.muted} style={{ lineHeight: 1.7 }}>
            概率基于公开数据（含 Polymarket 等预测市场价格，仅作为“共识偏差研究变量”）。第三方数据归其各自权利人所有，按其条款使用，我们不再分发原始数据流。
            Probabilities are derived from public data (including prediction-market prices such as Polymarket, used only
            as a “consensus bias research variable”). Third-party data remains the property of its owners and is used
            under their terms; we do not redistribute raw feeds.
          </p>
        </div>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>年龄与法域 / Age & jurisdiction</h2>
          <p className={styles.muted} style={{ lineHeight: 1.7 }}>
            预测市场与体育博彩在许多司法辖区受限或非法，请自行确认所在地法律；部分地区要求年满 18 岁。 Prediction markets
            and sports betting are restricted or illegal in many jurisdictions — confirm your local laws; some regions
            require you to be 18+.
          </p>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
