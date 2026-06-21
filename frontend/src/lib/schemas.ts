import { z } from "zod";

export const password = z.string().min(12, "Use at least 12 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().email(), password,
});
export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ password });

