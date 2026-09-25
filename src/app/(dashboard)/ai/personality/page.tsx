'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, MessageSquare, AlertCircle, LayoutGrid, Heart, Plus, Trash2, X, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PersonalityProfile } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AIPersonalityPage() {
  const [profile, setProfile] = useState<PersonalityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Custom Emoji Editing States
  const [isEditingEmojis, setIsEditingEmojis] = useState(false);
  const [tempEmojiHabits, setTempEmojiHabits] = useState<Record<string, number>>({});
  const [newEmoji, setNewEmoji] = useState('');
  const [newEmojiFreq, setNewEmojiFreq] = useState(3);
  const [savingEmojis, setSavingEmojis] = useState(false);

  // Custom Vocabulary Editing States
  const [isEditingVocab, setIsEditingVocab] = useState(false);
  const [tempGreetings, setTempGreetings] = useState<string[]>([]);
  const [tempPhrases, setTempPhrases] = useState<string[]>([]);
  const [tempLanguages, setTempLanguages] = useState<string[]>([]);
  const [newGreeting, setNewGreeting] = useState('');
  const [newPhrase, setNewPhrase] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [savingVocab, setSavingVocab] = useState(false);

  // Custom Summary/Style Editing States
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [tempSummary, setTempSummary] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

  const [profiles, setProfiles] = useState<PersonalityProfile[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>('');

  const openEmojiDialog = () => {
    setTempEmojiHabits(profile?.emoji_habits || {});
    setNewEmoji('');
    setNewEmojiFreq(3);
    setIsEditingEmojis(true);
  };

  const openVocabularyDialog = () => {
    setTempGreetings(profile?.slang_greetings || []);
    setTempPhrases(profile?.favorite_phrases || []);
    setTempLanguages(profile?.languages || []);
    setNewGreeting('');
    setNewPhrase('');
    setNewLanguage('');
    setIsEditingVocab(true);
  };

  const handleAddGreeting = () => {
    const val = newGreeting.trim();
    if (!val) return;
    if (tempGreetings.includes(val)) {
      toast.error('Greeting already exists');
      return;
    }
    setTempGreetings([...tempGreetings, val]);
    setNewGreeting('');
  };

  const handleDeleteGreeting = (val: string) => {
    setTempGreetings(tempGreetings.filter(g => g !== val));
  };

  const handleAddPhrase = () => {
    const val = newPhrase.trim();
    if (!val) return;
    if (tempPhrases.includes(val)) {
      toast.error('Catchphrase already exists');
      return;
    }
    setTempPhrases([...tempPhrases, val]);
    setNewPhrase('');
  };

  const handleDeletePhrase = (val: string) => {
    setTempPhrases(tempPhrases.filter(p => p !== val));
  };

  const handleAddLanguage = () => {
    const val = newLanguage.trim();
    if (!val) return;
    if (tempLanguages.includes(val)) {
      toast.error('Language/mix already exists');
      return;
    }
    setTempLanguages([...tempLanguages, val]);
    setNewLanguage('');
  };

  const handleDeleteLanguage = (val: string) => {
    setTempLanguages(tempLanguages.filter(l => l !== val));
  };

  const handleSaveVocab = async () => {
    setSavingVocab(true);
    try {
      const res = await fetch('/api/ai/personality', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: selectedContact || undefined,
          slang_greetings: tempGreetings,
          favorite_phrases: tempPhrases,
          languages: tempLanguages,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProfiles();
        setIsEditingVocab(false);
        toast.success('Vocabulary settings saved successfully!');
      } else {
        toast.error(data.error || 'Failed to save vocabulary settings');
      }
    } catch (e) {
      toast.error('Error saving vocabulary settings');
    } finally {
      setSavingVocab(false);
    }
  };

  const openSummaryDialog = () => {
    setTempSummary(profile?.raw_analysis || '');
    setIsEditingSummary(true);
  };

  const handleSaveSummary = async () => {
    setSavingSummary(true);
    try {
      const res = await fetch('/api/ai/personality', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: selectedContact || undefined,
          raw_analysis: tempSummary,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProfiles();
        setIsEditingSummary(false);
        toast.success('Linguistic summary saved successfully!');
      } else {
        toast.error(data.error || 'Failed to save summary');
      }
    } catch (e) {
      toast.error('Error saving summary');
    } finally {
      setSavingSummary(false);
    }
  };

  const handleInitializeCustom = async () => {
    try {
      const res = await fetch('/api/ai/personality', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji_habits: { "😊": 5, "👍": 4 } }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile || null);
        setTempEmojiHabits(data.profile?.emoji_habits || { "😊": 5, "👍": 4 });
        setIsEditingEmojis(true);
      } else {
        toast.error('Failed to create custom profile');
      }
    } catch (e) {
      toast.error('Error creating custom profile');
    }
  };

  const handleSaveEmojis = async () => {
    setSavingEmojis(true);
    try {
      const res = await fetch('/api/ai/personality', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: selectedContact || undefined,
          emoji_habits: tempEmojiHabits
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProfiles();
        setIsEditingEmojis(false);
        toast.success('Emoji settings saved successfully!');
      } else {
        toast.error(data.error || 'Failed to save emoji settings');
      }
    } catch (e) {
      toast.error('Error saving emoji settings');
    } finally {
      setSavingEmojis(false);
    }
  };

  const handleDeleteEmoji = (emojiToDelete: string) => {
    const updated = { ...tempEmojiHabits };
    delete updated[emojiToDelete];
    setTempEmojiHabits(updated);
  };

  const handleUpdateEmojiFreq = (emoji: string, freq: number) => {
    setTempEmojiHabits({ ...tempEmojiHabits, [emoji]: freq });
  };

  const handleAddEmoji = () => {
    const trimmed = newEmoji.trim();
    if (!trimmed) {
      toast.error('Emoji cannot be empty');
      return;
    }
    if (trimmed.length > 4) {
      toast.error('Please enter a single emoji character');
      return;
    }
    if (tempEmojiHabits[trimmed]) {
      toast.error('Emoji already exists in your habits');
      return;
    }
    setTempEmojiHabits({ ...tempEmojiHabits, [trimmed]: newEmojiFreq });
    setNewEmoji('');
    setNewEmojiFreq(3);
  };

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/personality?list=true');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
        const active = data.profiles?.find((p: any) => (selectedContact ? p.contact_name === selectedContact : !p.contact_name));
        setProfile(active || null);
      }
    } catch (err) {
      console.error('Failed to load personality profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedContact]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleReanalyze = async () => {
    setReanalyzing(true);
    toast.info(`Re-running style analysis${selectedContact ? ` for ${selectedContact}` : ''}...`);
    try {
      const res = await fetch('/api/ai/personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: selectedContact || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Re-analysis failed');
      }
      toast.success('Linguistic profile updated!');
      fetchProfiles();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Style analysis failed.');
    } finally {
      setReanalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading personality profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
              <Sparkles className="h-6 w-6 text-primary" /> Personality Profile
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              This profile represents the learned messaging persona Gemini uses to draft and send replies.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            {profiles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Profile:</span>
                <select
                  value={selectedContact}
                  onChange={(e) => setSelectedContact(e.target.value)}
                  className="bg-card border border-border text-sm rounded-none p-2 h-9 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                >
                  <option value="">General (Default)</option>
                  {profiles
                    .filter(p => p.contact_name)
                    .map(p => (
                      <option key={p.id} value={p.contact_name || ''}>{p.contact_name}</option>
                    ))}
                </select>
              </div>
            )}
            {profile && (
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing}
                className="btn-bmw-primary self-start flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className={reanalyzing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                {reanalyzing ? 'Re-analyzing...' : 'Re-analyze Style'}
              </button>
            )}
          </div>
        </div>

        {!profile ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-xl mx-auto space-y-6 my-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">No Personality Profile Found</h3>
              <p className="text-sm text-muted-foreground">
                You need to upload at least one WhatsApp chat export text file before we can compile a communication profile.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Link
                href="/ai/upload"
                className="btn-bmw-primary inline-flex items-center gap-2"
              >
                Upload Chat Data
              </Link>
              <button
                onClick={handleInitializeCustom}
                className="rounded-none border border-border bg-background px-6 py-3 text-sm font-bold uppercase hover:bg-secondary text-foreground transition-all cursor-pointer"
              >
                Customize Emojis Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Persona Summary */}
            <div className="md:col-span-3 rounded-none border border-border bg-secondary/80 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-primary">Linguistic Summary</h2>
                {profile && (
                  <button
                    onClick={openSummaryDialog}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Customize Style
                  </button>
                )}
              </div>
              <p className="text-foreground text-base leading-relaxed italic font-medium">
                &ldquo;{profile.raw_analysis || "Custom communication style profile configured manually."}&rdquo;
              </p>
            </div>

            {/* Gauges Column */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Style Metrics</h3>
              
              {/* Formality */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Formality</span>
                  <span className="font-semibold text-primary">
                    {profile.formality < 0.3 ? 'Casual / Slang' : profile.formality > 0.7 ? 'Formal / Polite' : 'Conversational'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary relative overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: `${(profile.formality ?? 0.5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Street / Slang</span>
                  <span>Corporate</span>
                </div>
              </div>

              {/* Humor Level */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Humor Index</span>
                  <span className="font-semibold text-[#ff2d55]">{((profile.humor_sarcasm?.humor || 0.5) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full bg-[#ff2d55] rounded-full" 
                    style={{ width: `${(profile.humor_sarcasm?.humor || 0.5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Sarcasm Level */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sarcasm Index</span>
                  <span className="font-semibold text-[#af52de]">{((profile.humor_sarcasm?.sarcasm || 0.5) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full bg-[#af52de] rounded-full" 
                    style={{ width: `${(profile.humor_sarcasm?.sarcasm || 0.5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Average Length */}
              <div className="pt-4 border-t border-border flex justify-between items-center">
                <div className="text-sm text-muted-foreground">Avg Response Word Count</div>
                <div className="text-2xl font-bold text-primary">{profile.average_length || 15} <span className="text-xs text-muted-foreground font-normal">words</span></div>
              </div>
            </div>

            {/* Favorite Phrases / Slang */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Vocabulary & Slang</h3>
                {profile && (
                  <button
                    onClick={openVocabularyDialog}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Customize
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium">Common Greetings</span>
                  <div className="flex flex-wrap gap-2">
                    {profile.slang_greetings && profile.slang_greetings.length > 0 ? (
                      profile.slang_greetings.map((greet, idx) => (
                        <span key={idx} className="rounded-lg bg-secondary border border-border px-3 py-1 text-xs text-foreground">
                          {greet}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">None configured</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium">Favorite Slang / Catchphrases</span>
                  <div className="flex flex-wrap gap-2">
                    {profile.favorite_phrases && profile.favorite_phrases.length > 0 ? (
                      profile.favorite_phrases.map((phrase, idx) => (
                        <span key={idx} className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1 text-xs text-primary">
                          &ldquo;{phrase}&rdquo;
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">None configured</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium">Language Mix</span>
                  <div className="flex flex-wrap gap-2">
                    {profile.languages && profile.languages.length > 0 ? (
                      profile.languages.map((lang, idx) => (
                        <span key={idx} className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs text-emerald-600">
                          {lang}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">None configured</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Emojis Habits */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Emoji habits</h3>
                <button
                  onClick={openEmojiDialog}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Customize
                </button>
              </div>
              
              <div className="space-y-4">
                {profile.emoji_habits && Object.keys(profile.emoji_habits).length > 0 ? (
                  Object.entries(profile.emoji_habits)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([emoji, freq]) => (
                      <div key={emoji} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{emoji}</span>
                          <span className="text-muted-foreground">Frequency Rank</span>
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((step) => (
                            <span 
                              key={step} 
                              className={`h-2.5 w-4 rounded-sm ${step <= freq ? 'bg-[#af52de]' : 'bg-secondary'}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Rarely uses emojis in replies.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customize Emojis Dialog */}
      <Dialog open={isEditingEmojis} onOpenChange={setIsEditingEmojis}>
        <DialogContent className="bg-popover border-border sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground font-semibold flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" /> Customize Emoji Habits
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define which emojis Gemini should favor and how frequently it should use them in replies (1 = rare, 5 = high).
            </DialogDescription>
          </DialogHeader>

          {/* Emoji List */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {/* Add New Emoji Form */}
            <div className="p-3 bg-secondary/30 border border-border rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Add Emoji</h4>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Emoji character</Label>
                  <Input
                    placeholder="e.g. 🔥"
                    value={newEmoji}
                    onChange={(e) => setNewEmoji(e.target.value)}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs text-muted-foreground">Frequency</Label>
                  <select
                    value={newEmojiFreq}
                    onChange={(e) => setNewEmojiFreq(parseInt(e.target.value))}
                    className="w-full bg-card border border-border text-sm rounded-lg p-2 h-9 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={1}>1 (Rare)</option>
                    <option value={2}>2 (Occasional)</option>
                    <option value={3}>3 (Frequent)</option>
                    <option value={4}>4 (Active)</option>
                    <option value={5}>5 (High)</option>
                  </select>
                </div>
                <Button onClick={handleAddEmoji} size="sm" className="bg-primary text-white h-9">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            {/* List of current emojis */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Habits</h4>
              {Object.keys(tempEmojiHabits).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No custom emojis defined yet.</p>
              ) : (
                <div className="divide-y divide-border max-h-[40vh] overflow-y-auto pr-1">
                  {Object.entries(tempEmojiHabits)
                    .sort((a, b) => b[1] - a[1])
                    .map(([emoji, freq]) => (
                      <div key={emoji} className="flex items-center justify-between py-2 gap-3">
                        <span className="text-2xl w-8 text-center">{emoji}</span>
                        <div className="flex-1 flex items-center justify-end gap-3">
                          <select
                            value={freq}
                            onChange={(e) => handleUpdateEmojiFreq(emoji, parseInt(e.target.value))}
                            className="bg-secondary border border-border text-xs rounded-lg p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value={1}>1 - Rare</option>
                            <option value={2}>2 - Occasional</option>
                            <option value={3}>3 - Frequent</option>
                            <option value={4}>4 - Active</option>
                            <option value={5}>5 - High</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEmoji(emoji)}
                            className="text-muted-foreground hover:text-red-650 hover:bg-red-50 h-8 w-8 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setIsEditingEmojis(false)}
              className="border-border text-muted-foreground hover:bg-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEmojis}
              disabled={savingEmojis}
              className="bg-primary hover:bg-primary/95 text-white"
            >
              {savingEmojis ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customize Vocabulary Dialog */}
      <Dialog open={isEditingVocab} onOpenChange={setIsEditingVocab}>
        <DialogContent className="bg-popover border-border sm:max-w-lg max-h-[85vh] flex flex-col rounded-none">
          <DialogHeader>
            <DialogTitle className="text-foreground font-semibold flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" /> Customize Vocabulary & Slang
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Configure greetings, catchphrases, and language settings that Gemini should match.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
            {/* Greetings Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Greetings</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Hey, Wassup, Hello"
                  value={newGreeting}
                  onChange={(e) => setNewGreeting(e.target.value)}
                  className="bg-card border-border text-foreground rounded-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGreeting();
                    }
                  }}
                />
                <Button onClick={handleAddGreeting} size="sm" className="bg-primary text-white h-9 rounded-none cursor-pointer">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tempGreetings.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No custom greetings defined</span>
                ) : (
                  tempGreetings.map((greet, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-secondary border border-border px-2.5 py-1 text-xs text-foreground rounded-none"
                    >
                      {greet}
                      <button
                        onClick={() => handleDeleteGreeting(greet)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Phrases Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Catchphrases / Slang</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. yaar, bhai, definitely, let me know"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  className="bg-card border-border text-foreground rounded-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPhrase();
                    }
                  }}
                />
                <Button onClick={handleAddPhrase} size="sm" className="bg-primary text-white h-9 rounded-none cursor-pointer">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tempPhrases.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No custom catchphrases defined</span>
                ) : (
                  tempPhrases.map((phrase, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs text-primary rounded-none"
                    >
                      &ldquo;{phrase}&rdquo;
                      <button
                        onClick={() => handleDeletePhrase(phrase)}
                        className="text-primary hover:text-primary-focus cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Language Mix Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Language Mix</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Hinglish, English, Hindi"
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  className="bg-card border-border text-foreground rounded-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLanguage();
                    }
                  }}
                />
                <Button onClick={handleAddLanguage} size="sm" className="bg-primary text-white h-9 rounded-none cursor-pointer">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tempLanguages.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No custom language mix defined</span>
                ) : (
                  tempLanguages.map((lang, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-600 rounded-none"
                    >
                      {lang}
                      <button
                        onClick={() => handleDeleteLanguage(lang)}
                        className="text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setIsEditingVocab(false)}
              className="border-border text-muted-foreground hover:bg-secondary rounded-none cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveVocab}
              disabled={savingVocab}
              className="bg-primary hover:bg-primary/95 text-white rounded-none cursor-pointer"
            >
              {savingVocab ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customize Linguistic Summary Dialog */}
      <Dialog open={isEditingSummary} onOpenChange={setIsEditingSummary}>
        <DialogContent className="bg-popover border-border sm:max-w-lg max-h-[85vh] flex flex-col rounded-none">
          <DialogHeader>
            <DialogTitle className="text-foreground font-semibold flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" /> Customize Linguistic Summary
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Describe your writing style, vocabulary preferences, guidelines, and rules for the AI double.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Style & Vocabulary Summary</Label>
              <textarea
                rows={10}
                placeholder="e.g. Speaks casually in English/Hinglish. Uses terms like 'bhai' and 'yaar'. Keeps answers short and direct. Avoids formal greetings."
                value={tempSummary}
                onChange={(e) => setTempSummary(e.target.value)}
                className="w-full bg-card border border-border p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded-none resize-none font-light leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setIsEditingSummary(false)}
              className="border-border text-muted-foreground hover:bg-secondary rounded-none cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSummary}
              disabled={savingSummary}
              className="bg-primary hover:bg-primary/95 text-white rounded-none cursor-pointer"
            >
              {savingSummary ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
