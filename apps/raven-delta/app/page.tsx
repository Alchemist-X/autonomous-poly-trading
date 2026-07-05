import { resolveEngine } from "../lib/analyzer/provider";
import { getUniverse } from "../lib/analyzer/universe";
import { DeltaConsole } from "../components/delta-console";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const resolution = resolveEngine();
  const universe = getUniverse();
  return <DeltaConsole engine={resolution.engine} universeSize={universe.stocks.length} universeVersion={universe.version} />;
}
