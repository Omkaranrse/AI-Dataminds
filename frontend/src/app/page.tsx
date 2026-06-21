"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Bot, CheckCircle, ShieldAlert, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-6 lg:px-16 h-20 flex items-center justify-between border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center space-x-2">
          <Bot className="h-8 w-8 text-accent-indigo" />
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-accent-indigo bg-clip-text text-transparent">
            AETHER DATA
          </span>
        </Link>
        <nav className="flex items-center space-x-6">
          <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition">
            Sign In
          </Link>
          <Link
            href="/login?tab=register"
            className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 transition rounded-lg text-white shadow-lg shadow-indigo-900/30"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 md:py-32 px-6 max-w-6xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-accent-purple/20 bg-accent-purple/5 text-xs text-indigo-300 mb-6">
            <Sparkles className="h-3 w-3" />
            <span>Autonomous Multi-Agent AI Workflow Engine</span>
          </div>
          
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-4xl leading-tight">
            Analyze Complex Data in{" "}
            <span className="bg-gradient-to-r from-accent-purple via-accent-indigo to-accent-teal bg-clip-text text-transparent glow-text">
              Real-Time
            </span>{" "}
            with AI Agents.
          </h1>
          
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
            Upload CSV, Excel, or JSON files. Let our coordinated LangGraph multi-agent team automatically extract, clean, run EDA, construct charts, and generate insight reports for you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/login?tab=register"
              className="px-8 py-4 text-base font-semibold bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 transition rounded-xl text-white shadow-lg shadow-indigo-900/30 flex items-center justify-center space-x-2"
            >
              <span>Build Your Workspace</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 text-base font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition rounded-xl text-slate-200"
            >
              Learn More
            </Link>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-20 border-t border-white/5 bg-black/20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">Under the Hood</h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                An advanced enterprise-ready pipeline executing code safely inside sandboxes.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="glass-panel p-8 rounded-2xl flex flex-col space-y-4">
                <div className="p-3 bg-accent-purple/10 border border-accent-purple/20 rounded-xl w-fit">
                  <Bot className="h-6 w-6 text-accent-purple" />
                </div>
                <h3 className="text-xl font-bold text-white">LangGraph Multi-Agent</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Five specialized agents work sequentially to extract column configurations, clean values, complete statistical EDA, and produce executive dashboards.
                </p>
              </div>

              <div className="glass-panel p-8 rounded-2xl flex flex-col space-y-4">
                <div className="p-3 bg-accent-indigo/10 border border-accent-indigo/20 rounded-xl w-fit">
                  <BarChart3 className="h-6 w-6 text-accent-indigo" />
                </div>
                <h3 className="text-xl font-bold text-white">Interactive Visualizations</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Automatically rendering bar, line, and pie charts dynamically on the client, fully compiled using Recharts to provide seamless user interaction.
                </p>
              </div>

              <div className="glass-panel p-8 rounded-2xl flex flex-col space-y-4">
                <div className="p-3 bg-accent-teal/10 border border-accent-teal/20 rounded-xl w-fit">
                  <ShieldAlert className="h-6 w-6 text-accent-teal" />
                </div>
                <h3 className="text-xl font-bold text-white">Secure Code Execution</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Allows asking arbitrary questions by translating intent into Pandas code, executed securely inside a sandbox namespace blocking all malicious commands.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 text-center text-xs text-slate-500 bg-background">
        &copy; {new Date().getFullYear()} Aether Data Inc. Powered by LangGraph and FastAPI.
      </footer>
    </div>
  );
}
