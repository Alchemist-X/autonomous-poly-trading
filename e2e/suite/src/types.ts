export type EnvironmentProfile = "local-lite" | "remote-real";
export type CapabilityPhase = "trading-system" | "autonomous-dev-loop";
export type ArtifactKind = "video" | "screenshot" | "log" | "trace" | "db-snapshot" | "http-dump" | "git-dump";
export type ScenarioStatus = "passed" | "failed" | "skipped";

export interface ScenarioAssertion {
  name: string;
  passed: boolean;
  details?: string;
}

export interface ScenarioArtifact {
  kind: ArtifactKind;
  label: string;
  path: string;
}

export interface ScenarioResult {
  id: string;
  status: ScenarioStatus;
  assertions: ScenarioAssertion[];
  artifacts: ScenarioArtifact[];
  summary: string;
  nextAction?: string;
  metadata?: Record<string, unknown>;
}

export interface ManagedProcessHandle {
  name: string;
  logPath: string;
  stop: () => Promise<void>;
}

export interface RuntimeState {
  cleanup: Array<() => Promise<void>>;
  processes: ManagedProcessHandle[];
  latestRunId?: string;
}

export interface ScenarioContext {
  repoRoot: string;
  profile: EnvironmentProfile;
  baseUrls: {
    web: string;
    orchestrator?: string;
    executor?: string;
  };
  credentials: {
    adminPassword: string;
    orchestratorToken: string;
  };
  featureFlags: {
    allowRealTrading: boolean;
    allowDestructiveAdmin: boolean;
    remoteEnabled: boolean;
  };
  artifactDir: string;
  liveTradeBudget: number;
  allowlistedMarketSlugs: string[];
  timeouts: {
    startupMs: number;
    pollingMs: number;
    browserMs: number;
  };
  stateFilePath?: string;
  runtime?: RuntimeState;
  ports?: {
    web?: number;
    orchestrator?: number;
    executor?: number;
  };
}

export interface ScenarioModule {
  id: string;
  phase: CapabilityPhase;
  run(context: ScenarioContext): Promise<ScenarioResult>;
}
