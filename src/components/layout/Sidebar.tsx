"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Palette,
  History,
  Upload,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NAV, type NavItem } from "@/lib/utils/nav";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Palette,
  History,
  Upload,
  Settings,
};

export function Sidebar({ brands }: { brands: Array<{ slug: string; name: string }> }) {
  const pathname = usePathname();
  const { user } = useUser();

  // Extract active brand slug from the first path segment, if it matches a known brand.
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const activeBrandSlug = brands.some((b) => b.slug === firstSegment)
    ? firstSegment
    : brands[0]?.slug ?? "";

  const resolvedNav = NAV.filter((item) => {
    // Hide brand-scoped items if user has no brands
    if (item.brandScoped && !activeBrandSlug) return false;
    return true;
  }).map((item) => ({
    ...item,
    resolvedHref: item.brandScoped
      ? `/${activeBrandSlug}${item.href}`
      : item.href,
  }));

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-bg-raised">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Sparkles className="h-5 w-5 text-verdict-promising" />
        <span className="font-semibold tracking-tight">EcomGenius Ads</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <SidebarGroup
          title="General"
          items={resolvedNav.filter((i) => i.section === "main")}
          pathname={pathname}
        />
        <SidebarGroup
          title="Workspace"
          items={resolvedNav.filter((i) => i.section === "workspace")}
          pathname={pathname}
        />
        <SidebarGroup
          title="Operaciones"
          items={resolvedNav.filter((i) => i.section === "ops")}
          pathname={pathname}
        />

        {brands.length > 0 && (
          <div className="mt-6">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Marcas
            </p>
            {brands.map((b) => {
              const active = firstSegment === b.slug;
              return (
                <Link
                  key={b.slug}
                  href={`/${b.slug}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition",
                    active
                      ? "bg-verdict-winner/10 text-verdict-winner"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {b.name}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 border-t border-border px-3 py-3">
        <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {user?.firstName ?? user?.username ?? "Usuario"}
          </p>
          <p className="truncate text-xs text-text-muted">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
      </div>
    </aside>
  );
}

type ResolvedNavItem = NavItem & { resolvedHref: string };

function SidebarGroup({
  title,
  items,
  pathname,
}: {
  title: string;
  items: ResolvedNavItem[];
  pathname: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {title}
      </p>
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.resolvedHref}
            href={item.resolvedHref}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
              active
                ? "border border-verdict-promising/40 bg-verdict-promising/10 text-text-primary"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function isActive(pathname: string, item: ResolvedNavItem): boolean {
  if (item.brandScoped && item.href === "") {
    // Dashboard = exact match on /{brandSlug}
    return pathname === item.resolvedHref;
  }
  return pathname === item.resolvedHref || pathname.startsWith(item.resolvedHref + "/");
}
