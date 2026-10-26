"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { registerSchema } from "@/lib/schemas";
import { OAuthButtons } from "./oauth-buttons";

export function RegisterForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
  });

  const submit = handleSubmit(async (data) => {
    try {
      setError("");
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setMessage("Account created. Check your inbox to verify your email.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
    }
  });

  if (message) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-cyan/20 bg-cyan/10 p-6 text-center text-sm text-cyan"
      >
        <p className="font-medium">{message}</p>
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-block rounded-xl bg-cyan px-4 py-2 font-medium text-ink transition hover:bg-cyan/90"
          >
            Continue to sign in
          </Link>
        </div>
      </div>
    );
  }

  const firstError = Object.values(errors)[0]?.message;

  return (
    <>
      <OAuthButtons />

      <div className="my-6 flex items-center gap-3 text-xs text-white/35">
        <span className="h-px flex-1 bg-white/10" />
        OR USE EMAIL
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          Full name
          <Input
            autoComplete="name"
            placeholder="Ada Lovelace"
            className="mt-2"
            {...register("name")}
          />
        </label>

        <label className="block text-sm">
          Email
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-2"
            {...register("email")}
          />
        </label>

        <label className="block text-sm">
          Password
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="At least 12 characters"
            className="mt-2"
            {...register("password")}
          />
        </label>

        {firstError && (
          <p className="text-xs text-red-300">{firstError}</p>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-500/20 bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <Button disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-white/40">
        By continuing, you agree to our Terms and Privacy Policy.
      </p>
    </>
  );
}
