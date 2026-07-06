// src/components/AdminSidebar.tsx
import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { 
  Package, 
  ShoppingBag, 
  Users, 
  BarChart3, 
  MessageSquare,
  LayoutDashboard,
  Palette,
  Video,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  User,
  Phone,
  Moon,
  Sun,
  ExternalLink
} from "lucide-react";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";

interface AdminNavLinkProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  badge?: number;
  collapsed?: boolean;
  exact?: boolean;
  isSettings?: boolean;
  external?: boolean;
}

function AdminNavLink({ to, label, icon, activeIcon, badge, collapsed, exact = false, isSettings = false, external = false }: AdminNavLinkProps) {
  const location = useLocation();
  
  const isActive = exact 
    ? location.pathname === to 
    : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <Link
      to={to}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`relative flex items-center rounded-md py-1.5 text-sm transition-all ${
        isActive 
          ? "bg-secondary text-foreground font-medium" 
          : `text-muted-foreground hover:bg-secondary hover:text-foreground ${isSettings ? "settings-link" : ""}`
      } ${collapsed ? "justify-center" : "justify-start"} ${collapsed ? "px-2" : "px-3"}`}
      title={collapsed ? label : undefined}
    >
      {/* Icon - Fixed position using absolute */}
      <div className="absolute left-3 w-4 h-4 flex items-center justify-center">
        {isActive && activeIcon ? activeIcon : icon}
      </div>
      
      {/* Text - Slides in/out */}
      <div className={`text-xs transition-all duration-300 overflow-hidden whitespace-nowrap ml-7 ${
        collapsed 
          ? "max-w-0 opacity-0" 
          : "max-w-[200px] opacity-100"
      }`}>
        {label}
      </div>
      
      {/* External link indicator */}
      {!collapsed && external && (
        <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0 opacity-60" />
      )}
      
      {/* Badge - Only visible when expanded */}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-accent min-w-[18px] h-[18px] px-1.5 text-[9px] font-medium text-accent-foreground flex-shrink-0 ml-auto">
          {badge}
        </span>
      )}
      {/* Badge - Only visible when collapsed */}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-accent min-w-[16px] h-[16px] px-1 text-[8px] font-medium text-accent-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const location = useLocation();
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem("admin-sidebar-collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setUserProfile({ ...user, ...profile });
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowProfilePopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem("admin-sidebar-collapsed", String(newState));
  };

  const pendingOrdersCount = 3;
  const unreadChatsCount = 5;

  const getInitials = () => {
    if (!userProfile) return "U";
    const first = userProfile.first_name || "";
    const last = userProfile.last_name || "";
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    if (first) return first[0].toUpperCase();
    if (userProfile.email) return userProfile.email[0].toUpperCase();
    return "U";
  };

  const getDisplayName = () => {
    if (!userProfile) return "User";
    const first = userProfile.first_name || "";
    const last = userProfile.last_name || "";
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    return userProfile.email?.split("@")[0] || "User";
  };

  return (
    <aside 
      className={`border-r border-border bg-card h-[calc(100vh-4rem)] sticky top-16 transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      {/* Add style tag for settings hover */}
      <style>{`
        .settings-link:hover {
          color: hsl(var(--accent)) !important;
        }
      `}</style>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {/* Header with Logo and Collapse */}
        <div className={`px-3 mb-4 flex ${collapsed ? "justify-center" : "items-center"}`}>
          {/* Logo - Fixed position */}
          <div className="relative inline-block flex-shrink-0">
            <button onClick={toggleCollapse} className="block">
              <Logo className={`${collapsed ? "w-8 h-8" : "w-10 h-10"} transition-all duration-300`} />
            </button>
            <div
              className={`absolute rounded-full bg-background border border-border shadow-sm flex items-center justify-center transition-all duration-300 ${
                collapsed 
                  ? "-bottom-1 -right-1 w-5 h-5" 
                  : "-bottom-1 -right-1 w-5 h-5"
              }`}
            >
              {collapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronLeft className="w-3 h-3" />
              )}
            </div>
          </div>
          {/* Text with smooth animation */}
          <div 
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              collapsed 
                ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100 ml-3"
            }`}
          >
            <div className="flex flex-col justify-center whitespace-nowrap">
              <h2 className="text-sm font-bold leading-tight font-mono tracking-tight">Clab Dashboard</h2>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-mono">Admin Console</span>
            </div>
          </div>
        </div>
        
        {/* Navigation - Icons with fixed absolute positioning */}
        <nav className="space-y-0.5 px-2 relative">
          <AdminNavLink 
            to="/admin" 
            label="Overview" 
            icon={<LayoutDashboard className="w-4 h-4" />}
            activeIcon={<LayoutDashboard className="w-4 h-4 fill-current" />}
            collapsed={collapsed}
            exact={true}
          />
          <AdminNavLink 
            to="/admin/products" 
            label="Products" 
            icon={<Package className="w-4 h-4" />}
            activeIcon={<Package className="w-4 h-4 fill-current" />}
            collapsed={collapsed}
          />
          <AdminNavLink 
            to="/admin/motifs" 
            label="Motifs" 
            icon={<Palette className="w-4 h-4" />}
            activeIcon={<Palette className="w-4 h-4 fill-current" />}
            collapsed={collapsed}
          />
          <AdminNavLink 
            to="/admin/analytics" 
            label="Analytics" 
            icon={<BarChart3 className="w-4 h-4" />}
            activeIcon={<BarChart3 className="w-4 h-4 fill-current" />}
            collapsed={collapsed}
          />
          <AdminNavLink 
            to="/admin/orders" 
            label="Orders" 
            icon={<ShoppingBag className="w-4 h-4" />}
            activeIcon={<ShoppingBag className="w-4 h-4 fill-current" />}
            badge={pendingOrdersCount}
            collapsed={collapsed}
          />
          
          {/* "More" Divider */}
          <div className={`flex items-center ${collapsed ? "justify-center" : "px-3"} py-1.5`}>
            <div className={`${collapsed ? "w-4" : "flex-1"} h-px bg-border`} />
            <span className={`text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40 transition-all duration-300 ${
              collapsed ? "max-w-0 opacity-0 mx-0" : "max-w-[40px] opacity-100 mx-2"
            }`}>
              More
            </span>
            <div className={`${collapsed ? "w-4" : "flex-1"} h-px bg-border`} />
          </div>
          
          <AdminNavLink 
            to="/admin/users" 
            label="Users" 
            icon={<Users className="w-4 h-4" />}
            activeIcon={<Users className="w-4 h-4 fill-current" />}
            collapsed={collapsed}
          />
          <AdminNavLink 
            to="/admin/chats" 
            label="Chat" 
            icon={<MessageSquare className="w-4 h-4" />}
            activeIcon={<MessageSquare className="w-4 h-4 fill-current" />}
            badge={unreadChatsCount}
            collapsed={collapsed}
          />
          <AdminNavLink 
            to="/admin/tutorials" 
            label="Tutorials" 
            icon={<Video className="w-4 h-4" />}
            activeIcon={<Video className="w-4 h-4 fill-current" />}
            collapsed={collapsed}
          />
          <AdminNavLink 
            to="/admin/ai" 
            label="AI Assistant" 
            icon={<Sparkles className="w-4 h-4" />}
            activeIcon={<Sparkles className="w-4 h-4 fill-current" />}
            collapsed={collapsed}
          />
          <AdminNavLink 
            to="/account" 
            label="Settings" 
            icon={<Settings className="w-4 h-4" />}
            activeIcon={<Settings className="w-4 h-4 fill-current" />}
            collapsed={collapsed}
            isSettings={true}
            external={true}
          />
        </nav>
      </div>

      {/* Footer - User Profile */}
      <div className="border-t border-border p-2 relative" style={{ zIndex: 99998 }}>
        <button
          ref={buttonRef}
          onClick={() => setShowProfilePopup(!showProfilePopup)}
          className={`relative flex items-center rounded-md py-1.5 text-sm transition-all w-full ${
            collapsed ? "justify-center" : "justify-start"
          } ${collapsed ? "px-2" : "px-3"}`}
        >
          {/* Profile Picture - Fixed position using absolute */}
          <div className="absolute left-3 flex-shrink-0">
            {userProfile?.avatar_url ? (
              <img 
                src={userProfile.avatar_url} 
                alt={getDisplayName()}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium">
                {getInitials()}
              </div>
            )}
          </div>
          {/* Name - Slides in/out */}
          <div className={`text-xs truncate text-left transition-all duration-300 overflow-hidden whitespace-nowrap ml-9 ${
            collapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"
          }`}>
            {getDisplayName()}
          </div>
        </button>

        {/* Profile Popup */}
        {showProfilePopup && (
          <div 
            ref={popupRef}
            className="fixed z-[99999] bg-card border border-border rounded-lg shadow-2xl p-4 min-w-[260px]"
            style={{
              maxWidth: "280px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              bottom: "80px",
              left: "12px",
              position: "fixed",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              {userProfile?.avatar_url ? (
                <img 
                  src={userProfile.avatar_url} 
                  alt={getDisplayName()}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-medium">
                  {getInitials()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getDisplayName()}</p>
                <p className="text-xs text-muted-foreground truncate">{userProfile?.email || ""}</p>
              </div>
            </div>
            
            {userProfile?.phone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Phone className="w-3 h-3" />
                <span>{userProfile.phone}</span>
              </div>
            )}
            
            <div className="border-t border-border my-2 pt-2 space-y-1">
              <Link
                to="/account"
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-secondary transition-colors"
                onClick={() => setShowProfilePopup(false)}
              >
                <User className="w-3 h-3" />
                Your Account
              </Link>
              <button
                onClick={() => {
                  const isDark = document.documentElement.classList.contains('dark');
                  const newTheme = isDark ? 'light' : 'dark';
                  document.documentElement.classList.toggle('dark', !isDark);
                  localStorage.setItem('clab.theme', newTheme);
                  setShowProfilePopup(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-secondary transition-colors"
              >
                {document.documentElement.classList.contains('dark') ? (
                  <>
                    <Sun className="w-3 h-3" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-3 h-3" />
                    Dark Mode
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}