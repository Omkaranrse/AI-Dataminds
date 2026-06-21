import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmail } from "@/components/auth/verify-email";
export default function VerifyPage(){return <AuthShell title="Email verification" description="One last security check."><Suspense fallback={<p className="text-center text-sm">Loading…</p>}><VerifyEmail/></Suspense></AuthShell>}

