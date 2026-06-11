import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb, inviteCodes } from "@autopoly/db";

interface InviteArgs {
  code?: string;
  label?: string;
  maxUses: number;
  domain?: string;
  expiresAt?: Date;
}

function readArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return args[index + 1];
}

function parseArgs(args: string[]): InviteArgs {
  const maxUsesRaw = readArgValue(args, "--max-uses");
  const expiresRaw = readArgValue(args, "--expires-at");
  return {
    code: readArgValue(args, "--code"),
    label: readArgValue(args, "--label"),
    maxUses: maxUsesRaw ? Math.max(1, Number(maxUsesRaw)) : 1,
    domain: readArgValue(args, "--domain")?.toLowerCase(),
    expiresAt: expiresRaw ? new Date(expiresRaw) : undefined
  };
}

function generateInviteCode(): string {
  return `rvn-${randomBytes(12).toString("base64url")}`;
}

function hashInviteCode(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const code = args.code?.trim() || generateInviteCode();
  if (!Number.isFinite(args.maxUses)) {
    throw new Error("--max-uses must be a number.");
  }
  if (args.expiresAt && Number.isNaN(args.expiresAt.getTime())) {
    throw new Error("--expires-at must be an ISO timestamp.");
  }

  await getDb().insert(inviteCodes).values({
    id: randomUUID(),
    codeHash: hashInviteCode(code),
    label: args.label ?? null,
    maxUses: args.maxUses,
    allowedEmailDomain: args.domain ?? null,
    expiresAt: args.expiresAt ?? null
  });

  console.log(JSON.stringify({
    ok: true,
    code,
    maxUses: args.maxUses,
    domain: args.domain ?? null,
    expiresAt: args.expiresAt?.toISOString() ?? null
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
