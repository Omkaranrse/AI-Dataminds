"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bot, KeyRound, Mail, UserPlus, LogIn, AlertCircle } from "lucide-react";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";

  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If token exists, direct to dashboard
    if (localStorage.getItem("token")) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (activeTab === "login") {
        // OAuth2 Password form requires data format
        const params = new URLSearchParams();
        params.append("username", email);
        params.append("password", password);

        const response = await api.post("/auth/login", params, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        localStorage.setItem("token", response.data.access_token);
        router.push("/dashboard");
      } else {
        await api.post("/auth/register", {
          email,
          password,
          full_name: fullName,
        });

        // Auto login after registration
        const params = new URLSearchParams();
        params.append("username", email);
        params.append("password", password);
        const response = await api.post("/auth/login", params, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        localStorage.setItem("token", response.data.access_token);
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "An error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl relative overflow-hidden">
        {/* Decorative ambient light */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-accent-purple/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-accent-indigo/20 blur-3xl rounded-full" />

        {/* Logo and title */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 bg-accent-indigo/10 border border-accent-indigo/35 rounded-2xl flex items-center justify-center mb-4">
            <Bot className="h-6 w-6 text-accent-indigo" />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to Aether Data</h2>
          <p className="text-slate-400 text-sm mt-1 text-center">
            {activeTab === "login"
              ? "Access your analytical workspaces"
              : "Create an account to start analyzing data"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 mb-6">
          <button
            onClick={() => {
              setActiveTab("login");
              setError(null);
            }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "login"
                ? "border-accent-indigo text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setActiveTab("register");
              setError(null);
            }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === "register"
                ? "border-accent-indigo text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center space-x-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === "register" && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserPlus className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent-indigo transition text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent-indigo transition text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent-indigo transition text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 disabled:opacity-50 transition rounded-xl text-white font-semibold text-sm shadow-lg shadow-indigo-900/30 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Processing...</span>
            ) : activeTab === "login" ? (
              <>
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
