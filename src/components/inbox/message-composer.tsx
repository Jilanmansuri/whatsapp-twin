"use client";

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from "react";
import { Send, LayoutTemplate, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (text: string) => void;
  onOpenTemplates: () => void;
  lastCustomerMessageText?: string;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onOpenTemplates,
  lastCustomerMessageText = "",
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Suggestion State
  const [suggestion, setSuggestion] = useState("");
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchSuggestion() {
      if (!lastCustomerMessageText) {
        setSuggestion("");
        return;
      }

      try {
        const settingsRes = await fetch('/api/ai/settings');
        if (!settingsRes.ok) return;
        const settingsData = await settingsRes.json();

        if (
          settingsData.success &&
          settingsData.settings?.has_key &&
          settingsData.settings?.auto_reply_mode === 'suggest'
        ) {
          if (!active) return;
          setLoadingSuggestion(true);
          setSuggestion("");

          const genRes = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: lastCustomerMessageText,
              conversation_id: conversationId,
            }),
          });

          if (!genRes.ok) throw new Error('Failed to fetch suggestion');
          const genData = await genRes.json();

          if (active && genData.success && genData.reply) {
            setSuggestion(genData.reply);
          }
        }
      } catch (err) {
        console.error('Failed fetching AI suggestion:', err);
      } finally {
        if (active) {
          setLoadingSuggestion(false);
        }
      }
    }

    fetchSuggestion();

    return () => {
      active = false;
    };
  }, [conversationId, lastCustomerMessageText]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  return (
    <div className="border-t border-border bg-card p-3">
      {/* AI Suggestion Banner */}
      {loadingSuggestion && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-1.5 animate-pulse">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
          <p className="text-xs text-primary">Drafting AI response style...</p>
        </div>
      )}

      {!loadingSuggestion && suggestion && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-primary/5 border border-primary/15 px-3 py-1.5 transition-all">
          <div className="flex-1 text-xs text-foreground pr-4">
            <span className="font-semibold text-primary flex items-center gap-1 mb-0.5">
              <Sparkles className="h-3 w-3" /> AI Suggestion:
            </span>
            &ldquo;{suggestion}&rdquo;
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-white shrink-0"
            onClick={() => {
              setText(suggestion);
              setTimeout(() => {
                textareaRef.current?.focus();
                adjustHeight();
              }, 50);
            }}
          >
            Use suggestion
          </Button>
        </div>
      )}

      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200/40 px-3 py-2">
          <p className="text-xs text-amber-700">
            24-hour session expired. Use a template to re-engage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-700 hover:text-amber-600 hover:bg-amber-100/50"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Templates
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          onClick={onOpenTemplates}
          title="Send template"
        >
          <LayoutTemplate className="h-4 w-4" />
        </Button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            sessionExpired
              ? "Session expired - use a template"
              : "Type a message... (Shift+Enter for new line)"
          }
          disabled={sessionExpired}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50",
            sessionExpired && "cursor-not-allowed opacity-50"
          )}
        />

        <Button
          size="sm"
          className="h-9 w-9 shrink-0 bg-primary p-0 hover:bg-primary/95 text-white disabled:opacity-40"
          disabled={!text.trim() || sessionExpired || sending}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Hint sits outside the flex row so its height doesn't push
          `items-end` buttons below the textarea. Indented to line up
          under the textarea left edge (w-9 button + gap-2 = 44px). */}
      <p className="mt-1 pl-11 text-[10px] text-muted-foreground">
        Type &apos;/&apos; for quick replies
      </p>
    </div>
  );
}
