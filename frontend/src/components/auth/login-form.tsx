"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/schemas";
import { OAuthButtons } from "./oauth-buttons";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "OAuth is not fully configured. Please set Client ID and Secret in your environment.",
  OAuthSignin: "Could not start OAuth flow. Please check OAuth credentials.",
  OAuthCallback: "Could not complete OAuth sign in. Please verify your provider account.",
  AccessDenied: "Access was denied by the authentication provider.",
  OAuthAccountNotLinked: "This email is already associated with an account. Sign in using your original method.",
  CredentialsSignin: "Email or password is incorrect.",
  SessionRequired: "Please sign in to access this page.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(ERROR_MESSAGES[errorParam] || "An unexpected authentication error occurred.");
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const submit = handleSubmit(async (data) => {
    setError("");
    const result = await signIn("credentials", { ...data, redirect: false });
    if (result?.error) {
      setError("Email or password is incorrect");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  });

  return (
    <>
      <OAuthButtons />

      <div className="my-6 flex items-center gap-3 text-xs text-white/35">
        <span className="h-px flex-1 bg-white/10" />
        OR CONTINUE WITH EMAIL
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={submit} className="space-y-4">
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
        {errors.email && <p className="text-xs text-red-300">{errors.email.message}</p>}

        <label className="block text-sm">
          <span className="flex justify-between">
            Password
            <Link href="/forgot-password" className="text-cyan hover:underline">
              Forgot password?
            </Link>
          </span>
          <Input
            type="password"
            autoComplete="current-password"
            className="mt-2"
            {...register("password")}
          />
        </label>
        {errors.password && <p className="text-xs text-red-300">{errors.password.message}</p>}

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/20 bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <Button disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-white/55">
        New to DataMind?{" "}
        <Link href="/register" className="text-white hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

