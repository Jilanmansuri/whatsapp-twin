/**
 * Shared status badge config for broadcasts + recipients.
 *
 * Previously `statusConfig` was defined inline in both
 * /broadcasts/page.tsx and /broadcasts/[id]/page.tsx with slight
 * drift risk. One source of truth now.
 *
 * Dark-theme only — bg-*-500/10 + text-*-400 + border-*-500/20.
 */

import type { BroadcastStatus, RecipientStatus } from "@/types";

export interface StatusDisplay {
  label: string;
  classes: string;
  /**
   * Set true for statuses that should pulse in the UI to convey
   * "live / in-flight" — currently only `sending`.
   */
  pulse?: boolean;
}

export const broadcastStatusConfig: Record<BroadcastStatus, StatusDisplay> = {
  draft: {
    label: "Draft",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
  },
  scheduled: {
    label: "Scheduled",
    classes: "bg-blue-50 text-blue-600 border-blue-200/60",
  },
  sending: {
    label: "Sending",
    classes: "bg-amber-50 text-amber-700 border-amber-200/60",
    pulse: true,
  },
  sent: {
    label: "Sent",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  },
  failed: {
    label: "Failed",
    classes: "bg-red-50 text-red-650 border-red-200/60",
  },
};

export const recipientStatusConfig: Record<RecipientStatus, StatusDisplay> = {
  pending: {
    label: "Pending",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
  },
  sent: {
    label: "Sent",
    classes: "bg-blue-50 text-blue-600 border-blue-200/60",
  },
  delivered: {
    label: "Delivered",
    classes: "bg-teal-50 text-teal-700 border-teal-200/60",
  },
  read: {
    label: "Read",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  },
  replied: {
    label: "Replied",
    classes: "bg-purple-50 text-purple-700 border-purple-200/60",
  },
  failed: {
    label: "Failed",
    classes: "bg-red-50 text-red-650 border-red-200/60",
  },
};

/**
 * Tolerant lookup — callers often have a generic string status
 * coming from Supabase. Falls back to the "draft" / "pending"
 * entry so the UI never crashes on an unknown value.
 */
export function getBroadcastStatus(status: string): StatusDisplay {
  return (
    broadcastStatusConfig[status as BroadcastStatus] ??
    broadcastStatusConfig.draft
  );
}

export function getRecipientStatus(status: string): StatusDisplay {
  return (
    recipientStatusConfig[status as RecipientStatus] ??
    recipientStatusConfig.pending
  );
}
