/**
 * Navigation structure for the app shell.
 * Centralized so the sidebar, mobile nav, and breadcrumbs stay in sync.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide-react icon name
  section: "main" | "workspace" | "ops";
}

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard", section: "main" },
  { label: "Trafficker", href: "/trafficker", icon: "Target", section: "workspace" },
  { label: "Creativos", href: "/creativos", icon: "Palette", section: "workspace" },
  { label: "Historial", href: "/historial", icon: "History", section: "workspace" },
  { label: "Carga de datos", href: "/upload", icon: "Upload", section: "ops" },
  { label: "Configuración", href: "/settings", icon: "Settings", section: "ops" },
];
