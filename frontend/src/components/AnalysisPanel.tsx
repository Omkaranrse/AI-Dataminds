"use client";

import { useState, useEffect } from "react";
import { Play, Sparkles, Loader2, Award, TrendingUp, AlertCircle, BarChart3, Bookmark } from "lucide-react";
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
  Cell
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

const COLORS = ["#7c3aed", "#6366f1", "#0d9488", "#e11d48", "#ea580c"];

export default function AnalysisPanel({ dataset, projectId }: AnalysisPanelProps) {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [pinnedInsights, setPinnedInsights] = useState<string[]>([]);

  const extractBusinessInsights = (content?: string) => {
    if (!content) return [];
    const sentences = content
      .split(/\n|\.|\!|\?/) // split text into sentences
      .map((segment) => segment.trim())
      .filter(Boolean)
      .filter((sentence) => sentence.length > 20);

    const uniqueSentences = Array.from(new Set(sentences));
    return uniqueSentences.slice(0, 3);
  };

  const reportInsights = extractBusinessInsights(report?.content);

  const togglePinInsight = (insight: string) => {
    setPinnedInsights((prev) =>
      prev.includes(insight) ? prev.filter((item) => item !== insight) : [...prev, insight]
    );
  };

  const fetchLatestReport = async () => {
    if (!dataset) {
      setInitLoading(false);
      return;
    }
    setInitLoading(true);
    try {
      const response = await api.get(`/analysis/project/${projectId}`);
      const reports: AnalysisReport[] = Array.isArray(response.data) ? response.data : [];
      const currentReport = reports.length > 0 ? reports[0] : null;
      setReport(currentReport);
    } catch (error) {
      console.error("Failed to load report", error);
    } finally {
      setInitLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestReport();
  }, [dataset]);

  const handleStartAnalysis = async () => {
    if (!dataset) return;
    setLoading(true);
    try {
      const response = await api.post(`/analysis/${dataset.id}`);
      setReport(response.data);
    } catch (error) {
      alert("Failed to run agent workflow analysis.");
    } finally {
      setLoading(false);
    }
  };

  if (!dataset) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-slate-500 mb-4" />
        <h4 className="text-lg font-bold text-white mb-1">No Active Dataset</h4>
        <p className="text-slate-400 text-sm max-w-xs">
          Please upload a dataset in the "Datasets & Uploads" tab before starting analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Trigger Analysis / Summary Banner */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-accent-purple" />
            <span>AI Autonomous Agent Analysis</span>
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Trigger our 5-agent LangGraph workflow to profile, clean, and analyze `{dataset.filename}`.
          </p>
        </div>
        <button
          onClick={handleStartAnalysis}
          disabled={loading}
          className="flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 disabled:opacity-50 transition rounded-xl text-white font-semibold text-sm shadow-md shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing Workflow...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white" />
              <span>Trigger Auto-Analysis</span>
            </>
          )}
        </button>
      </div>

      {initLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 text-accent-indigo animate-spin" />
        </div>
      ) : !report ? (
        <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center">
          <BarChart3 className="h-12 w-12 text-slate-600 mb-4" />
          <h4 className="text-lg font-bold text-white mb-1">No reports compiled yet</h4>
          <p className="text-slate-400 text-sm max-w-sm mb-6">
            Click the "Trigger Auto-Analysis" button above to run the LangGraph pipeline and view insights.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {/* Markdown Report Section */}
          <div className="md:col-span-2 glass-panel p-8 rounded-2xl space-y-6 overflow-y-auto max-h-[600px]">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Award className="h-5 w-5 text-accent-teal" />
                  <span>{report.title}</span>
                </h2>
                <p className="text-slate-400 text-sm mt-2">
                  Generated from the dataset and enhanced with summary insights, charts, and problem-focused recommendations.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-950/70 border border-white/10 px-4 py-3 text-xs text-slate-300">
                <div className="font-semibold text-white">Report</div>
                <div className="mt-2">Created {new Date(report.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {pinnedInsights.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Pinned insights</div>
                  <button
                    onClick={() => setPinnedInsights([])}
                    className="text-[10px] text-accent-indigo hover:text-white transition"
                  >
                    Clear pins
                  </button>
                </div>
                <div className="space-y-3">
                  {pinnedInsights.map((insight, index) => (
                    <div key={`${insight}-${index}`} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Pinned {index + 1}</div>
                        <button
                          onClick={() => togglePinInsight(insight)}
                          className="flex items-center gap-1 text-slate-400 hover:text-white text-xs"
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          Unpin
                        </button>
                      </div>
                      <p className="leading-relaxed">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reportInsights.length > 0 && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">Top 3 business insights</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {reportInsights.map((insight, index) => (
                      <div key={index} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Insight {index + 1}</span>
                          <button
                            onClick={() => togglePinInsight(insight)}
                            className={`flex items-center gap-1 text-xs ${pinnedInsights.includes(insight) ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                          >
                            <Bookmark className="h-3.5 w-3.5" />
                            {pinnedInsights.includes(insight) ? 'Pinned' : 'Pin'}
                          </button>
                        </div>
                        <p className="leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">Key insights</div>
                  <ul className="space-y-2 text-sm text-slate-300 list-disc list-inside">
                    {reportInsights.map((insight, index) => (
                      <li key={index} className="leading-relaxed">{insight}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {report.content}
            </div>
          </div>

          {/* Visualizations Section */}
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white flex items-center space-x-2 px-1">
              <TrendingUp className="h-4 w-4 text-accent-indigo" />
              <span>Agent Visualizations</span>
            </h3>

            {report.visualizations.length === 0 ? (
              <div className="glass-panel p-8 text-center text-slate-500 text-xs rounded-2xl">
                No visualizations compiled.
              </div>
            ) : (
              report.visualizations.map((vis, idx) => (
                <div key={idx} className="glass-panel p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-semibold text-slate-300 tracking-wide">
                    {vis.title}
                  </h4>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {vis.type === "bar" ? (
                        <BarChart data={vis.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey={vis.xAxis} stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(15, 10, 30, 0.95)",
                              borderColor: "rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#fff"
                            }}
                          />
                          <Bar dataKey={vis.yAxis || "value"} fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : vis.type === "line" ? (
                        <LineChart data={vis.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey={vis.xAxis} stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={10} />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(15, 10, 30, 0.95)",
                              borderColor: "rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#fff"
                            }}
                          />
                          <Line type="monotone" dataKey={vis.yAxis || "y"} stroke="#7c3aed" strokeWidth={2} dot={false} />
                        </LineChart>
                      ) : (
                        <PieChart>
                          <Pie
                            data={vis.data}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {vis.data.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "rgba(15, 10, 30, 0.95)",
                              borderColor: "rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#fff"
                            }}
                          />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
