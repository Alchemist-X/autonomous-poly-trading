// Operator CLI for the invite-code store.
//
// Usage (on the VM: prefix with `sudo docker exec raven-forecast-api-1`):
//   pnpm --filter @autopoly/forecast-api invite list
//   pnpm --filter @autopoly/forecast-api invite create -- --label "for-alice" --max-uses 10 --expires 2026-08-01
//   pnpm --filter @autopoly/forecast-api invite revoke -- <code>

import { createInvite, inviteState, inviteTable, revokeInvite } from "./invites";

function readFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function usage(): never {
  process.stderr.write(
    "usage: invite <list | create [--code X] [--label L] [--max-uses N] [--expires YYYY-MM-DD] | revoke <code>>\n"
  );
  process.exit(1);
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "list") {
    const rows = [...inviteTable().values()];
    if (!rows.length) {
      process.stdout.write("(no invite codes yet)\n");
      return;
    }
    for (const r of rows) {
      const state = inviteState(r.code);
      const uses = r.maxUses === null ? `${r.uses}/∞` : `${r.uses}/${r.maxUses}`;
      const bits = [
        r.code.padEnd(18),
        state.padEnd(9),
        `uses ${uses}`.padEnd(12),
        r.expiresAt ? `expires ${r.expiresAt}` : "no expiry",
        r.label ? `· ${r.label}` : "",
        r.lastUsedAtUtc ? `· last ${r.lastUsedAtUtc}` : ""
      ];
      process.stdout.write(bits.filter(Boolean).join(" ") + "\n");
    }
    return;
  }
  if (cmd === "create") {
    const maxUsesRaw = readFlag(rest, "--max-uses");
    const record = createInvite({
      code: readFlag(rest, "--code"),
      label: readFlag(rest, "--label"),
      maxUses: maxUsesRaw ? Number(maxUsesRaw) : null,
      expiresAt: readFlag(rest, "--expires") ?? null
    });
    process.stdout.write(`created ${record.code} (label: ${record.label || "-"}, max-uses: ${record.maxUses ?? "∞"}, expires: ${record.expiresAt ?? "never"})\n`);
    return;
  }
  if (cmd === "revoke") {
    const code = rest.find((a) => !a.startsWith("--"));
    if (!code) usage();
    process.stdout.write(revokeInvite(code) ? `revoked ${code}\n` : `no such code: ${code}\n`);
    return;
  }
  usage();
}

main();
