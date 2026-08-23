// Thin compatibility shim: the engine moved to packages/forecast-engine
// (issue #56 stage one). Everything that spawns `tsx scripts/forecast/cli.ts`
// (raven run-manager, forecast-api run-manager, paper-agent evaluator, the
// `pnpm forecast:event` script) keeps working through this path. The CLI has
// no main guard — importing it runs it.
import "@autopoly/forecast-engine/cli";
