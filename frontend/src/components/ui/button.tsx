import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("focus-ring inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
}

