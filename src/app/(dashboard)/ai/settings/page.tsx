'use client';

import { useState, useEffect } from 'react';
import { Cpu, Key, Sliders, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsData {
  provider: 'gemini' | 'openai';
  api_key: string;
  temperature: number;
  auto_reply_mode: 'off' | 'suggest' | 'auto';
  has_key: boolean;
}

export default function AISettingsPage() {
  const [provider, setProvider] = useState<'gemini' | 'openai'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [autoReplyMode, setAutoReplyMode] = useState<'off' | 'suggest' | 'auto'>('off');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/ai/settings');
        if (res.ok) {
          const data = await res.json();
          const s: SettingsData = data.settings;
          setProvider(s.provider);
          setTemperature(s.temperature);
          setAutoReplyMode(s.auto_reply_mode);
          setHasKey(s.has_key);
          if (s.has_key) {
            setApiKey(s.api_key); // Masked key
          }
        }
      } catch (err) {
        console.error('Failed to load AI settings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          api_key: apiKey,
          temperature,
          auto_reply_mode: autoReplyMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings.');
      }

      toast.success('AI Settings updated successfully!');
      setHasKey(data.settings.has_key);
      setApiKey(data.settings.api_key);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading AI settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <Cpu className="h-6 w-6 text-primary" /> AI Settings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure LLM credentials, adjust creativity temperature, and toggle automated WhatsApp response loops.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Provider and API Keys Card */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Key className="h-5 w-5 text-primary" /> LLM Credentials
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">LLM Provider</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setProvider('gemini')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-semibold transition-all ${
                      provider === 'gemini'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Google Gemini 3.1 Flash-Lite
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary p-4 text-sm font-semibold text-muted-foreground/60 cursor-not-allowed"
                  >
                    OpenAI GPT-4o-mini (Disabled)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Google Gemini API Key</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder={hasKey ? '••••••••••••••••••••••••' : 'Enter AI-zaSy... key'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card pl-4 pr-12 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {hasKey && (
                    <div className="absolute inset-y-0 right-3 flex items-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Used exclusively to run linguistic analyses and generate replies. Kept secure and private.
                </p>
              </div>
            </div>
          </div>

          {/* Model settings */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Sliders className="h-5 w-5 text-primary" /> Style Parameters
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium text-muted-foreground">Creativity (Temperature)</label>
                  <span className="font-semibold text-primary">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-primary bg-secondary h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Literal & Consistent</span>
                  <span>Creative & Varied</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-reply loop selection */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-5 w-5 text-primary" /> Auto Reply Mode
            </h2>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {/* OFF */}
                <button
                  type="button"
                  onClick={() => setAutoReplyMode('off')}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all ${
                    autoReplyMode === 'off'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">OFF</span>
                  <span className="text-xs text-muted-foreground leading-normal">
                    AI replies are disabled. You type everything manually.
                  </span>
                </button>

                {/* SUGGEST */}
                <button
                  type="button"
                  onClick={() => setAutoReplyMode('suggest')}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all ${
                    autoReplyMode === 'suggest'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">Suggest Drafts</span>
                  <span className="text-xs text-muted-foreground leading-normal">
                    AI drafts a reply in your message field. You review/edit before sending.
                  </span>
                </button>

                {/* AUTO */}
                <button
                  type="button"
                  onClick={() => setAutoReplyMode('auto')}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all ${
                    autoReplyMode === 'auto'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">Full Auto-Send</span>
                  <span className="text-xs text-muted-foreground leading-normal">
                    AI automatically sends the reply as soon as an inbound WhatsApp message arrives.
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 btn-bmw-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Saving Configuration...
              </>
            ) : (
              'Save AI Settings'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
