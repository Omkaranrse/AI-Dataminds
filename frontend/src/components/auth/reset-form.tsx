"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { resetSchema } from "@/lib/schemas";
export function ResetForm(){const token=useSearchParams().get("token");const[done,setDone]=useState(false);const[error,setError]=useState("");const{register,handleSubmit,formState:{errors,isSubmitting}}=useForm<z.infer<typeof resetSchema>>({resolver:zodResolver(resetSchema)});const submit=handleSubmit(async data=>{if(!token)return setError("This reset link is invalid");try{await api("/auth/reset-password",{method:"POST",body:JSON.stringify({token,...data})});setDone(true)}catch(e){setError(e instanceof Error?e.message:"Reset failed")}});if(done)return <p className="text-center text-sm text-cyan">Password updated. <Link className="text-white underline" href="/login">Sign in</Link></p>;return <form onSubmit={submit} className="space-y-4"><label className="block text-sm">New password<Input type="password" autoComplete="new-password" className="mt-2" {...register("password")}/></label>{errors.password&&<p className="text-xs text-red-300">{errors.password.message}</p>}{error&&<p role="alert" className="text-sm text-red-300">{error}</p>}<Button className="w-full" disabled={isSubmitting||!token}>Set new password</Button></form>}

