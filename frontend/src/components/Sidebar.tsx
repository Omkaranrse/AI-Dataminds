"use client";

import { LayoutDashboard, Database, BarChart4, MessageSquare, ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";

interface SidebarProps {
  projectName: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ projectName, activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
    { id: "datasets", label: "Datasets & Uploads", icon: Database },
    { id: "analysis", label: "Auto-Analysis & EDA", icon: BarChart4 },
    { id: "chat", label: "Chat with Data", icon: MessageSquare },
  ];

  return (
    <aside className="w-64 border-r border-white/5 bg-black/30 flex flex-col h-full shrink-0">
      {/* Brand logo & workspace name */}
      <div className="p-6 border-b border-white/5 flex flex-col space-y-4">
        <Link href="/dashboard" className="flex items-center space-x-2 text-slate-400 hover:text-white transition group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition" />
          <span className="text-xs font-semibold uppercase tracking-wider">Back to Dashboard</span>
        </Link>
        <div className="flex items-center space-x-2 pt-2">
          <Bot className="h-6 w-6 text-accent-indigo" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider truncate">
            {projectName}
          </h2>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-accent-indigo/10 border border-accent-indigo/20 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-accent-indigo" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-6 border-t border-white/5 text-[10px] text-slate-500">
        Aether Agent Workspace v1.0.0
      </div>
    </aside>
  );
}
