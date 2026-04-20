import { Sidebar } from "./Sidebar";
import { BrandSwitcher, type BrandSwitcherBrand } from "./BrandSwitcher";

export function AppShell({
  brands,
  children,
}: {
  brands: BrandSwitcherBrand[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar brands={brands} />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/80 px-8 py-4 backdrop-blur">
          <BrandSwitcher brands={brands} />
        </header>
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
