import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/auth";

export default async function Dashboard() {
  const session = await auth();
  if (!session || session.error === "RefreshTokenError") {
    redirect("/login");
  }
  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Brand />
        <SignOutButton />
      </nav>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-sm text-cyan">WORKSPACE</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Good to see you, {session.user.name?.split(" ")[0] || "there"}.
        </h1>
        <p className="mt-3 max-w-xl text-white/45">
          Authentication is live. Project creation and the data workspace arrive in Phase 2.
        </p>
        {!session.user.isEmailVerified && (
          <div className="mt-8 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
            Please verify your email to unlock all workspace features.
          </div>
        )}
        <div className="glass mt-10 rounded-3xl p-8">
          <p className="text-sm text-white/40">Signed in as</p>
          <p className="mt-2 font-medium">{session.user.email}</p>
          <span className="mt-4 inline-block rounded-full bg-violet/20 px-3 py-1 text-xs uppercase tracking-wider text-violet-200">
            {session.user.role}
          </span>
        </div>
      </section>
    </main>
  );
}
