"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProject } from "@/lib/projects";

interface CreateProjectModalProps {
  buttonText?: string;
  className?: string;
}

export function CreateProjectModal({ buttonText = "New Project", className = "" }: CreateProjectModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleOpen = () => {
    setName("");
    setDescription("");
    setError("");
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      setError("Project name must be at least 2 characters.");
      return;
    }
    if (trimmedName.length > 120) {
      setError("Project name cannot exceed 120 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      await createProject({
        name: trimmedName,
        description: description.trim() || null,
      });

      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        className={`focus-ring inline-flex h-10 items-center gap-2 rounded-xl bg-cyan px-4 text-sm font-semibold text-ink transition hover:bg-cyan/90 ${className}`}
      >
        <Plus className="size-4" />
        <span>{buttonText}</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={handleClose}
        >
          <div
            className="glass relative w-full max-w-lg rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Icon Button */}
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="absolute right-5 top-5 rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan/10 text-cyan border border-cyan/20">
                <FolderPlus className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-white">Create New Project</h2>
                <p className="text-xs text-white/50">Start an AI-native data workspace for your datasets</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-white/60">
                  Project Name *
                </label>
                <Input
                  autoFocus
                  required
                  placeholder="e.g. Q4 Sales Forecast"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2"
                  maxLength={120}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-white/60">
                  Description <span className="text-white/30">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What data or questions will this workspace explore?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="focus-ring mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-white/35 resize-none transition"
                  maxLength={2000}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/20 bg-red-400/10 p-3 text-sm text-red-200"
                >
                  {error}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="focus-ring rounded-xl px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                <Button
                  disabled={isSubmitting || name.trim().length < 2}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan px-5 text-sm font-semibold text-ink transition hover:bg-cyan/90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block size-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
                      <span>Creating…</span>
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
