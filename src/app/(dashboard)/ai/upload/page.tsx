'use client';

import { useState, useEffect, useCallback } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { TrainingUpload } from '@/types';

export default function AIUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [targetSender, setTargetSender] = useState('');
  const [contactName, setContactName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<TrainingUpload[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch upload logs history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/upload');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.uploads || []);
      }
    } catch (err) {
      console.error('Failed to load upload history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyzeProfile = async (uploadId: string, associatedContact?: string) => {
    setAnalyzing(true);
    toast.info('Gemini is analyzing communication style patterns. This may take 5-10 seconds...');
    
    try {
      const res = await fetch('/api/ai/personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_id: uploadId,
          contact_name: associatedContact || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed.');
      }

      toast.success('Linguistic personality profile successfully generated!');
      router.push('/ai/personality');
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Failed to generate profile.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a WhatsApp chat export .txt file.');
      return;
    }
    if (!targetSender.trim()) {
      toast.error('Please enter the exact sender name you want to mimic.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target_sender', targetSender.trim());
    if (contactName.trim()) {
      formData.append('contact_name', contactName.trim());
    }

    try {
      const res = await fetch('/api/ai/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse file.');
      }

      toast.success(`Successfully parsed ${data.pairsCount} incoming-reply messaging pairs!`);
      setFile(null);
      setTargetSender('');
      setContactName('');
      fetchHistory();
      
      // Auto-trigger the profile analysis!
      await handleAnalyzeProfile(data.upload.id, contactName.trim());
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Upload Training Data</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Export a WhatsApp chat without media, upload the .txt file, and configure the target name to teach your double how to reply.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Upload Card */}
          <div className="md:col-span-2 rounded-2xl border border-border bg-card p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Parser Configuration</h2>
            
            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Target Sender Name (Exact Case Sensitive)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nitish Kumar JH or Mummy"
                  value={targetSender}
                  onChange={(e) => setTargetSender(e.target.value)}
                  className="w-full rounded-none border border-border bg-card px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the exact display name of the person you want to mimic as it appears in the chat file logs.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Associated WhatsApp Contact Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Father, Brother, Friend"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-none border border-border bg-card px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  If this chat is with a specific contact, enter the exact name saved on WhatsApp. Auto-reply will use this style only for this contact.
                </p>
              </div>

              {/* Drag and drop zone */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">WhatsApp Export File (.txt)</label>
                <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-8 text-center transition-all hover:border-primary/50">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileChange}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <UploadCloud className="h-10 w-10 text-primary mb-3" />
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-primary flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" /> {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-foreground">
                        Drag and drop or <span className="text-primary font-medium">browse</span> your file
                      </p>
                      <p className="text-xs text-muted-foreground">Only WhatsApp export .txt files are supported</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !file || !targetSender}
                className="w-full flex items-center justify-center gap-2 btn-bmw-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Parsing & Extracting...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" /> Start Upload and Parsing
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Guide Card */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-primary">How to get chat data</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary font-bold">1.</span>
                Open WhatsApp on your phone and enter the chat conversation you want to export.
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">2.</span>
                Tap the menu button (settings/dots) and select **More → Export Chat**.
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">3.</span>
                Choose **Without Media** to download a clean text file of the conversation history.
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">4.</span>
                Upload the resulting `.txt` file here and type the exact name of the responder.
              </li>
            </ul>
          </div>
        </div>

        {/* Upload History Table */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Training Logs History</h2>
            <button
              onClick={fetchHistory}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Refresh logs
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading history logs...</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No training data files uploaded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full border-collapse text-left text-sm text-foreground">
                <thead className="bg-secondary text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3">File name</th>
                    <th className="px-4 py-3">Date uploaded</th>
                    <th className="px-4 py-3">Parsed pairs</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{log.filename}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-primary">
                        {log.parsed_pairs_count || 0} pairs
                      </td>
                      <td className="px-4 py-3">
                        {log.status === 'parsed' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Parsed successfully
                          </span>
                        ) : log.status === 'failed' ? (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 cursor-help"
                            title={log.error_message || 'Unknown parsing error'}
                          >
                            <AlertCircle className="h-3.5 w-3.5" /> Failed: {log.error_message || 'Error'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-amber-650 animate-pulse">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {log.status === 'parsed' && (
                          <button
                            onClick={() => handleAnalyzeProfile(log.id)}
                            disabled={analyzing}
                            className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {analyzing ? (
                              <>
                                <RefreshCw className="h-3 w-3 animate-spin" /> Analyzing Style...
                              </>
                            ) : (
                              <>
                                Analyze Style <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



