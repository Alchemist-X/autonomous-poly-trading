import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function isOidcConfigured(): boolean {
  return Boolean(
    readOptionalEnv("OIDC_ISSUER")
      && readOptionalEnv("OIDC_CLIENT_ID")
      && readOptionalEnv("OIDC_CLIENT_SECRET")
  );
}

function buildOidcProviders(): Provider[] {
  const issuer = readOptionalEnv("OIDC_ISSUER");
  const clientId = readOptionalEnv("OIDC_CLIENT_ID");
  const clientSecret = readOptionalEnv("OIDC_CLIENT_SECRET");
  if (!issuer || !clientId || !clientSecret) {
    return [];
  }

  return [
    {
      id: "oidc",
      name: readOptionalEnv("OIDC_PROVIDER_NAME") ?? "OpenID",
      type: "oidc",
      issuer,
      clientId,
      clientSecret,
      authorization: {
        params: {
          scope: readOptionalEnv("OIDC_SCOPE") ?? "openid email profile"
        }
      }
    }
  ];
}

export const authConfig = {
  providers: buildOidcProviders(),
  pages: {
    signIn: "/sign-in"
  },
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
  session: {
    strategy: "jwt"
  },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account) {
        token.oidcIssuer = readOptionalEnv("OIDC_ISSUER") ?? account.provider;
        token.oidcSubject = account.providerAccountId ?? profile?.sub ?? token.sub;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.oidcSubject ?? token.sub ?? "");
        session.user.oidcIssuer = String(token.oidcIssuer ?? readOptionalEnv("OIDC_ISSUER") ?? "oidc");
      }
      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
