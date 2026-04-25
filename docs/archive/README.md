# Wasted

英文版见 [README.en.md](README.en.md)。

这个目录专门收口当前仓库里已经不该继续散落在一级目录的历史资料。

当前归档内容：

- `legacy-docs/`：旧 handoff 文档，包含 `260316-handoff.*`、`handoff-0317.*`
- `exploration/`：一次性探索稿，当前是 `multi-wallet-register.*`
- `progress-history/`：单次运行留下的历史进度记录
- `bundles/`：本次清理生成的打包文件

处理原则：

- 仍被主链路、脚本默认路径或代码直接引用的文件，继续留在原位
- 已经主要用于历史追溯、交接回看或一次性讨论的内容，统一挪到这里
- 本地生成缓存如 `.playwright-cli/`、`output/`、`.DS_Store` 直接删除，不再保留副本
