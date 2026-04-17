import { Sidebar } from "./Sidebar";

export function AppShell({
  brands,
  children,
}: {
  brands: Array<{ slug: string; name: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar brands={brands} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
