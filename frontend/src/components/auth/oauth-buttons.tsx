"use client";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
export function OAuthButtons() { return <div className="grid grid-cols-2 gap-3"><Button type="button" className="border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => signIn("google", { redirectTo: "/dashboard" })}>Google</Button><Button type="button" className="border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => signIn("github", { redirectTo: "/dashboard" })}>GitHub</Button></div>; }

