"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { forgotSchema } from "@/lib/schemas";
export function ForgotForm() { const [done,setDone]=useState(false); const [error,setError]=useState(""); const {register,handleSubmit,formState:{isSubmitting}}=useForm<z.infer<typeof forgotSchema>>({resolver:zodResolver(forgotSchema)}); const submit=handleSubmit(async data=>{try{await api("/auth/forgot-password",{method:"POST",body:JSON.stringify(data)});setDone(true)}catch(e){setError(e instanceof Error?e.message:"Request failed")}}); if(done)return <p role="status" className="rounded-xl bg-cyan/10 p-4 text-sm text-cyan">If that address is registered, a reset link is on its way.</p>; return <form onSubmit={submit} className="space-y-4"><label className="block text-sm">Email address<Input className="mt-2" type="email" autoComplete="email" {...register("email")} /></label>{error&&<p role="alert" className="text-sm text-red-300">{error}</p>}<Button className="w-full" disabled={isSubmitting}>{isSubmitting?"Sending…":"Send reset link"}</Button></form>; }

