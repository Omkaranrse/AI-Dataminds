"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
export function VerifyEmail(){const token=useSearchParams().get("token");const[state,setState]=useState("Verifying your email…");useEffect(()=>{if(!token){setState("This verification link is invalid.");return}api("/auth/verify-email",{method:"POST",body:JSON.stringify({token})}).then(()=>setState("Email verified. You’re ready to go.")).catch(e=>setState(e instanceof Error?e.message:"Verification failed"))},[token]);return <div className="text-center"><p role="status" className="text-sm text-white/70">{state}</p><Link href="/login" className="mt-5 inline-block text-sm text-cyan underline">Continue to sign in</Link></div>}

