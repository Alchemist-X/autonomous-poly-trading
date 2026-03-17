import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateWalletEnvFiles, normalizeWalletPayload } from "./generate-wallet-envs.ts";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "autopoly-wallet-envs-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("normalizeWalletPayload", () => {
  it("auto-labels wallets and accepts env-style aliases", () => {
    const wallets = normalizeWalletPayload([
      {
        PRIVATE_KEY: `0x${"1".repeat(64)}`,
        FUNDER_ADDRESS: `0x${"a".repeat(40)}`
      }
    ]);

    expect(wallets).toEqual([
      {
        label: "poly-01",
        privateKey: `0x${"1".repeat(64)}`,
        signerAddress: null,
        funderAddress: `0x${"a".repeat(40)}`,
        signatureType: 0,
        chainId: 137,
        polymarketHost: "https://clob.polymarket.com"
      }
    ]);
  });
});

describe("generateWalletEnvFiles", () => {
  it("writes one env file per wallet and emits a manifest", async () => {
    const tempDir = await makeTempDir();
    const inputPath = path.join(tempDir, "wallets.json");
    const outputDir = path.join(tempDir, ".env.wallets");

    await writeFile(
      inputPath,
      JSON.stringify(
        {
          wallets: [
            {
              label: "poly-01",
              privateKey: `0x${"1".repeat(64)}`,
              signerAddress: `0x${"c".repeat(40)}`,
              funderAddress: `0x${"a".repeat(40)}`
            },
            {
              label: "poly-02",
              privateKey: `0x${"2".repeat(64)}`,
              funderAddress: `0x${"b".repeat(40)}`,
              signatureType: 1
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await generateWalletEnvFiles({
      inputPath,
      outputDir,
      generatedAt: "2026-03-16T00:00:00.000Z"
    });

    expect(result.wallets).toHaveLength(2);

    const firstEnv = await readFile(path.join(outputDir, "poly-01.env"), "utf8");
    expect(firstEnv).toContain("PRIVATE_KEY=0x1111111111111111111111111111111111111111111111111111111111111111");
    expect(firstEnv).toContain("SIGNER_ADDRESS=0xcccccccccccccccccccccccccccccccccccccccc");
    expect(firstEnv).toContain("FUNDER_ADDRESS=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(firstEnv).toContain("SIGNATURE_TYPE=0");

    const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.json"), "utf8")) as {
      count: number;
      wallets: Array<{ label: string; envFile: string; signerAddress: string | null }>;
    };
    expect(manifest.count).toBe(2);
    expect(manifest.wallets.map((wallet) => wallet.label)).toEqual(["poly-01", "poly-02"]);
    expect(manifest.wallets[0]?.signerAddress).toBe(`0x${"c".repeat(40)}`);
  });

  it("refuses to overwrite existing env files by default", async () => {
    const tempDir = await makeTempDir();
    const inputPath = path.join(tempDir, "wallets.json");
    const outputDir = path.join(tempDir, ".env.wallets");

    await writeFile(
      inputPath,
      JSON.stringify(
        [
          {
            label: "poly-01",
            privateKey: `0x${"1".repeat(64)}`,
            funderAddress: `0x${"a".repeat(40)}`
          }
        ],
        null,
        2
      ),
      "utf8"
    );

    await generateWalletEnvFiles({ inputPath, outputDir });

    await expect(generateWalletEnvFiles({ inputPath, outputDir })).rejects.toThrow(
      `refusing to overwrite existing file: ${path.join(outputDir, "poly-01.env")}`
    );
  });
});
