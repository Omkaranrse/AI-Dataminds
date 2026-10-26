import Link from "next/link";
import { ArrowRight, BarChart3, BrainCircuit, FileUp } from "lucide-react";
import { Brand } from "@/components/brand";

const FEATURES = [
  {
    icon: FileUp,
    title: "One effortless upload",
    description: "Support for CSV, Excel, PDF, DOCX, JSON, and raw text.",
  },
  {
    icon: BrainCircuit,
    title: "Analysis that thinks",
    description: "Automated cleaning, exploratory analysis, insights, and tailored recommendations.",
  },
  {
    icon: BarChart3,
    title: "Answers you can use",
    description: "Interactive visual charts, data dashboards, and business-ready reports.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Brand />
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="focus-ring rounded-lg px-4 py-2 text-sm text-white/65 transition hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="focus-ring rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white/90"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-5 pb-24 pt-20 text-center">
        <span className="inline-block rounded-full border border-cyan/20 bg-cyan/5 px-4 py-1.5 text-xs font-medium text-cyan">
          AI-native analytics for every team
        </span>

        <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-semibold tracking-[-.05em] sm:text-7xl">
          Upload any data.
          <br />
          <span className="bg-gradient-to-r from-violet to-cyan bg-clip-text text-transparent">
            Get insights instantly.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/55">
          Turn spreadsheets, documents, and raw data into clear analysis, visualizations,
          and strategic decisions—with an AI data team built directly into your workspace.
        </p>

        <div className="mt-10">
          <Link
            href="/register"
            className="focus-ring inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-ink transition hover:bg-cyan"
          >
            Start analyzing free <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-24 grid gap-6 text-left sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <article key={title} className="glass rounded-2xl p-6 transition hover:border-white/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/10">
                <Icon className="size-5 text-cyan" />
              </div>
              <h2 className="mt-5 font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
