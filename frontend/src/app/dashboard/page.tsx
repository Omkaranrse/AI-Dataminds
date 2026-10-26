import { redirect } from "next/navigation";
import { FolderSearch, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/auth";
import { getProjects, ProjectListResponse } from "@/lib/projects";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { ProjectCard } from "@/components/projects/project-card";

export default async function Dashboard() {
  const session = await auth();
  if (!session || session.error === "RefreshTokenError") {
    redirect("/login");
  }

  let projectsData: ProjectListResponse = { items: [], total: 0, limit: 50, offset: 0 };
  let fetchError: string | null = null;

  try {
    projectsData = await getProjects(false);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Could not load projects";
  }

  const projects = projectsData.items || [];
  const firstName = session.user.name?.split(" ")[0] || "there";

  return (
    <main className="min-h-screen pb-20">
      {/* Navigation */}
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Brand />
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="size-2 rounded-full bg-cyan animate-pulse" />
            <span>{session.user.email}</span>
          </div>
          <SignOutButton />
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        {/* Workspace Header */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan">
              <Sparkles className="size-3.5" />
              <span>Workspace</span>
            </div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              Good to see you, {firstName}.
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Manage your analytics workspaces and AI-powered project datasets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <CreateProjectModal />
          </div>
        </div>

        {/* Verification Alert */}
        {!session.user.isEmailVerified && (
          <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100 flex items-center justify-between">
            <span>Please verify your email address to unlock all collaboration features.</span>
          </div>
        )}

        {/* Projects Error Notice */}
        {fetchError && (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-400/10 p-4 text-sm text-red-200">
            Unable to connect to the projects service: {fetchError}
          </div>
        )}

        {/* Projects Grid or Empty State */}
        <div className="mt-10">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Active Projects</h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                {projectsData.total}
              </span>
            </div>
          </div>

          {projects.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="glass mt-6 flex flex-col items-center justify-center rounded-3xl p-12 text-center border border-dashed border-white/15">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-cyan/10 text-cyan border border-cyan/20">
                <FolderSearch className="size-7" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">No projects yet</h3>
              <p className="mt-2 max-w-sm text-sm text-white/50">
                Create your first data workspace to upload documents, analyze data, and generate AI insights.
              </p>
              <div className="mt-6">
                <CreateProjectModal buttonText="Create your first project" />
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
