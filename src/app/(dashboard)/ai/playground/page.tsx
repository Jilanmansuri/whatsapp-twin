'use client';

import { useState } from 'react';
import { Play, Sparkles, Clock, Percent, ShieldCheck, Database, HelpCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AIPlaygroundPage() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [memories, setMemories] = useState<string[]>([]);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter a message to test.');
      return;
    }

    setLoading(true);
    setResponse(null);
    setLatency(null);
    setConfidence(null);
    setMemories([]);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI reply.');
      }

      setResponse(data.reply);
      setLatency(data.latencyMs);
      setConfidence(data.confidence * 100);
      setMemories(data.retrievedMemories || []);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Testing Playground</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Type any incoming message below to test how your AI double responds. View metrics, retrieved memory associations, and latency in real-time.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Input Box Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <Play className="h-5 w-5 text-primary" /> Live Simulation
              </h2>

              <form onSubmit={handleTest} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Incoming Message</label>
                  <textarea
                    rows={4}
                    placeholder="Type a message (e.g. 'Bhai kab aaoge?', 'Wassup?', 'Are you busy?')"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-none border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="w-full flex items-center justify-center gap-2 btn-bmw-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Thinking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Simulate AI Response
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Generated Output Card */}
            {response && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4 animate-fade-in">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">AI Double Output</h2>
                <div className="rounded-xl bg-secondary border border-border p-5 text-lg font-semibold text-primary">
                  {response}
                </div>
              </div>
            )}
          </div>

          {/* Metrics & Memories Sidebar */}
          <div className="space-y-6">
            {/* Metrics */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Engine Metrics</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-secondary p-3 space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Latency
                  </span>
                  <div className="text-lg font-bold text-foreground">
                    {latency !== null ? `${latency} ms` : '--'}
                  </div>
                </div>

                <div className="rounded-xl bg-secondary p-3 space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Percent className="h-3.5 w-3.5" /> Confidence
                  </span>
                  <div className="text-lg font-bold text-foreground">
                    {confidence !== null ? `${confidence}%` : '--'}
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-secondary p-3 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Model Used</div>
                  <div className="text-sm font-bold text-foreground">gemini-1.5-flash</div>
                </div>
              </div>
            </div>

            {/* Memories */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Database className="h-4 w-4 text-primary" /> Context Memories
              </h3>
              
              {memories.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    The prompt builder used the following matching examples from the training data for style reference:
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {memories.map((mem, idx) => (
                      <div key={idx} className="rounded-lg border border-border bg-secondary p-2.5 text-xs text-foreground">
                        {mem}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No memories loaded yet. Run a simulation to fetch matching history.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
