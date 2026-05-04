import { PrivyClient } from "@privy-io/server-auth";

let cached: PrivyClient | null = null;

export function getPrivyServer(): PrivyClient | null {
  const appId = process.env.PRIVY_APP_ID ?? process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    return null;
  }
  if (cached) return cached;
  cached = new PrivyClient(appId, appSecret);
  return cached;
}

export type PrivyVerified = {
  privyDid: string;
};

export async function verifyPrivyToken(authHeader: string | null): Promise<PrivyVerified | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return null;
  const token = match[1].trim();
  if (!token) return null;

  const client = getPrivyServer();
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      return { privyDid: `dev:${token.slice(0, 12)}` };
    }
    return null;
  }

  try {
    const claims = await client.verifyAuthToken(token);
    return { privyDid: claims.userId };
  } catch {
    return null;
  }
}
