import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./schemas";
describe("authentication schemas", () => {
  it("accepts a strong registration", () => expect(registerSchema.safeParse({ name: "Ada Lovelace", email: "ada@example.com", password: "Analytical123!" }).success).toBe(true));
  it("rejects weak passwords", () => expect(registerSchema.safeParse({ name: "Ada Lovelace", email: "ada@example.com", password: "password" }).success).toBe(false));
  it("rejects invalid login email", () => expect(loginSchema.safeParse({ email: "wrong", password: "anything" }).success).toBe(false));
});

