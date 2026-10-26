"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { forgotSchema } from "@/lib/schemas";

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
  });

  const submit = handleSubmit(async (data) => {
    try {
      setError("");
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  });

  if (done) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-cyan/20 bg-cyan/10 p-6 text-center text-sm text-cyan"
      >
        <p className="font-medium">
          If that address is registered, a password reset link has been sent to your inbox.
        </p>
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-block rounded-xl bg-cyan px-4 py-2 font-medium text-ink transition hover:bg-cyan/90"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        Email address
        <Input
          className="mt-2"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register("email")}
        />
      </label>

      {errors.email && (
        <p className="text-xs text-red-300">{errors.email.message}</p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/20 bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <Button className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending reset link…" : "Send reset link"}
      </Button>

      <p className="text-center text-xs text-white/50">
        Remember your password?{" "}
        <Link href="/login" className="text-cyan hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
