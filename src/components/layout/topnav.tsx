"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { UploadCloud, Sparkles, Play, Cpu } from "lucide-react";

// AI navigation items for the top navigation bar
const aiNavItems = [
  { href: "/ai/upload", label: "Upload Training Data", icon: UploadCloud },
  { href: "/ai/personality", label: "Personality Profile", icon: Sparkles },
  { href: "/ai/playground", label: "Testing Playground", icon: Play },
  { href: "/ai/settings", label: "AI Settings", icon: Cpu },
];

export function TopNav() {
  return (
    <nav className="bg-[#1d1d1f] border-b border-[#333333] px-4 py-2 flex items-center overflow-x-auto">
      <ul className="flex space-x-4">
        {aiNavItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white",
                "dark:text-sidebar-foreground/75 dark:hover:bg-[#333333] dark:hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
