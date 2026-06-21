import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/reset-form";
export default function ResetPage(){return <AuthShell title="Choose a new password" description="Make it long, memorable, and unique."><Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-white/5"/>}><ResetForm/></Suspense></AuthShell>}

