"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { registerSchema } from "@/lib/schemas";
import { OAuthButtons } from "./oauth-buttons";

export function RegisterForm() {
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });
  const submit = handleSubmit(async data => { try { setError(""); await api("/auth/register", { method: "POST", body: JSON.stringify(data) }); setMessage("Account created. Check your inbox to verify your email."); } catch (e) { setError(e instanceof Error ? e.message : "Could not create account"); } });
  if (message) return <div role="status" className="rounded-2xl bg-cyan/10 p-5 text-center text-sm text-cyan">{message}<div><Link href="/login" className="mt-4 inline-block text-white underline">Continue to sign in</Link></div></div>;
  return <><OAuthButtons /><div className="my-6 flex items-center gap-3 text-xs text-white/35"><span className="h-px flex-1 bg-white/10" />OR USE EMAIL<span className="h-px flex-1 bg-white/10" /></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm">Full name<Input autoComplete="name" className="mt-2" {...register("name")} /></label><label className="block text-sm">Email<Input type="email" autoComplete="email" className="mt-2" {...register("email")} /></label><label className="block text-sm">Password<Input type="password" autoComplete="new-password" className="mt-2" {...register("password")} /></label>{Object.values(errors)[0] && <p className="text-xs text-red-300">{Object.values(errors)[0]?.message}</p>}{error && <p role="alert" className="rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<Button disabled={isSubmitting} className="w-full">{isSubmitting ? "Creating account…" : "Create account"}</Button></form><p className="mt-6 text-center text-xs text-white/40">By continuing, you agree to our Terms and Privacy Policy.</p></>;
}
