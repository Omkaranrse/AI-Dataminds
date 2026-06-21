"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Terminal, Database, MessageSquare, Code, Loader2 } from "lucide-react";
import api from "@/lib/api";

interface ChatMessage {
  id: number;
  role: string;
  content: string;
  code_executed?: string;
  code_output?: string;
  created_at: string;
}

interface ChatPanelProps {
  projectId: number;
}

export default function ChatPanel({ projectId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const response = await api.get(`/chat/project/${projectId}`);
      setMessages(response.data);
    } catch (error) {
      console.error("Failed to load chat history", error);
    } finally {
      setInitLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setLoading(true);

    // Optimistic user message append
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: userText,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await api.post(`/chat/project/${projectId}`, {
        content: userText
      });
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), response.data]);
    } catch (error: any) {
      const errMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: `Error: ${error.response?.data?.detail || "Failed to get reply."}`,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse Pandas JSON dataframe string to table
  const renderOutputTable = (outputStr?: string) => {
    if (!outputStr) return null;
    try {
      const parsed = JSON.parse(outputStr);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        const columns = Object.keys(parsed[0]);
        return (
          <div className="overflow-x-auto border border-white/5 rounded-lg mt-3 max-h-60 bg-black/40">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  {columns.map((col) => (
                    <th key={col} className="p-2 font-bold text-slate-300">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                    {columns.map((col) => (
                      <td key={col} className="p-2 text-slate-400 font-mono">
                        {row[col] !== null ? String(row[col]) : "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 10 && (
              <div className="p-2 text-center text-[10px] text-slate-500 bg-white/5 border-t border-white/5">
                Showing top 10 of {parsed.length} rows
              </div>
            )}
          </div>
        );
      }
      return <pre className="text-xs font-mono text-slate-400 mt-2 whitespace-pre-wrap">{outputStr}</pre>;
    } catch {
      return <pre className="text-xs font-mono text-slate-400 mt-2 whitespace-pre-wrap">{outputStr}</pre>;
    }
  };

  return (
    <div className="flex flex-col h-[600px] glass-panel rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-accent-indigo" />
          <h3 className="text-sm font-bold text-white">Chat with Dataset</h3>
        </div>
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-[10px] text-emerald-400">
          <Terminal className="h-3 w-3" />
          <span>Pandas Safe Sandbox Active</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {initLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 text-accent-indigo animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <Database className="h-10 w-10 text-slate-600" />
            <h4 className="text-sm font-semibold text-slate-300">Ask anything about your data</h4>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              E.g., "what is the average values in age column?" or "show me the details of rows where score is above 90".
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-accent-indigo text-white rounded-br-none"
                    : "glass-card text-slate-200 rounded-bl-none border-white/5"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                
                {/* Code execution logs */}
                {msg.code_executed && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <details className="group cursor-pointer">
                      <summary className="text-[10px] text-slate-400 font-semibold flex items-center space-x-1 hover:text-white select-none">
                        <Code className="h-3.5 w-3.5" />
                        <span>Code Executed</span>
                      </summary>
                      <pre className="text-[10px] font-mono bg-black/50 p-2.5 rounded-lg text-indigo-300 border border-white/5 overflow-x-auto mt-2 cursor-text">
                        {msg.code_executed}
                      </pre>
                    </details>
                  </div>
                )}
                
                {/* Custom Output rendering (Table / String) */}
                {msg.code_output && (
                  <div className="mt-2">
                    {renderOutputTable(msg.code_output)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-center space-x-2 text-slate-500 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Agent is compiling Pandas query...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-black/20 flex gap-3">
        <input
          type="text"
          placeholder="Ask a question about the uploaded dataset..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent-indigo transition text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-3 bg-gradient-to-r from-accent-purple to-accent-indigo hover:opacity-90 disabled:opacity-50 transition rounded-xl text-white shadow-md flex items-center justify-center shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
