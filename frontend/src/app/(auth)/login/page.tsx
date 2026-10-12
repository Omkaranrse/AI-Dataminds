import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" description="Your data has been waiting for you.">
      <Suspense fallback={<div className="py-8 text-center text-sm text-white/50">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

