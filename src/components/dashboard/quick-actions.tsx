"use client"

import Link from 'next/link'
import { UserPlus, Radio, Zap } from 'lucide-react'
import type { ComponentType } from 'react'

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
}

const ACTIONS: Action[] = [
  { label: 'New Contact', href: '/contacts', icon: UserPlus, tint: 'text-[#1c69d4]' },
  { label: 'New Broadcast', href: '/broadcasts/new', icon: Radio, tint: 'text-[#ff9500]' },
  { label: 'New Automation', href: '/automations/new', icon: Zap, tint: 'text-[#af52de]' },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-none border border-border bg-card px-4 py-3 transition-all active:scale-[0.97] hover:bg-secondary"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-none bg-secondary ${a.tint}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{a.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
