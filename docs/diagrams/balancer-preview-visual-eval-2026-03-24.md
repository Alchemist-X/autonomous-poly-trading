# Balancer 风格预览视觉评估

日期：2026-03-24

## 目标

- 以 `balancer.fi` 首页作为视觉 baseline。
- 对本地预览页做截图、评估、迭代，直到通过以下 gate：
  - 不再有失控大字
  - 不再有明显溢出
  - 材质语言基本统一
  - 信息层级达到可接受线

## 工作流

1. 本地构建预览页。
2. 用 Playwright 保存本地截图和 Balancer baseline 截图。
3. 由 `visual-eval-agent` 依据体验打分。
4. 只修改扣分最高的视觉问题。
5. 重复截图和打分，直到过 gate。

## 截图归档

- 本地预览初版：
  `/Users/Aincrad/dev-proj/autonomous-poly-trading/output/playwright/visual-eval/.playwright-cli/page-2026-03-24T07-14-15-006Z.png`
- Balancer baseline：
  `/Users/Aincrad/dev-proj/autonomous-poly-trading/output/playwright/visual-eval/.playwright-cli/page-2026-03-24T07-14-41-573Z.png`
- 第二轮：
  `/Users/Aincrad/dev-proj/autonomous-poly-trading/output/playwright/visual-eval/.playwright-cli/page-2026-03-24T07-18-39-413Z.png`
- 第三轮通过版：
  `/Users/Aincrad/dev-proj/autonomous-poly-trading/output/playwright/visual-eval/.playwright-cli/page-2026-03-24T07-22-32-412Z.png`

## 评分记录

### 第一轮

- 字体克制：4/10
- 信息层级：5/10
- 内容不溢出：3/10
- 卡片对齐/节奏：4/10
- 整体高级感：4/10

主要问题：

- 主标题过大，压垮页面。
- 右侧卡片信息太淡，像未加载完成。
- 页面节奏不统一，像几套系统拼在一起。

### 第二轮

- 字体克制：6/10
- 信息层级：6/10
- 内容不溢出：5/10
- 卡片对齐/节奏：6/10
- 整体高级感：6/10

主要问题：

- 右侧卡片读感仍然偏弱。
- 主区块稳了，但叙事还不够单一有力。
- 阴影和浅底卡混搭还不够统一。

### 第三轮

- 字体克制：7/10
- 信息层级：7/10
- 内容不溢出：8/10
- 卡片对齐/节奏：7/10
- 整体高级感：7/10

结论：

- 已通过 baseline gate。
- 当前版本已经没有失控大字，也没有明显内容溢出。
- 材质语言和卡片节奏已经基本统一，达到可继续选方向的状态。

## 这轮实际改了什么

- 降低 Balancer 三版预览的主标题字号，缩短文案长度，限制行宽。
- 修正“最近时间”卡片不再被当成超大数字展示。
- 用 `:has(.preview-layout)` 隐藏预览路由外层大壳，避免截图被正式页导航污染。
- 统一右侧信息卡和主卡的材质语言，修复右侧卡片被浅色规则覆盖的样式 bug。
- 给 NAV 图加了网格背景和平线占位，避免公开活动不足时图表看起来像坏掉。

## 当前通过版

- 预览地址：
  `http://127.0.0.1:3102/previews/balancer-flow`
- 重点文件：
  - `apps/web/components/preview-balancer-variants.tsx`
  - `apps/web/app/globals.css`

