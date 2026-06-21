import "next-auth";
import "next-auth/jwt";
declare module "next-auth" {
  interface User {
    role?: "admin" | "user";
    appEmailVerified?: boolean;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
    user: { id: string; role: "admin" | "user"; isEmailVerified: boolean; name?: string | null; email?: string | null; image?: string | null };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string; refreshToken?: string; accessTokenExpires?: number;
    role?: "admin" | "user"; emailVerified?: boolean; error?: "RefreshTokenError";
  }
}
