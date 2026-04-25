# Wasted

Chinese version: [README.md](README.md).

This directory collects historical material that no longer belongs in the repo root.

Current archived contents:

- `legacy-docs/`: old handoff notes, including `260316-handoff.*` and `handoff-0317.*`
- `exploration/`: one-off exploration notes, currently `multi-wallet-register.*`
- `progress-history/`: historical single-run progress records
- `bundles/`: packaged bundles generated during this cleanup

Rules:

- Files still used by the main runtime, default script paths, or direct code references stay where they are
- Content kept mainly for historical traceability, handoff review, or one-off discussion is moved here
- Local generated caches such as `.playwright-cli/`, `output/`, and `.DS_Store` are deleted instead of archived
