"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Database,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  Trash2,
  Sparkles,
  RefreshCw,
  Sliders,
  Table
} from "lucide-react";
import api from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import AnalysisPanel from "@/components/AnalysisPanel";
import ChatPanel from "@/components/ChatPanel";

interface Project {
  id: number;
  name: string;
  description?: string;
}

interface Dataset {
  id: number;
  filename: string;
  row_count: number;
  column_count: number;
  summary: {
    columns: Array<{
      name: string;
      type: string;
      null_count: number;
      null_percentage: number;
      unique_count: number;
      mean?: number;
      min?: number;
      max?: number;
    }>;
  };
  cleaning_suggestions: Array<{
    column: string;
    issue: string;
    recommended_action: string;
    parameters: any;
  }>;
  cleaned_filepath?: string;
}

export default function ProjectWorkspace({ params }: { params: { id: string } }) {
  const router = useRouter();
  const projectId = parseInt(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState("datasets");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchProjectData = async () => {
    try {
      // 1. Fetch Project Details
      const projRes = await api.get(`/projects/${projectId}`);
      setProject(projRes.data);

      // 2. Fetch Datasets
      const datasetRes = await api.get(`/datasets/project/${projectId}`);
      setDatasets(datasetRes.data);
      if (datasetRes.data.length > 0) {
        // Set first dataset as active by default
        setActiveDataset(datasetRes.data[0]);
      }
    } catch (error) {
      console.error(error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchDatasetPreview = async (datasetId: number) => {
    setPreviewLoading(true);
    try {
      const response = await api.get(`/datasets/${datasetId}/preview?limit=8`);
      setPreviewData(response.data);
    } catch (error) {
      console.error("Failed to load dataset preview", error);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  useEffect(() => {
    if (activeDataset) {
      fetchDatasetPreview(activeDataset.id);
    } else {
      setPreviewData(null);
    }
  }, [activeDataset]);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", String(projectId));

    try {
      const response = await api.post("/datasets/", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const newDataset = response.data;
      setDatasets((prev) => [newDataset, ...prev]);
      setActiveDataset(newDataset);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Upload failed. Verify that formatting is correct.");
    } finally {
      setUploading(false);
    }
  };

  // Cleaning handler
  const handleApplyCleaning = async () => {
    if (!activeDataset) return;
    setCleaning(true);

    // Format all proposed cleaning actions to request payload
    const actions = activeDataset.cleaning_suggestions.map((suggestion) => ({
      action: suggestion.recommended_action,
      column: suggestion.column,
      parameters: suggestion.parameters
    }));
    
    // Add default drop duplicates to actions
    actions.push({ action: "drop_duplicates", column: "", parameters: {} });

    try {
      const response = await api.post(`/datasets/${activeDataset.id}/clean`, { actions });
      const updatedDataset = response.data;
      // Replace dataset in local state
      setDatasets((prev) => prev.map((d) => (d.id === updatedDataset.id ? updatedDataset : d)));
      setActiveDataset(updatedDataset);
      alert("Cleaning pipeline completed successfully!");
    } catch (error) {
      alert("Failed to apply cleaning operations.");
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Loader2 className="h-10 w-10 text-accent-indigo animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Workspace Sidebar */}
      <Sidebar
        projectName={project?.name || "Workspace"}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Workspace Panels */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Datasets & Upload Tab */}
        {activeTab === "datasets" && (
          <div className="space-y-8 max-w-6xl mx-auto">
            {/* File Upload Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`glass-panel p-10 rounded-3xl border-dashed border-2 text-center transition flex flex-col items-center justify-center cursor-pointer ${
                dragActive ? "border-accent-indigo bg-accent-indigo/5" : "border-white/10 hover:border-white/20"
              } relative`}
            >
              <input
                type="file"
                id="file-upload-input"
                className="hidden"
                accept=".csv, .xlsx, .xls, .json"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center">
                {uploading ? (
                  <Loader2 className="h-12 w-12 text-accent-indigo animate-spin mb-4" />
                ) : (
                  <Upload className="h-12 w-12 text-slate-500 mb-4 hover:text-accent-indigo transition" />
                )}
                <h3 className="text-lg font-bold text-white mb-2">
                  {uploading ? "Ingesting Dataset..." : "Upload your dataset file"}
                </h3>
                <p className="text-slate-400 text-sm max-w-xs leading-relaxed mb-4">
                  Drag and drop your file here, or click to browse. Supports CSV, Excel, or JSON.
                </p>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Max file size: 50MB
                </span>
              </label>
            </div>

            {/* Datasets List & Details */}
            {datasets.length > 0 && (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* File list selector */}
                <div className="glass-panel p-6 rounded-2xl space-y-4 h-fit">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2 border-b border-white/5 pb-3">
                    <Database className="h-4 w-4 text-accent-indigo" />
                    <span>Project Datasets</span>
                  </h3>
                  <div className="space-y-2">
                    {datasets.map((dataset) => (
                      <div
                        key={dataset.id}
                        onClick={() => setActiveDataset(dataset)}
                        className={`p-3 rounded-xl cursor-pointer border flex items-center justify-between transition ${
                          activeDataset?.id === dataset.id
                            ? "bg-accent-indigo/10 border-accent-indigo text-white"
                            : "bg-white/30 border-white/5 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <FileSpreadsheet className="h-4 w-4 shrink-0" />
                          <span className="text-xs font-semibold truncate">{dataset.filename}</span>
                        </div>
                        {dataset.cleaned_filepath && (
                          <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">
                            Cleaned
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dataset Profiling and preview */}
                {activeDataset && (
                  <div className="lg:col-span-2 space-y-8">
                    {/* Profiling Stats */}
                    <div className="glass-panel p-6 rounded-2xl">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                        <div>
                          <h3 className="text-base font-bold text-white">{activeDataset.filename}</h3>
                          <p className="text-slate-400 text-xs mt-1">
                            Structure: **{activeDataset.row_count}** rows x **{activeDataset.column_count}** columns
                          </p>
                        </div>
                        
                        {/* Auto-cleaning triggers */}
                        {activeDataset.cleaning_suggestions.length > 0 && (
                          <button
                            onClick={handleApplyCleaning}
                            disabled={cleaning}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 disabled:opacity-50 transition rounded-xl text-white font-semibold text-xs shadow"
                          >
                            {cleaning ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Cleaning...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Apply {activeDataset.cleaning_suggestions.length} Cleanings</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Columns Grid */}
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                        <Sliders className="h-3.5 w-3.5" />
                        <span>Data Schema & Stats</span>
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-1">
                        {activeDataset.summary.columns.map((col, index) => (
                          <div key={index} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-white truncate max-w-[120px]">{col.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{col.type}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-400">
                              <span>Nulls: {col.null_count} ({col.null_percentage.toFixed(1)}%)</span>
                              <span>Uniques: {col.unique_count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Data Preview Table */}
                    <div className="glass-panel p-6 rounded-2xl">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-1.5">
                        <Table className="h-3.5 w-3.5" />
                        <span>Dataset Raw Preview</span>
                      </h4>
                      {previewLoading ? (
                        <div className="flex justify-center items-center py-10">
                          <Loader2 className="h-6 w-6 text-accent-indigo animate-spin" />
                        </div>
                      ) : previewData ? (
                        <div className="overflow-x-auto border border-white/5 rounded-xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-white/10 bg-white/5">
                                {previewData.columns.map((col) => (
                                  <th key={col} className="p-2.5 font-bold text-slate-300 whitespace-nowrap">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.rows.map((row, idx) => (
                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                                  {previewData.columns.map((col) => (
                                    <td key={col} className="p-2.5 text-slate-400 font-mono whitespace-nowrap">
                                      {row[col] !== null ? String(row[col]) : "-"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-10 text-xs text-slate-500">
                          Failed to load preview data.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Auto-Analysis Tab */}
        {activeTab === "analysis" && (
          <div className="max-w-6xl mx-auto">
            <AnalysisPanel dataset={activeDataset} projectId={projectId} />
          </div>
        )}

        {/* Chat with Data Tab */}
        {activeTab === "chat" && (
          <div className="max-w-6xl mx-auto">
            <ChatPanel projectId={projectId} />
          </div>
        )}
      </main>
    </div>
  );
}
