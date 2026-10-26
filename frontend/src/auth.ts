import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { loginSchema } from "@/lib/schemas";
import { serverApi } from "@/lib/api";

type TokenPayload = {
  access_token: string; refresh_token: string; expires_in: number;
  user: { id: string; name: string; email: string; image_url?: string; role: "admin" | "user"; email_verified: boolean };
};

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch(`${serverApi}/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refreshToken }), cache: "no-store",
    });
    if (!response.ok) throw new Error("Refresh failed");
    const data = await response.json() as TokenPayload;
    return { ...token, accessToken: data.access_token, refreshToken: data.refresh_token,
      accessTokenExpires: Date.now() + data.expires_in * 1000, error: undefined } as JWT;
  } catch { return { ...token, error: "RefreshTokenError" as const } as JWT; }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({ credentials: { email: {}, password: {} }, async authorize(raw) {
      const parsed = loginSchema.safeParse(raw); if (!parsed.success) return null;
      const response = await fetch(`${serverApi}/auth/login`, { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json() as TokenPayload;
      return { id: data.user.id, name: data.user.name, email: data.user.email, image: data.user.image_url,
        role: data.user.role, appEmailVerified: data.user.email_verified,
        accessToken: data.access_token, refreshToken: data.refresh_token, accessTokenExpires: Date.now() + data.expires_in * 1000 };
    }}),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "",
    }),
    GitHub({
      clientId: process.env.GITHUB_ID || process.env.AUTH_GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || process.env.AUTH_GITHUB_SECRET || "",
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user && account?.type === "credentials") {
        token.sub = user.id;
        token.role = user.role;
        token.emailVerified = user.appEmailVerified;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires;
        return token;
      }
      if (user && account && account.type === "oauth") {
        const email =
          user.email ||
          `${account.provider}-${account.providerAccountId}@users.noreply.${account.provider}.com`;
        const name =
          user.name?.trim() ||
          user.email?.split("@")[0] ||
          `${account.provider.charAt(0).toUpperCase() + account.provider.slice(1)} User`;
        const imageUrl =
          user.image && typeof user.image === "string" && user.image.startsWith("http")
            ? user.image
            : undefined;
        const emailVerified = Boolean(
          (profile as Record<string, unknown> | undefined)?.email_verified ??
          (profile as Record<string, unknown> | undefined)?.verified ??
          Boolean(user.email)
        );

        const response = await fetch(`${serverApi}/auth/oauth/exchange`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Auth": process.env.INTERNAL_AUTH_SECRET!,
          },
          body: JSON.stringify({
            provider: account.provider,
            provider_account_id: String(account.providerAccountId),
            email,
            name,
            image_url: imageUrl,
            email_verified: emailVerified,
          }),
          cache: "no-store",
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          console.error("OAuth exchange failed:", response.status, errText);
          throw new Error("OAuth exchange failed");
        }
        const data = (await response.json()) as TokenPayload;
        return {
          ...token,
          sub: data.user.id,
          role: data.user.role,
          emailVerified: data.user.email_verified,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          accessTokenExpires: Date.now() + data.expires_in * 1000,
          error: undefined,
        };
      }
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 30_000) return token;
      if (token.refreshToken) return refreshAccessToken(token);
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!; session.user.role = token.role ?? "user";
      session.user.isEmailVerified = token.emailVerified ?? false;
      session.accessToken = token.accessToken; session.error = token.error;
      return session;
    },
    authorized({ auth, request }) {
      const protectedPath = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/admin");
      const adminPath = request.nextUrl.pathname.startsWith("/admin");
      if (adminPath) return auth?.user.role === "admin";
      if (protectedPath) return Boolean(auth?.user);
      return true;
    },
  },
  events: {
    async signOut(message) {
      if (!("token" in message) || !message.token?.refreshToken) return;
      await fetch(`${serverApi}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: message.token.refreshToken }),
        cache: "no-store",
      }).catch(() => undefined);
    },
  },
});
