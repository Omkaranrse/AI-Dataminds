"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Sparkles,
  Loader2,
  Award,
  TrendingUp,
  AlertCircle,
  BarChart3,
  Bookmark,
  Lightbulb,
  ShieldAlert,
  Database,
  FileText,
} from "lucide-react";
import api from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Dataset {
  id: number;
  filename: string;
}

interface AnalysisReport {
  id: number;
  title: string;
  content?: string;
  visualizations: Array<{
    title: string;
    type: "bar" | "line" | "pie";
    xAxis?: string;
    yAxis?: string;
    data: Array<any>;
  }>;
  created_at: string;
}

interface AnalysisPanelProps {
  dataset: Dataset | null;
  projectId: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#7c3aed", "#6366f1", "#0d9488", "#e11d48", "#ea580c", "#d97706"];

/**
 * Parses the raw markdown string returned by the backend into typed sections
 * so we can render each piece correctly instead of dumping raw text.
 */
function parseMarkdownReport(raw: string) {
  const lines = raw.split("\n");
  const sections: Array<{
    type: "h1" | "h2" | "h3" | "p" | "li" | "table" | "blank";
    text: string;
    cells?: string[][];   // for type === "table"
  }> = [];

  let tableBuffer: string[][] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      sections.push({ type: "table", text: "", cells: tableBuffer });
      tableBuffer = [];
    }
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect pipe tables
    if (trimmed.startsWith("|")) {
      inTable = true;
      // Skip separator rows like |---|---|
      if (/^\|[\s\-|:]+\|$/.test(trimmed)) continue;
      const row = trimmed
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim().replace(/\*\*/g, ""));
      tableBuffer.push(row);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (trimmed.startsWith("### ")) {
      sections.push({ type: "h3", text: trimmed.slice(4) });
    } else if (trimmed.startsWith("## ")) {
      sections.push({ type: "h2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("# ")) {
      sections.push({ type: "h1", text: trimmed.slice(2) });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      sections.push({ type: "li", text: inlineMd(trimmed.slice(2)) });
    } else if (trimmed === "") {
      sections.push({ type: "blank", text: "" });
    } else {
      sections.push({ type: "p", text: inlineMd(trimmed) });
    }
  }

  if (inTable) flushTable();
  return sections;
}

/** Very small inline markdown → HTML string (bold, backtick only) */
function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="ap-code">$1</code>');
}

/** Pulls the first 3 meaningful sentences for the insights sidebar. */
function extractInsights(content?: string): string[] {
  if (!content) return [];
  return Array.from(
    new Set(
      content
        .split(/\n/)
        .map((l) => l.trim().replace(/^[-*#>]+\s*/, "").replace(/\*\*/g, ""))
        .filter((l) => l.length > 30 && !/^\|/.test(l))
    )
  ).slice(0, 3);
}

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-slate-900/60 border border-white/10 px-4 py-3">
      <span className="text-[11px] uppercase tracking-widest text-slate-500">{label}</span>
      <span className="text-2xl font-semibold" style={{ color: accent }}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  );
}

function MarkdownReport({ content }: { content: string }) {
  const sections = parseMarkdownReport(content);
  const items: React.ReactNode[] = [];
  let liBuffer: string[] = [];

  const flushList = (key: string) => {
    if (liBuffer.length === 0) return;
    items.push(
      <ul key={key} className="list-disc list-inside space-y-1 text-sm text-slate-300 mb-3 pl-1">
        {liBuffer.map((t, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: t }} />
        ))}
      </ul>
    );
    liBuffer = [];
  };

  sections.forEach((s, idx) => {
    if (s.type !== "li" && liBuffer.length > 0) flushList(`ul-${idx}`);

    switch (s.type) {
      case "h1":
        items.push(
          <h1 key={idx} className="text-base font-semibold text-white mt-4 mb-1 pb-1 border-b border-white/10">
            {s.text}
          </h1>
        );
        break;
      case "h2":
        items.push(
          <h2 key={idx} className="text-sm font-semibold text-white mt-4 mb-1 pb-1 border-b border-white/10">
            {s.text}
          </h2>
        );
        break;
      case "h3":
        items.push(
          <h3 key={idx} className="text-sm font-medium text-slate-200 mt-3 mb-1">
            {s.text}
          </h3>
        );
        break;
      case "li":
        liBuffer.push(s.text);
        break;
      case "table":
        if (!s.cells || s.cells.length === 0) break;
        const [headers, ...rows] = s.cells;
        items.push(
          <div key={idx} className="overflow-x-auto rounded-xl border border-white/10 my-3">
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr className="bg-slate-900/80">
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider border-b border-white/10 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="even:bg-slate-900/40 hover:bg-white/5 transition">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        break;
      case "p":
        items.push(
          <p
            key={idx}
            className="text-sm text-slate-300 leading-relaxed mb-2"
            dangerouslySetInnerHTML={{ __html: s.text }}
          />
        );
        break;
      case "blank":
        // swallow consecutive blanks
        break;
    }
  });

  if (liBuffer.length > 0) flushList("ul-end");

  return <div className="space-y-0.5">{items}</div>;
}

type ReportTab = "report" | "stats" | "quality";

function ReportSection({ report }: { report: AnalysisReport }) {
  const [activeTab, setActiveTab] = useState<ReportTab>("report");
  const [pinnedInsights, setPinnedInsights] = useState<string[]>([]);
  const insights = extractInsights(report.content);

  const togglePin = (s: string) =>
    setPinnedInsights((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
    { key: "report", label: "Report", icon: <FileText className="h-3.5 w-3.5" /> },
    { key: "stats", label: "Statistics", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { key: "quality", label: "Data quality", icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10 pb-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition rounded-t-lg border-b-2 -mb-px ${
              activeTab === t.key
                ? "border-accent-purple text-white bg-white/5"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Report tab ── */}
      {activeTab === "report" && (
        <div className="space-y-4">
          {/* Pinned insights strip */}
          {pinnedInsights.length > 0 && (
            <div className="rounded-xl border border-accent-purple/30 bg-accent-purple/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-400">Pinned insights</span>
                <button
                  onClick={() => setPinnedInsights([])}
                  className="text-[10px] text-accent-indigo hover:text-white transition"
                >
                  Clear all
                </button>
              </div>
              {pinnedInsights.map((ins, i) => (
                <div key={i} className="text-xs text-slate-300 leading-relaxed pl-2 border-l-2 border-accent-purple/50">
                  {ins}
                </div>
              ))}
            </div>
          )}

          {/* Top 3 insights grid */}
          {insights.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-2">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-slate-900/60 p-3 flex flex-col gap-2"
                >
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">
                    Insight {i + 1}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed flex-1">{ins}</p>
                  <button
                    onClick={() => togglePin(ins)}
                    className={`flex items-center gap-1 text-[10px] self-end transition ${
                      pinnedInsights.includes(ins)
                        ? "text-accent-teal"
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    <Bookmark className="h-3 w-3" />
                    {pinnedInsights.includes(ins) ? "Pinned" : "Pin"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Parsed markdown body */}
          <div className="max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {report.content ? (
              <MarkdownReport content={report.content} />
            ) : (
              <p className="text-sm text-slate-500 italic">No report content available.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Statistics tab ── */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          <p className="text-[11px] uppercase tracking-widest text-slate-500">
            Numeric column summaries
          </p>
          {report.content ? (
            (() => {
              // Extract only the table sections from the parsed markdown
              const sections = parseMarkdownReport(report.content);
              const tables = sections.filter((s) => s.type === "table" && s.cells && s.cells.length > 0);
              if (tables.length === 0) {
                return (
                  <p className="text-sm text-slate-500 italic">
                    No statistical tables found in the report.
                  </p>
                );
              }
              return tables.map((t, idx) => {
                const [headers, ...rows] = t.cells!;
                return (
                  <div key={idx} className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-xs text-slate-300">
                      <thead>
                        <tr className="bg-slate-900/80">
                          {headers.map((h, i) => (
                            <th
                              key={i}
                              className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider border-b border-white/10 whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, ri) => (
                          <tr
                            key={ri}
                            className="even:bg-slate-900/40 hover:bg-white/5 transition-colors"
                          >
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className={`px-3 py-2 whitespace-nowrap ${
                                  ci === 0 ? "font-medium text-slate-200" : "font-mono tabular-nums"
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              });
            })()
          ) : (
            <p className="text-sm text-slate-500 italic">No content available.</p>
          )}
        </div>
      )}

      {/* ── Data quality tab ── */}
      {activeTab === "quality" && (
        <div className="space-y-4">
          <p className="text-[11px] uppercase tracking-widest text-slate-500">
            Detected issues
          </p>
          {report.content ? (
            (() => {
              // Heuristic: pull lines that mention "null" or "Severity"
              const issues = report.content
                .split("\n")
                .filter((l) => /null|missing|severity/i.test(l))
                .map((l) => l.trim().replace(/^[-*]\s*/, "").replace(/\*\*/g, ""))
                .filter((l) => l.length > 10);

              if (issues.length === 0) {
                return (
                  <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-center text-slate-500 text-sm">
                    No data quality issues detected.
                  </div>
                );
              }

              const sev = (text: string) => {
                const t = text.toLowerCase();
                if (t.includes("high")) return { label: "High", cls: "bg-red-900/50 text-red-400 border-red-500/30" };
                if (t.includes("low")) return { label: "Low", cls: "bg-green-900/50 text-green-400 border-green-500/30" };
                return { label: "Medium", cls: "bg-amber-900/50 text-amber-400 border-amber-500/30" };
              };

              return (
                <div className="space-y-2">
                  {issues.map((issue, i) => {
                    const s = sev(issue);
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3"
                      >
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap mt-0.5 ${s.cls}`}
                        >
                          {s.label}
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed">{issue}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-slate-500 italic">No content available.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Visualizations ──────────────────────────────────────────────────────────

const CustomTooltipStyle = {
  background: "rgba(10, 8, 25, 0.97)",
  borderColor: "rgba(255,255,255,0.1)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#fff",
  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
};

function VisualizationCard({
  vis,
}: {
  vis: AnalysisReport["visualizations"][number];
}) {
  return (
    <div className="glass-panel p-5 rounded-2xl space-y-3">
      <h4 className="text-xs font-semibold text-slate-300 tracking-wide flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-accent-indigo" />
        {vis.title}
      </h4>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {vis.type === "bar" ? (
            <BarChart data={vis.data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey={vis.xAxis} stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <YAxis stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <Tooltip contentStyle={CustomTooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey={vis.yAxis || "value"} radius={[4, 4, 0, 0]}>
                {vis.data.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : vis.type === "line" ? (
            <LineChart data={vis.data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey={vis.xAxis} stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <YAxis stroke="#475569" fontSize={10} tick={{ fill: "#94a3b8" }} />
              <Tooltip contentStyle={CustomTooltipStyle} />
              <Line
                type="monotone"
                dataKey={vis.yAxis || "y"}
                stroke="#7c3aed"
                strokeWidth={2}
                dot={{ r: 3, fill: "#7c3aed", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={vis.data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={68}
                paddingAngle={4}
                dataKey="value"
              >
                {vis.data.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={CustomTooltipStyle} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{value}</span>
                )}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AnalysisPanel({ dataset, projectId }: AnalysisPanelProps) {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  const fetchLatestReport = async () => {
    if (!dataset) { setInitLoading(false); return; }
    setInitLoading(true);
    try {
      const response = await api.get(`/analysis/project/${projectId}`);
      const reports: AnalysisReport[] = Array.isArray(response.data) ? response.data : [];
      setReport(reports.length > 0 ? reports[0] : null);
    } catch {
      console.error("Failed to load report");
    } finally {
      setInitLoading(false);
    }
  };

  useEffect(() => { fetchLatestReport(); }, [dataset]);

  const handleStartAnalysis = async () => {
    if (!dataset) return;
    setLoading(true);
    try {
      const response = await api.post(`/analysis/${dataset.id}`);
      setReport(response.data);
    } catch {
      alert("Failed to run agent workflow analysis.");
    } finally {
      setLoading(false);
    }
  };

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <AlertCircle className="h-10 w-10 text-slate-600" />
        <h4 className="text-base font-semibold text-white">No active dataset</h4>
        <p className="text-sm text-slate-400 max-w-xs">
          Upload a dataset in the "Datasets &amp; Uploads" tab to begin analysis.
        </p>
      </div>
    );
  }

  // ── KPI values derived from report content ───────────────────────────────
  const rowMatch = report?.content?.match(/(\d[\d,]+)\s*rows/i);
  const colMatch = report?.content?.match(/(\d+)\s*columns/i);
  const nullMatch = report?.content?.match(/(\d+)\s*null/i);
  const kpiRows = rowMatch ? rowMatch[1] : "—";
  const kpiCols = colMatch ? colMatch[1] : "—";
  const kpiNulls = nullMatch ? nullMatch[1] : "0";

  return (
    <div className="space-y-6">

      {/* ── Banner ── */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-purple" />
            AI Autonomous Agent Analysis
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            5-agent LangGraph workflow — profiling, cleaning, and analyzing{" "}
            <code className="ap-code">{dataset.filename}</code>
          </p>
        </div>
        <button
          onClick={handleStartAnalysis}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 disabled:opacity-50 transition rounded-xl text-white font-semibold text-sm shadow-md shrink-0"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
          ) : (
            <><Play className="h-4 w-4 fill-white" /> Trigger auto-analysis</>
          )}
        </button>
      </div>

      {initLoading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 text-accent-indigo animate-spin" />
        </div>
      ) : !report ? (
        <div className="glass-panel rounded-2xl p-14 text-center flex flex-col items-center gap-4">
          <BarChart3 className="h-11 w-11 text-slate-700" />
          <h4 className="text-base font-semibold text-white">No reports compiled yet</h4>
          <p className="text-sm text-slate-400 max-w-sm">
            Click "Trigger auto-analysis" above to run the LangGraph pipeline and view insights.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── KPI summary bar ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total rows" value={kpiRows} sub="records in dataset" accent="#7c3aed" />
            <KpiCard label="Columns" value={kpiCols} sub="features detected" accent="#0d9488" />
            <KpiCard label="Null values" value={kpiNulls} sub="across all columns" accent="#ea580c" />
            <KpiCard
              label="Report date"
              value={new Date(report.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
              sub={new Date(report.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              accent="#6366f1"
            />
          </div>

          {/* ── Main two-column layout ── */}
          <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start">

            {/* Left: tabbed report */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Award className="h-4 w-4 text-accent-teal" />
                  {report.title}
                </h2>
                <span className="text-[10px] text-slate-500 bg-slate-900/60 border border-white/10 rounded-full px-3 py-1">
                  Generated by LangGraph
                </span>
              </div>
              <ReportSection report={report} />
            </div>

            {/* Right: visualizations */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-accent-indigo" />
                Agent visualizations
              </h3>

              {report.visualizations.length === 0 ? (
                <div className="glass-panel rounded-2xl p-8 text-center text-slate-600 text-xs">
                  No visualizations compiled yet.
                </div>
              ) : (
                report.visualizations.map((vis, idx) => (
                  <VisualizationCard key={idx} vis={vis} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global inline-code style (Tailwind can't do arbitrary pseudo-selectors here) */}
      <style>{`
        .ap-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.75rem;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 4px;
          padding: 1px 5px;
          color: #c4b5fd;
        }
      `}</style>
    </div>
  );
}