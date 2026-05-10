import Link from "next/link";
import type { ReactNode } from "react";

const previewItems = [
  { href: "/previews", label: "预览总览" },
  { href: "/previews/atlas", label: "版本 A · Atlas" },
  { href: "/previews/ledger", label: "版本 B · Ledger" },
  { href: "/previews/mission-control", label: "版本 C · Mission Control" },
  { href: "/previews/balancer-core", label: "版本 D · Balancer Core" },
  { href: "/previews/balancer-research", label: "版本 E · Balancer Research" },
  { href: "/previews/balancer-flow", label: "版本 F · Balancer Flow" },
  { href: "/previews/nav", label: "版本 G · NAV Beacon" },
  { href: "/previews/terminal", label: "版本 H · Terminal" },
  { href: "/previews/clusters", label: "版本 I · Clusters" },
  { href: "/previews/pizza-ledger-folio", label: "Pizza A · Folio" },
  { href: "/previews/pizza-ledger-terminal", label: "Pizza B · Terminal" },
  { href: "/previews/pizza-ledger-exchange", label: "Pizza C · Exchange" }
];

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="preview-layout">
      <div className="preview-layout-bar">
        <p>本地预览 / 候选界面对比</p>
        <div className="preview-layout-links">
          {previewItems.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
          <Link href="/">返回当前正式页</Link>
        </div>
      </div>
      {children}
    </div>
  );
}
