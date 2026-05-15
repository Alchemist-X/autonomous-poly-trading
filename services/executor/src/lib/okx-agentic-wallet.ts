import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ExecutorConfig } from "../config.js";

export type ExecutorWalletProvider = "private-key" | "onchainos";

type TypedDataDomain = Record<string, unknown>;
type TypedDataTypes = Record<string, Array<{ name: string; type: string }>>;
type TypedDataValue = Record<string, unknown>;

interface OnchainOsEnvelope<T> {
  ok?: boolean;
  data?: T;
  error?: string;
  confirming?: boolean;
  message?: string;
  next?: string;
}

interface OnchainOsWalletStatus {
  accountCount?: number;
  apiKey?: string | null;
  currentAccountId?: string | null;
  currentAccountName?: string | null;
  email?: string;
  loggedIn?: boolean;
  loginType?: string | null;
  policy?: Record<string, unknown> | null;
}

interface OnchainOsWalletBalanceOverview {
  accountId?: string;
  accountName?: string;
  evmAddress?: string;
  solAddress?: string;
  totalValueUsd?: string;
  accounts?: Array<{
    accountId?: string;
    accountName?: string;
    evmAddress?: string;
    solAddress?: string;
    totalValueUsd?: string;
    isActive?: boolean;
  }>;
}

interface OnchainOsSignMessageResult {
  signature?: string;
  publicKey?: string;
}

const DEFAULT_ONCHAINOS_BIN = "onchainos";
const EIP712_DOMAIN_FIELDS = [
  { key: "name", type: "string" },
  { key: "version", type: "string" },
  { key: "chainId", type: "uint256" },
  { key: "verifyingContract", type: "address" },
  { key: "salt", type: "bytes32" }
] as const;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function splitCommand(raw: string): string[] {
  return raw.split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

function getOnchainOsCommand(config: Pick<ExecutorConfig, "onchainosBin">) {
  const raw = config.onchainosBin?.trim() || process.env.ONCHAINOS_BIN?.trim() || DEFAULT_ONCHAINOS_BIN;
  const tokens = splitCommand(raw);
  if (tokens.length === 0) {
    throw new Error("ONCHAINOS_BIN resolved to an empty command.");
  }
  return tokens;
}

export function resolveWalletProvider(config: Pick<ExecutorConfig, "walletProvider">) {
  return config.walletProvider === "onchainos" ? "onchainos" : "private-key";
}

export function resolvePrimaryType(types: TypedDataTypes): string {
  const candidates = Object.keys(types).filter((key) => key !== "EIP712Domain");
  if (candidates.length === 0) {
    throw new Error("Typed data does not declare a primary type.");
  }
  return candidates[0]!;
}

function buildOnchainOsTypedData(
  domain: TypedDataDomain,
  types: TypedDataTypes,
  value: TypedDataValue
) {
  const domainFields = EIP712_DOMAIN_FIELDS.filter(({ key }) => domain[key] != null)
    .map(({ key, type }) => ({ name: key, type }));

  return {
    types: domainFields.length > 0
      ? {
          EIP712Domain: domainFields,
          ...types
        }
      : types,
    primaryType: resolvePrimaryType(types),
    domain,
    message: value
  };
}

export function parseOnchainOsEnvelope<T>(stdout: string, stderr = ""): OnchainOsEnvelope<T> {
  const stdoutOnly = stdout.trim();
  if (stdoutOnly) {
    try {
      return JSON.parse(stdoutOnly) as OnchainOsEnvelope<T>;
    } catch {
      // Fall through to the line-oriented parser for CLI output with text prefixes.
    }
  }

  const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
  if (!combined) {
    throw new Error("onchainos returned empty output.");
  }

  const lines = combined.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    if (!line.startsWith("{") && !line.startsWith("[")) {
      continue;
    }
    try {
      return JSON.parse(line) as OnchainOsEnvelope<T>;
    } catch {
      continue;
    }
  }

  return JSON.parse(combined) as OnchainOsEnvelope<T>;
}

export function pickActiveEvmAddress(
  overview: OnchainOsWalletBalanceOverview,
  status: OnchainOsWalletStatus
) {
  const accounts = overview.accounts ?? [];
  const active = accounts.find((account) => account.isActive === true)
    ?? accounts.find((account) => account.accountId === status.currentAccountId);

  if (active?.evmAddress?.trim()) {
    return active.evmAddress.trim();
  }

  if (overview.evmAddress?.trim()) {
    return overview.evmAddress.trim();
  }

  const fallback = accounts.find((account) => account.evmAddress?.trim());
  return fallback?.evmAddress?.trim() ?? null;
}

async function runOnchainOsJson<T>(
  config: Pick<ExecutorConfig, "onchainosBin">,
  args: string[]
): Promise<OnchainOsEnvelope<T>> {
  const resolvedCommand = getOnchainOsCommand(config);
  const command = resolvedCommand[0]!;
  const commandArgs = resolvedCommand.slice(1);

  return await new Promise<OnchainOsEnvelope<T>>((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(command, [...commandArgs, ...args], {
      env: process.env,
      stdio: "pipe"
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error: Error) => {
      reject(error);
    });
    child.stdin.end();
    child.on("close", (code: number | null) => {
      let envelope: OnchainOsEnvelope<T>;
      try {
        envelope = parseOnchainOsEnvelope<T>(stdout, stderr);
      } catch (error) {
        reject(new Error(`onchainos returned non-JSON output: ${[stdout, stderr].filter(Boolean).join("\n").trim() || getErrorMessage(error)}`));
        return;
      }

      if (code === 0 || code === 2 || envelope.ok === false || envelope.confirming === true) {
        resolve(envelope);
        return;
      }

      reject(new Error(envelope.error ?? stderr.trim() ?? `onchainos exited with code ${code}`));
    });
  });
}

function ensureSuccessfulEnvelope<T>(envelope: OnchainOsEnvelope<T>, context: string): T {
  if (envelope.confirming) {
    throw new Error(
      envelope.message
        ? `${context} requires user confirmation: ${envelope.message}${envelope.next ? ` Next: ${envelope.next}` : ""}`
        : `${context} requires user confirmation in onchainos.`
    );
  }
  if (envelope.ok !== true) {
    throw new Error(envelope.error ?? `${context} failed in onchainos.`);
  }
  if (envelope.data == null) {
    throw new Error(`${context} succeeded but returned no data.`);
  }
  return envelope.data;
}

async function getOkxWalletStatus(config: Pick<ExecutorConfig, "onchainosBin">) {
  const envelope = await runOnchainOsJson<OnchainOsWalletStatus>(config, ["wallet", "status"]);
  return ensureSuccessfulEnvelope(envelope, "wallet status");
}

async function getOkxWalletOverview(config: Pick<ExecutorConfig, "onchainosBin">) {
  const envelope = await runOnchainOsJson<OnchainOsWalletBalanceOverview>(config, ["wallet", "balance"]);
  return ensureSuccessfulEnvelope(envelope, "wallet balance");
}

export async function resolveOnchainOsActiveAddress(config: Pick<ExecutorConfig, "onchainosBin">) {
  const status = await getOkxWalletStatus(config);
  if (status.loggedIn !== true) {
    throw new Error("OnchainOS wallet session is not logged in. Run `onchainos wallet login <email>` and `onchainos wallet verify <otp>` first.");
  }

  const overview = await getOkxWalletOverview(config);
  const address = pickActiveEvmAddress(overview, status);
  if (!address) {
    throw new Error("OnchainOS wallet is logged in, but no active EVM address was found. Run `onchainos wallet balance` and confirm the active account.");
  }
  return address;
}

export async function resolveOkxAgenticAddress(config: Pick<ExecutorConfig, "onchainosBin">) {
  return await resolveOnchainOsActiveAddress(config);
}

export class OkxAgenticSigner {
  private addressPromise: Promise<string> | null = null;

  constructor(private readonly config: Pick<ExecutorConfig, "chainId" | "onchainosBin">) {}

  async getAddress() {
    if (!this.addressPromise) {
      this.addressPromise = resolveOnchainOsActiveAddress(this.config);
    }
    return await this.addressPromise;
  }

  async _signTypedData(domain: TypedDataDomain, types: TypedDataTypes, value: TypedDataValue) {
    const address = await this.getAddress();
    const message = JSON.stringify(buildOnchainOsTypedData(domain, types, value));

    const envelope = await runOnchainOsJson<OnchainOsSignMessageResult>(this.config, [
      "wallet",
      "sign-message",
      "--type",
      "eip712",
      "--message",
      message,
      "--chain",
      String(this.config.chainId),
      "--from",
      address
    ]);
    const data = ensureSuccessfulEnvelope(envelope, "wallet sign-message");
    if (!data.signature?.trim()) {
      throw new Error("wallet sign-message succeeded but did not return a signature.");
    }
    return data.signature.trim();
  }
}

export const OnchainOsSigner = OkxAgenticSigner;
export const resolveOnchainOsAddress = resolveOnchainOsActiveAddress;
