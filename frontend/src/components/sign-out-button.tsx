"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
export function SignOutButton(){return <button onClick={()=>signOut({redirectTo:"/"})} className="focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/55 hover:bg-white/5 hover:text-white"><LogOut className="size-4"/>Sign out</button>}

