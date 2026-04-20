/**
 * Navigation structure for the app shell.
 * Centralized so the sidebar, mobile nav, and breadcrumbs stay in sync.
 */

export interface NavItem {
  label: string;
  /** Path relative to the brand (e.g. "", "/creativos") for brand-scoped items,
   *  or absolute (e.g. "/settings") for global items. */
  href: string;
  icon: string; // lucide-react icon name
  section: "main" | "workspace" | "ops";
  /** If true, href is relative to /{brandSlug}. If false, href is absolute. */
  brandScoped: boolean;
}

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "", icon: "LayoutDashboard", section: "main", brandScoped: true },
  { label: "Creativos", href: "/creativos", icon: "Palette", section: "workspace", brandScoped: true },
  { label: "Historial", href: "/historial", icon: "History", section: "workspace", brandScoped: true },
  { label: "Carga de datos", href: "/upload", icon: "Upload", section: "ops", brandScoped: true },
  { label: "Configuración", href: "/settings", icon: "Settings", section: "ops", brandScoped: false },
];
