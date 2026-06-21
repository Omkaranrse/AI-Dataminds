import { Brand } from "@/components/brand";
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center px-5 py-12"><section className="w-full max-w-md"><div className="mb-8 text-center"><Brand /><h1 className="mt-8 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-white/55">{description}</p></div><div className="glass rounded-3xl p-6 sm:p-8">{children}</div></section></main>;
}

