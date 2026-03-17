import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT_DIR = ".env.wallets";
const DEFAULT_PREFIX = "poly";
const DEFAULT_POLYMARKET_HOST = "https://clob.polymarket.com";
const DEFAULT_CHAIN_ID = 137;
const DEFAULT_SIGNATURE_TYPE = 0;
const PRIVATE_KEY_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export interface WalletEnvSpec {
  label: string;
  privateKey: string;
  signerAddress: string | null;
  funderAddress: string;
  signatureType: number;
  chainId: number;
  polymarketHost: string;
}

export interface GenerateWalletEnvOptions {
  inputPath: string;
  outputDir: string;
  prefix?: string;
  overwrite?: boolean;
  generatedAt?: string;
}

export interface GeneratedWalletEnvRecord {
  label: string;
  signerAddress: string | null;
  funderAddress: string;
  envFile: string;
}

export interface GenerateWalletEnvResult {
  inputPath: string;
  outputDir: string;
  manifestPath: string;
  wallets: GeneratedWalletEnvRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function ensurePrivateKey(value: string, index: number): string {
  if (!PRIVATE_KEY_PATTERN.test(value)) {
    throw new Error(`wallet ${index + 1}: PRIVATE_KEY must be a 32-byte hex string.`);
  }
  return value;
}

function ensureAddress(value: string, index: number): string {
  if (!ADDRESS_PATTERN.test(value)) {
    throw new Error(`wallet ${index + 1}: FUNDER_ADDRESS must be a 20-byte hex address.`);
  }
  return value;
}

function ensureUniqueLabels(wallets: WalletEnvSpec[]) {
  const seen = new Set<string>();
  for (const wallet of wallets) {
    if (seen.has(wallet.label)) {
      throw new Error(`duplicate wallet label: ${wallet.label}`);
    }
    seen.add(wallet.label);
  }
}

export function normalizeWalletPayload(payload: unknown, prefix = DEFAULT_PREFIX): WalletEnvSpec[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.wallets)
      ? payload.wallets
      : null;

  if (!rows) {
    throw new Error("input JSON must be an array or an object with a wallets array.");
  }

  const wallets = rows.map((row, index) => {
    if (!isRecord(row)) {
      throw new Error(`wallet ${index + 1}: expected an object.`);
    }

    const label = readString(row, ["label", "name", "id"]) ?? `${prefix}-${String(index + 1).padStart(2, "0")}`;
    const privateKey = ensurePrivateKey(
      readString(row, ["privateKey", "private_key", "PRIVATE_KEY"]) ?? "",
      index
    );
    const signerAddressRaw = readString(row, ["signerAddress", "signer_address", "SIGNER_ADDRESS"]);
    const signerAddress = signerAddressRaw ? ensureAddress(signerAddressRaw, index) : null;
    const funderAddress = ensureAddress(
      readString(row, ["funderAddress", "funder_address", "address", "FUNDER_ADDRESS", "EVM_ADDRESS"]) ?? "",
      index
    );
    const signatureType = readNumber(row, ["signatureType", "signature_type", "SIGNATURE_TYPE"]) ?? DEFAULT_SIGNATURE_TYPE;
    const chainId = readNumber(row, ["chainId", "chain_id", "CHAIN_ID"]) ?? DEFAULT_CHAIN_ID;
    const polymarketHost = readString(row, ["polymarketHost", "polymarket_host", "POLYMARKET_HOST"]) ?? DEFAULT_POLYMARKET_HOST;

    return {
      label,
      privateKey,
      signerAddress,
      funderAddress,
      signatureType,
      chainId,
      polymarketHost
    } satisfies WalletEnvSpec;
  });

  ensureUniqueLabels(wallets);
  return wallets;
}

function buildWalletEnvContent(input: {
  wallet: WalletEnvSpec;
  inputPath: string;
  generatedAt: string;
  envFile: string;
}): string {
  return [
    `# Generated from ${input.inputPath} at ${input.generatedAt}`,
    "# Keep shared non-secret settings in the root .env file.",
    "# SIGNER_ADDRESS is the EOA derived from PRIVATE_KEY.",
    "# FUNDER_ADDRESS is the Polymarket trading address used for collateral and positions.",
    `# Run with: ENV_FILE=${input.envFile} pnpm live:test`,
    `PRIVATE_KEY=${input.wallet.privateKey}`,
    ...(input.wallet.signerAddress ? [`SIGNER_ADDRESS=${input.wallet.signerAddress}`] : []),
    `FUNDER_ADDRESS=${input.wallet.funderAddress}`,
    `SIGNATURE_TYPE=${input.wallet.signatureType}`,
    `CHAIN_ID=${input.wallet.chainId}`,
    `POLYMARKET_HOST=${input.wallet.polymarketHost}`,
    ""
  ].join("\n");
}

async function ensureWritableTarget(filePath: string, overwrite: boolean) {
  if (overwrite) {
    return;
  }
  try {
    await access(filePath);
    throw new Error(`refusing to overwrite existing file: ${filePath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

export async function generateWalletEnvFiles(options: GenerateWalletEnvOptions): Promise<GenerateWalletEnvResult> {
  const inputPath = path.resolve(process.cwd(), options.inputPath);
  const outputDir = path.resolve(process.cwd(), options.outputDir);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const raw = await readFile(inputPath, "utf8");
  const wallets = normalizeWalletPayload(JSON.parse(raw), options.prefix ?? DEFAULT_PREFIX);

  await mkdir(outputDir, { recursive: true });

  const records: GeneratedWalletEnvRecord[] = [];
  for (const wallet of wallets) {
    const envFile = path.join(outputDir, `${wallet.label}.env`);
    await ensureWritableTarget(envFile, Boolean(options.overwrite));
    await writeFile(
      envFile,
      buildWalletEnvContent({
        wallet,
        inputPath,
        generatedAt,
        envFile: path.relative(process.cwd(), envFile)
      }),
      "utf8"
    );
    records.push({
      label: wallet.label,
      signerAddress: wallet.signerAddress,
      funderAddress: wallet.funderAddress,
      envFile
    });
  }

  const manifestPath = path.join(outputDir, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedAt,
        inputPath,
        count: records.length,
        wallets: records
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  return {
    inputPath,
    outputDir,
    manifestPath,
    wallets: records
  };
}

export interface CliArgs {
  inputPath: string;
  outputDir: string;
  prefix: string;
  overwrite: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    inputPath: "",
    outputDir: DEFAULT_OUTPUT_DIR,
    prefix: DEFAULT_PREFIX,
    overwrite: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--input":
      case "-i":
        args.inputPath = argv[index + 1] ?? "";
        index += 1;
        break;
      case "--output-dir":
      case "--output":
      case "-o":
        args.outputDir = argv[index + 1] ?? "";
        index += 1;
        break;
      case "--prefix":
      case "-p":
        args.prefix = argv[index + 1] ?? "";
        index += 1;
        break;
      case "--overwrite":
        args.overwrite = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (!args.help && !args.inputPath) {
    throw new Error("missing required --input argument");
  }

  if (!args.help && !args.outputDir) {
    throw new Error("missing required --output-dir argument");
  }

  if (!args.help && !args.prefix) {
    throw new Error("missing required --prefix argument");
  }

  return args;
}

export function renderHelp(): string {
  return [
    "Generate one Polymarket wallet env file per wallet entry.",
    "",
    "Usage:",
    "  pnpm tsx scripts/generate-wallet-envs.ts --input runtime-artifacts/local/polymarket-wallets.json",
    "",
    "Options:",
    "  -i, --input <path>       Wallet JSON file.",
    "  -o, --output-dir <path>  Output directory. Default: .env.wallets",
    "  -p, --prefix <value>     Auto-label prefix. Default: poly",
    "      --overwrite          Overwrite existing env files.",
    "  -h, --help               Show this message.",
    "",
    "Accepted input formats:",
    '  { "wallets": [{ "label": "poly-01", "privateKey": "0x...", "signerAddress": "0x...", "funderAddress": "0x..." }] }',
    '  [{ "PRIVATE_KEY": "0x...", "FUNDER_ADDRESS": "0x..." }]',
    ""
  ].join("\n");
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(renderHelp());
    return;
  }

  const result = await generateWalletEnvFiles({
    inputPath: args.inputPath,
    outputDir: args.outputDir,
    prefix: args.prefix,
    overwrite: args.overwrite
  });

  console.log(`Generated ${result.wallets.length} wallet env files in ${path.relative(process.cwd(), result.outputDir) || "."}.`);
  console.log(`Manifest: ${path.relative(process.cwd(), result.manifestPath)}`);
  for (const wallet of result.wallets) {
    console.log(`- ${wallet.label}: ${wallet.funderAddress} -> ${path.relative(process.cwd(), wallet.envFile)}`);
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runCli().catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
}
