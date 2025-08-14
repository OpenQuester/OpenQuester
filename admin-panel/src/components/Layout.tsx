import {
  Activity,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Moon,
  MoonStar,
  Sun,
  Users,
} from "lucide-react";
import { memo, type ReactNode, useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { IconButton } from "@/components/common/IconButton";
import { NotificationsBell } from "@/components/common/NotificationsBell";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeMode, useTheme } from "@/contexts/ThemeContext";

interface LayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

const NAV_ITEMS: ReadonlyArray<NavigationItem> = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/users", icon: Users },
  { name: "System Health", href: "/system", icon: Activity },
] as const;

const NavItem = memo(
  ({
    item,
    active,
    collapsed,
    onNavigate,
  }: {
    item: NavigationItem;
    active: boolean;
    collapsed: boolean;
    onNavigate?: () => void;
  }) => (
    <Link
      to={item.href}
      className={`nav-link group relative ${
        active ? "nav-link-active" : "nav-link-inactive"
      }`}
      title={collapsed ? item.name : undefined}
      onClick={onNavigate}
    >
      <item.icon
        className={`h-6 w-6 flex-shrink-0 ${collapsed ? "mx-auto" : "mr-3"}`}
      />
      {!collapsed && (
        <>
          <span className="truncate">{item.name}</span>
          {item.badge && (
            <span className="ml-auto badge badge-primary">{item.badge}</span>
          )}
        </>
      )}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-60">
          {item.name}
        </div>
      )}
    </Link>
  )
);
NavItem.displayName = "NavItem";

export const Layout = ({ children }: LayoutProps) => {
  const { user } = useAuth();
  const { mode, toggleMode } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Render immediately; avoid blank screen during hydration. If SSR introduced, gate only unsafe parts.
  const [mounted] = useState(true);

  const toggleSidebar = () => {
    setSidebarCollapsed((s) => !s);
  };

  const closeMobile = useCallback(() => setSidebarOpen(false), []);

  const navItems = NAV_ITEMS; // constant reference
  const currentPath = location.pathname;
  const isActive = useCallback(
    (href: string) =>
      currentPath === href ||
      (href !== "/" && currentPath.startsWith(href + "/")),
    [currentPath]
  );

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg bg-diagonal-lines bg-vignette text-primaryText relative overflow-hidden">
      {/* Global subtle diagonal background pattern applied via utility class (see index.css). */}

      {/* Mobile sidebar overlay - blur background */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 flex z-50 lg:hidden">
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-surface shadow-xl animate-slide-up">
            {/* Mobile sidebar content */}
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4 mb-8">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">OQ</span>
                </div>
                <h1 className="ml-3 text-xl font-bold text-primaryText">
                  OpenQuester
                </h1>
              </div>

              <nav className="mt-5 px-2 space-y-1">
                {navItems.map((item) => (
                  <NavItem
                    key={item.name}
                    item={item}
                    active={isActive(item.href)}
                    collapsed={false}
                    onNavigate={closeMobile}
                  />
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 transition-all duration-300 ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-64"
        } z-50`}
      >
        <div className="flex-1 flex flex-col min-h-0 bg-surface border-r border-border shadow-sm">
          {/* Sidebar header */}
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-disabled">
            <div className="flex items-center flex-shrink-0 px-4 mb-8">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">OQ</span>
              </div>
              {!sidebarCollapsed && (
                <h1 className="ml-3 text-xl font-bold text-primaryText animate-fade-in">
                  OpenQuester
                </h1>
              )}
            </div>

            {/* Navigation */}
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navItems.map((item) => (
                <NavItem
                  key={item.name}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={sidebarCollapsed}
                />
              ))}
            </nav>
          </div>

          {/* Sidebar toggle button */}
          <div className="flex-shrink-0 p-4 border-t border-border">
            <button
              onClick={toggleSidebar}
              aria-label={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              aria-expanded={!sidebarCollapsed}
              className="w-full flex items-center justify-center p-2 text-secondaryText hover:text-primaryText hover:bg-hover rounded-lg transition-colors focus-ring"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <>
                  <ChevronLeft className="h-5 w-5 mr-2" />
                  <span className="text-sm">Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main content wrapper (accounts for sidebar + fixed header) */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
        } relative z-10`}
      >
        {/* Mobile header */}
        <div className="lg:hidden bg-surface border-b border-border shadow-sm">
          <div className="flex items-center justify-between h-16 px-4">
            <IconButton
              ariaLabel="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="text-secondaryText hover:text-primaryText hover:bg-hover"
            >
              <Menu className="h-6 w-6" />
            </IconButton>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-primary-500 to-primary-700 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-xs">OQ</span>
              </div>
              <span className="text-lg font-semibold text-primaryText">
                OpenQuester
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                aria-label="Toggle theme"
                onClick={toggleMode}
                className="rounded-lg p-2 text-secondaryText hover:text-primaryText hover:bg-hover transition-colors focus-ring"
                title="Toggle theme"
              >
                {mode === ThemeMode.LIGHT && <Moon className="h-5 w-5" />}
                {mode === ThemeMode.DARK && <MoonStar className="h-5 w-5" />}
                {mode === ThemeMode.PURE_DARK && <Sun className="h-5 w-5" />}
              </button>
              <NotificationsBell />
            </div>
          </div>
        </div>

        {/* Desktop header (fixed, spans full width, shifts with sidebar) */}
        <div
          className={`hidden lg:flex fixed top-0 right-0 h-16 items-center justify-between backdrop-blur-sm bg-surface/80 border-b border-border shadow-sm transition-all duration-300 px-6 lg:px-8 ${
            sidebarCollapsed ? "left-20" : "left-64"
          } z-30`}
        >
          <div className="flex items-center">
            <h2 className="text-lg font-semibold text-primaryText">
              Admin Panel
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <button
              aria-label="Toggle theme"
              onClick={toggleMode}
              className="rounded-lg p-2 text-secondaryText hover:text-primaryText hover:bg-hover transition-colors focus-ring"
              title="Toggle theme"
            >
              {mode === ThemeMode.LIGHT && <Moon className="h-5 w-5" />}
              {mode === ThemeMode.DARK && <MoonStar className="h-5 w-5" />}
              {mode === ThemeMode.PURE_DARK && <Sun className="h-5 w-5" />}
            </button>
            <NotificationsBell />
            <div className="flex items-center space-x-3 pl-3 border-l border-border">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {user?.username?.charAt(0)?.toUpperCase() || "A"}
                  </span>
                </div>
                <div className="hidden xl:block">
                  <p className="text-sm font-medium text-primaryText">
                    {user?.username || "Admin"}
                  </p>
                  <p className="text-xs text-mutedText">Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 animate-fade-in">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
