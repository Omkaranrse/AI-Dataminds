"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Clock, Archive, Trash2, ArrowUpRight } from "lucide-react";
import { ProjectResponse, archiveProject, deleteProject } from "@/lib/projects";

interface ProjectCardProps {
  project: ProjectResponse;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const router = useRouter();

  const handleArchive = async () => {
    try {
      setIsArchiving(true);
      await archiveProject(project.id, project.version, !project.archived_at);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update project archive state");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete "${project.name}"?`)) {
      return;
    }
    try {
      await deleteProject(project.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  const roleStyles = {
    owner: "bg-violet/20 text-violet-200 border-violet/30",
    editor: "bg-cyan/20 text-cyan-200 border-cyan/30",
    viewer: "bg-white/10 text-white/70 border-white/20",
  }[project.current_user_role];

  const updatedDate = new Date(project.updated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="glass group relative flex flex-col justify-between rounded-3xl p-6 transition duration-200 hover:border-white/25 hover:shadow-cyan/5">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${roleStyles}`}
          >
            {project.current_user_role}
          </span>

          <div className="flex items-center gap-1.5 text-xs text-white/45">
            <Users className="size-3.5 text-cyan" />
            <span>
              {project.member_count} {project.member_count === 1 ? "member" : "members"}
            </span>
          </div>
        </div>

        {/* Project Title */}
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-white group-hover:text-cyan transition-colors">
          {project.name}
        </h3>

        {/* Description */}
        <p className="mt-2 text-sm leading-relaxed text-white/50 line-clamp-2">
          {project.description || "No description provided for this data workspace."}
        </p>
      </div>

      {/* Card Footer */}
      <div className="mt-6 border-t border-white/10 pt-4 flex items-center justify-between text-xs text-white/40">
        <div className="flex items-center gap-1">
          <Clock className="size-3.5" />
          <span>Updated {updatedDate}</span>
        </div>

        {/* Owner Controls */}
        <div className="flex items-center gap-2">
          {project.current_user_role === "owner" && (
            <>
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving}
                title={project.archived_at ? "Restore project" : "Archive project"}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <Archive className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                title="Delete project"
                className="rounded-lg p-1.5 text-white/40 hover:bg-red-400/20 hover:text-red-300 transition"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}

          <div className="flex items-center gap-1 text-cyan font-medium group-hover:underline cursor-pointer pl-1">
            <span>Open</span>
            <ArrowUpRight className="size-3.5" />
          </div>
        </div>
      </div>
    </article>
  );
}
