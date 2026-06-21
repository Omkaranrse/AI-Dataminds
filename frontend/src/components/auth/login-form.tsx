"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/schemas";
import { OAuthButtons } from "./oauth-buttons";

export function LoginForm() {
  const router = useRouter(); const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const submit = handleSubmit(async data => { setError(""); const result = await signIn("credentials", { ...data, redirect: false }); if (result?.error) setError("Email or password is incorrect"); else router.push("/dashboard"); });
  return <><OAuthButtons /><div className="my-6 flex items-center gap-3 text-xs text-white/35"><span className="h-px flex-1 bg-white/10" />OR CONTINUE WITH EMAIL<span className="h-px flex-1 bg-white/10" /></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm">Email<Input type="email" autoComplete="email" className="mt-2" {...register("email")} /></label>{errors.email && <p className="text-xs text-red-300">{errors.email.message}</p>}<label className="block text-sm"><span className="flex justify-between">Password<Link href="/forgot-password" className="text-cyan hover:underline">Forgot password?</Link></span><Input type="password" autoComplete="current-password" className="mt-2" {...register("password")} /></label>{error && <p role="alert" className="rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<Button disabled={isSubmitting} className="w-full">{isSubmitting ? "Signing in…" : "Sign in"}</Button></form><p className="mt-6 text-center text-sm text-white/55">New to DataMind? <Link href="/register" className="text-white hover:underline">Create an account</Link></p></>;
}

