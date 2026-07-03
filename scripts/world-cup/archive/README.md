# 已冻结的一次性脚本（2026-07-03 归档）

小组赛 2026-06-28 冻结后，这些 sprint 一次性脚本的历史使命已完成，移入本目录只作方法论留档，**不再维护、不保证可跑**。

| 脚本 | 用途 | 产物（已固化提交） |
| --- | --- | --- |
| `mc-sim.py` | 小组赛纯 Elo/Poisson 蒙特卡洛（100k 次，seed=20260611 可逐位复现已发布结果） | `runtime-artifacts/world-cup/mc-results.json` |
| `build-bracket-prediction.py` | 模态对阵路径推导 | `runtime-artifacts/world-cup/bracket-prediction.json` |
| `build-event-list.ts` | 87 题事件清单生成（含结算定义，无价格） | `runtime-artifacts/world-cup/event-list/` |
| `ws-listen.ts` | Polymarket WS 基建验证 demo | 无（验证完即失效） |

活跃的淘汰赛管线在上层目录（`fifa8-*.ts`）与 `packages/fifa-models`。赛制常量以 `packages/fifa-models/src/bracket.ts` 为唯一权威，本目录归档件内的重复定义不再维护。
