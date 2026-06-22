"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Database, MessageSquare, Code,
  Loader2, User, Bot, ChevronDown, ChevronUp
} from "lucide-react";
import api, { API_URL } from "@/lib/api";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  code_executed?: string;
  code_output?: string;
  created_at: string;
  isStreaming?: boolean;
}

interface ChatPanelProps {
  projectId: number;
}

// ── Stream helper ─────────────────────────────────────────────────────────────
async function streamChat(
  projectId: number,
  content: string,
  history: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onDone: (msg: ChatMessage) => void,
  onError: (err: string) => void
) {
  try {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(
      `${API_URL}/api/v1/chat/project/${projectId}/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ content, history }),
      }
    );

    if (!res.ok || !res.body) {
      // stream endpoint failed → try regular POST
      const fallback = await api.post(`/chat/project/${projectId}`, { content });
      onDone(fallback.data);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let metaPayload: { code_executed?: string; code_output?: string } = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const line = event;
        if (!line.startsWith("data: ")) continue;
        const text = line.slice(6);
        if (text === "[DONE]" || text.trim() === "") continue;

        if (text.startsWith("__META__")) {
          try { metaPayload = JSON.parse(text.slice(8)); } catch { /* ignore */ }
          continue;
        }

        accumulated += text;
        onChunk(accumulated);
      }
    }

    if (!accumulated) {
      // Nothing streamed → fallback
      const fallback = await api.post(`/chat/project/${projectId}`, { content });
      onDone(fallback.data);
    } else {
      onDone({
        id: Date.now(),
        role: "assistant",
        content: accumulated,
        code_executed: metaPayload.code_executed,
        code_output: metaPayload.code_output,
        created_at: new Date().toISOString(),
      });
    }
  } catch {
    // Network error → plain POST fallback
    try {
      const fallback = await api.post(`/chat/project/${projectId}`, { content });
      onDone(fallback.data);
    } catch (err: any) {
      onError(err?.response?.data?.detail || "Failed to get a reply.");
    }
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border border-white/10 rounded-xl overflow-hidden text-[11px]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/80 text-slate-400 hover:text-white transition"
      >
        <div className="flex items-center gap-1.5">
          <Code className="h-3 w-3" />
          <span className="font-semibold uppercase tracking-widest text-[10px]">Code executed</span>
        </div>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <pre className="p-3 bg-black/60 text-indigo-300 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
          {code}
        </pre>
      )}
    </div>
  );
}

function TableOutput({ data }: { data: Record<string, unknown>[] }) {
  const columns = Object.keys(data[0]);
  const rows = data.slice(0, 10);
  return (
    <div className="mt-3 border border-white/10 rounded-xl overflow-hidden text-xs">
      <div className="px-3 py-2 bg-slate-900/80 text-[10px] uppercase tracking-widest text-slate-500">
        Query results · showing {rows.length} of {data.length} rows
      </div>
      <div className="overflow-x-auto max-h-56">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-slate-950/80">
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 font-semibold text-slate-300 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 text-slate-300 font-mono align-top whitespace-nowrap">
                    {row[c] !== null && row[c] !== undefined ? String(row[c]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataOutput({ raw }: { raw: string }) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
      return <TableOutput data={parsed as Record<string, unknown>[]} />;
    }
    if (typeof parsed === "object" && parsed !== null) {
      return (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Object.entries(parsed).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{k}</div>
              <div className="mt-1 text-sm font-mono text-slate-200 break-words">
                {typeof v === "object" ? JSON.stringify(v) : String(v)}
              </div>
            </div>
          ))}
        </div>
      );
    }
  } catch { /* not JSON */ }
  return (
    <pre className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-[12px] font-mono text-slate-300 whitespace-pre-wrap">
      {raw}
    </pre>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-md ${
          isUser
            ? "bg-gradient-to-br from-indigo-500 to-purple-600"
            : "bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10"
        }`}
      >
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-indigo-300" />}
      </div>

      <div className={`flex flex-col max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <span className="text-[10px] text-slate-500 mb-1 px-1">
          {isUser ? "You" : "Assistant"}
        </span>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isUser
              ? "bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-tr-none"
              : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-none"
          }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {msg.content}
            {msg.isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse rounded-sm align-middle" />
            )}
          </div>
          {msg.code_executed && !msg.isStreaming && <CodeBlock code={msg.code_executed} />}
          {msg.code_output && !msg.isStreaming && <DataOutput raw={msg.code_output} />}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatPanel({ projectId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const buildHistory = useCallback(
    () =>
      messages
        .filter((m) => !m.isStreaming)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/chat/project/${projectId}`);
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to load chat history", err);
    } finally {
      setInitLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [projectId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const placeholder: ChatMessage = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, placeholder]);
    const history = buildHistory();

    await streamChat(
      projectId,
      text,
      history,
      (accumulated) => {
        setMessages((prev) =>
          prev.map((m) => m.id === placeholder.id ? { ...m, content: accumulated } : m)
        );
      },
      (finalMsg) => {
        setMessages((prev) =>
          prev.map((m) => m.id === placeholder.id ? { ...finalMsg, isStreaming: false } : m)
        );
        setLoading(false);
        inputRef.current?.focus();
      },
      (errMsg) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, content: `Sorry, something went wrong: ${errMsg}`, isStreaming: false }
              : m
          )
        );
        setLoading(false);
      }
    );
  };

  return (
    <div className="flex flex-col h-[640px] rounded-2xl overflow-hidden border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-2xl">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/5 bg-black/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-none">Data Chat</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ask questions about your dataset in plain English</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">Live</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 px-5 py-5 overflow-y-auto space-y-5 scroll-smooth">
        {initLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-10">
            <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Database className="h-7 w-7 text-slate-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300">Ask anything about your data</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Try <span className="text-indigo-400">"What's the average sales?"</span> or{" "}
                <span className="text-indigo-400">"Which category has the highest revenue?"</span>
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="px-4 py-3.5 border-t border-white/5 bg-black/20 flex gap-2.5 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask a question about your dataset…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:opacity-90 disabled:opacity-40 transition flex items-center justify-center shadow-md"
        >
          {loading
            ? <Loader2 className="h-4 w-4 text-white animate-spin" />
            : <Send className="h-4 w-4 text-white" />
          }
        </button>
      </form>
    </div>
  );
}