import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Start making sense of data"
      description="Create your secure DataMind workspace."
    >
      <Suspense fallback={<div className="py-8 text-center text-sm text-white/50">Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}

