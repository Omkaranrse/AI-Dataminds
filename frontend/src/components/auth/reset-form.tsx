"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { resetSchema } from "@/lib/schemas";

export function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
  });

  const submit = handleSubmit(async (data) => {
    if (!token) {
      setError("This reset link is invalid or expired.");
      return;
    }

    try {
      setError("");
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, ...data }),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  });

  if (done) {
    return (
      <div className="rounded-2xl border border-cyan/20 bg-cyan/10 p-6 text-center text-sm text-cyan">
        <p className="font-medium">Your password has been updated.</p>
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

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        New password
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="At least 12 characters"
          className="mt-2"
          {...register("password")}
        />
      </label>

      {errors.password && (
        <p className="text-xs text-red-300">{errors.password.message}</p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/20 bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <Button className="w-full" disabled={isSubmitting || !token}>
        {isSubmitting ? "Setting password…" : "Set new password"}
      </Button>
    </form>
  );
}
