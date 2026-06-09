import type { Metadata } from "next";
import { WorldCupHeader } from "../../components/world-cup/wc-header";
import { LegalFooter } from "../../components/world-cup/legal-footer";
import styles from "../../components/world-cup/world-cup.module.css";

export const metadata: Metadata = {
  title: "Privacy — World Cup Forecast",
  description: "Privacy policy for the World Cup probability-research tool."
};

export default function PrivacyPage() {
  return (
    <div className={styles.shell}>
      <WorldCupHeader />
      <div className={styles.container}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>隐私政策 / Privacy</h1>
        </section>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>我们收集什么 / What we store</h2>
          <p className={styles.muted} style={{ lineHeight: 1.7 }}>
            浏览缓存报告无需登录，也不需账户。仅当你登录运行自定义预测时，我们才存储：社交登录身份（OIDC issuer/subject）、邮箱、显示名、头像、邀请激活状态与运行用量记录（用于配额）。你输入的事件文本会被保存以生成与复盘报告。
            Browsing cached reports requires no login or account. Only when you sign in to run a custom forecast do we
            store: your social-login identity (OIDC issuer/subject), email, display name, avatar, invite-activation
            status, and run-usage records (for quota). Event text you enter is stored to generate and review reports.
          </p>
        </div>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>你的权利 / Your rights</h2>
          <p className={styles.muted} style={{ lineHeight: 1.7 }}>
            你可以请求导出或删除你的账户数据与运行记录。删除账户即移除上述个人数据。 You may request export or deletion of
            your account data and run history. Deleting your account removes the personal data above.
          </p>
        </div>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>我们不做什么 / What we don't do</h2>
          <p className={styles.muted} style={{ lineHeight: 1.7 }}>
            我们不出售个人数据，不用于博彩营销，不向博彩平台共享用户身份。 We do not sell personal data, do not use it for
            gambling marketing, and do not share user identities with betting platforms.
          </p>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
