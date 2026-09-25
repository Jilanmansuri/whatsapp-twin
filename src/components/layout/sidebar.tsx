"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Radio,
  Zap,
  Settings,
  LogOut,
  User,
  X,
  UploadCloud,
  Sparkles,
  Play,
  Cpu,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
];

const aiNavItems = [
  { href: "/ai/upload", label: "Upload Training Data", icon: UploadCloud },
  { href: "/ai/personality", label: "Personality Profile", icon: Sparkles },
  { href: "/ai/playground", label: "Testing Playground", icon: Play },
  { href: "/ai/settings", label: "AI Settings", icon: Cpu },
];

const bottomNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const totalUnread = useTotalUnread();

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          // Mobile: fixed drawer that slides in from the left.
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-[#e6e6e6] bg-[#f7f7f7]",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: static, always visible — reset all the mobile framing.
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
        )}
        aria-label="Primary"
      >
        {/* Logo row. On mobile we put a close button here; on desktop the
            close button is hidden since the sidebar is always-visible. */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[#e6e6e6] px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-primary">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#262626] tracking-tight">
              Digital Twin
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-none text-[#6b6b6b] hover:bg-[#ebebeb] hover:text-[#262626] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              const showUnreadDot =
                item.href === "/inbox" && totalUnread > 0 && !isActive;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      // Taller on mobile so fingers can hit the row reliably (≥44px).
                      "flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.99] lg:py-2",
                      isActive
                        ? "bg-[#1c69d4]/10 text-[#1c69d4] font-bold"
                        : "text-[#6b6b6b] hover:bg-[#ebebeb] hover:text-[#262626]",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {showUnreadDot && (
                      <span
                        aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? "" : "s"}`}
                        className="relative flex h-2 w-2"
                      >
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1c69d4] opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1c69d4]" />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-[#e6e6e6]" />

          <div className="px-3 mb-2 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">
            AI Assistant
          </div>
          <ul className="flex flex-col gap-1 mb-4">
            {aiNavItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.99] lg:py-2",
                      isActive
                        ? "bg-[#1c69d4]/10 text-[#1c69d4] font-bold"
                        : "text-[#6b6b6b] hover:bg-[#ebebeb] hover:text-[#262626]",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-4 border-t border-[#e6e6e6]" />

          <ul className="flex flex-col gap-1">
            {bottomNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.99] lg:py-2",
                      isActive
                        ? "bg-[#1c69d4]/10 text-[#1c69d4] font-bold"
                        : "text-[#6b6b6b] hover:bg-[#ebebeb] hover:text-[#262626]",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-[#e6e6e6] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-none px-3 py-2 text-left transition-colors hover:bg-[#ebebeb] focus:bg-[#ebebeb] focus:outline-none">
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Avatar"}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#262626]">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="truncate text-xs text-[#6b6b6b]">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 bg-white text-[#262626] border border-[#e6e6e6] rounded-none shadow-lg"
            >
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-semibold text-[#262626]">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="truncate text-xs text-[#6b6b6b]">
                  {profile?.email ?? ""}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-[#e6e6e6]" />
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-[#262626] focus:bg-[#f7f7f7] focus:text-[#262626]"
                  />
                }
              >
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=whatsapp"
                    onClick={onClose}
                    className="text-[#262626] focus:bg-[#f7f7f7] focus:text-[#262626]"
                  />
                }
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#e6e6e6]" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-[#262626] focus:bg-[#f7f7f7] focus:text-[#262626]"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
