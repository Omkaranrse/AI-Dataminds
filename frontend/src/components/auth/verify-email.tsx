"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export function VerifyEmail() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState("Verifying your email address…");
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setState("This verification link is invalid or missing a token.");
      setIsSuccess(false);
      return;
    }

    api("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => {
        setState("Your email has been verified successfully. You’re ready to go.");
        setIsSuccess(true);
      })
      .catch((e) => {
        setState(e instanceof Error ? e.message : "Verification failed or token expired.");
        setIsSuccess(false);
      });
  }, [token]);

  return (
    <div className="text-center">
      <div
        role="status"
        className={`rounded-2xl border p-6 text-sm ${
          isSuccess === true
            ? "border-cyan/20 bg-cyan/10 text-cyan"
            : isSuccess === false
            ? "border-red-500/20 bg-red-400/10 text-red-200"
            : "border-white/10 bg-white/5 text-white/70"
        }`}
      >
        <p className="font-medium">{state}</p>
      </div>

      <div className="mt-6">
        <Link
          href="/login"
          className="inline-block rounded-xl bg-cyan px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-cyan/90"
        >
          Continue to sign in
        </Link>
      </div>
    </div>
  );
}
