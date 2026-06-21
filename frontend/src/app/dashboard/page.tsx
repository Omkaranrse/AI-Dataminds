"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Folder, Calendar, ArrowRight, LogOut, Loader2, Bot } from "lucide-react";
import api from "@/lib/api";

interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchProjects = async () => {
    try {
      const response = await api.get("/projects/");
      setProjects(response.data);
    } catch (error) {
      // If unauthorized, redirect to login
      localStorage.removeItem("token");
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;
    setCreateLoading(true);

    try {
      await api.post("/projects/", {
        name: newProjectName,
        description: newProjectDesc,
      });
      setNewProjectName("");
      setNewProjectDesc("");
      setShowModal(false);
      fetchProjects();
    } catch (error) {
      alert("Failed to create project");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="px-6 lg:px-16 h-20 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <Bot className="h-7 w-7 text-accent-indigo" />
          <span className="text-lg font-bold tracking-tight text-white">
            AETHER WORKSPACE
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white transition"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Projects</h1>
            <p className="text-slate-400 text-sm mt-1">Select or create a workspace to begin analysis.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 transition rounded-xl text-white font-semibold text-sm shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 text-accent-indigo animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center">
            <Folder className="h-12 w-12 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No projects found</h3>
            <p className="text-slate-400 max-w-sm mb-6">
              Create your first project to upload files, clean values, run EDA, and generate insight reports.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 transition rounded-xl text-slate-200 text-sm font-semibold"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/dashboard/project/${project.id}`)}
                className="glass-panel p-6 rounded-2xl cursor-pointer hover:border-accent-indigo/40 transition flex flex-col h-48 justify-between relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-20 h-20 bg-accent-indigo/10 blur-2xl rounded-full group-hover:bg-accent-indigo/25 transition" />
                <div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-accent-indigo transition">
                    {project.name}
                  </h3>
                  <p className="text-slate-400 text-xs line-clamp-3 leading-relaxed">
                    {project.description || "No description provided."}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-4">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className="flex items-center text-accent-indigo group-hover:translate-x-1 transition">
                    Open <ArrowRight className="h-3 w-3 ml-1" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl relative">
            <h3 className="text-xl font-bold text-white mb-4">Create Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Sales Analysis Q3"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent-indigo transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Description
                </label>
                <textarea
                  placeholder="Identify Q3 sales trends, perform cleaning, and build reports."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent-indigo transition text-sm"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 transition rounded-xl text-slate-300 font-semibold text-sm border border-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 disabled:opacity-50 transition rounded-xl text-white font-semibold text-sm shadow-md"
                >
                  {createLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
