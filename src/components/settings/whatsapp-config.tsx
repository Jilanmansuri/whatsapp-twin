'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  QrCode,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown' | 'qr_ready' | 'initializing' | 'error';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

export function WhatsAppConfig() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [providerType, setProviderType] = useState<'meta' | 'unofficial'>('meta');
  const [qrCode, setQrCode] = useState<string | null>(null);

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load config row:', error);
      }

      if (data) {
        setConfig(data);
        setProviderType(data.provider || 'meta');
        setPhoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(MASKED_TOKEN);
        setVerifyToken('');
        setTokenEdited(false);
        setQrCode(data.qr_code || null);
        
        if (data.provider === 'unofficial') {
            setConnectionStatus(data.status as ConnectionStatus);
        }
      } else {
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setTokenEdited(false);
        setQrCode(null);
        setProviderType('meta');
      }

      // Then verify health via the API (decrypts token + pings Meta) if using Meta
      if (data && (!data.provider || data.provider === 'meta')) {
        try {
          const res = await fetch('/api/whatsapp/config', { method: 'GET' });
          const payload = await res.json();

          if (payload.connected) {
            setConnectionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
          } else {
            setConnectionStatus('disconnected');
            setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
            setStatusMessage(payload.message || '');
          }
        } catch (err) {
          console.error('Health check failed:', err);
          setConnectionStatus('disconnected');
        }
      } else if (!data) {
        setConnectionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    if (fetchedUserIdRef.current === user.id) return;
    fetchedUserIdRef.current = user.id;
    fetchConfig(user.id);
  }, [authLoading, user?.id, fetchConfig]);

  // Listen for realtime updates for QR login
  useEffect(() => {
    if (!user?.id) return;
    const channelName = `wa-config-updates-${user.id}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_config', filter: `user_id=eq.${user.id}` }, (payload) => {
          const newConfig = payload.new as WhatsAppConfigType;
          if (newConfig.provider === 'unofficial') {
              setConfig(newConfig);
              setQrCode(newConfig.qr_code || null);
              setConnectionStatus(newConfig.status as ConnectionStatus);
              if (newConfig.status === 'connected') {
                  toast.success('WhatsApp connected successfully!');
              }
          }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

  // Poll while initializing so QR code appears immediately even if Realtime is delayed
  useEffect(() => {
    if (connectionStatus !== 'initializing' || !user?.id) return;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && data.status !== 'initializing') {
        setConfig(data);
        setQrCode(data.qr_code || null);
        setConnectionStatus(data.status as ConnectionStatus);
        if (data.status === 'connected') {
          toast.success('WhatsApp connected successfully!');
        }
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [connectionStatus, user?.id, supabase]);


  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error('Access Token is required for initial setup');
      return;
    }

    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
        provider: 'meta'
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        toast.error('Please re-enter the Access Token to save changes');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      toast.success(
        data.phone_info?.verified_name
          ? `Connected to ${data.phone_info.verified_name}`
          : 'Configuration saved successfully'
      );

      if (user) await fetchConfig(user.id);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleStartQRLogin() {
    try {
        setSaving(true);
        const res = await fetch('/api/whatsapp/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'unofficial' }),
        });
        if (res.ok) {
            toast.success('Initializing QR code session. Please wait...');
            if (user) await fetchConfig(user.id);
        } else {
            toast.error('Failed to initialize QR login.');
        }
    } catch (e) {
        console.error(e);
        toast.error('Failed to connect to server.');
    } finally {
        setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verified_name
            ? `Connected to ${payload.phone_info.verified_name}`
            : 'API connection successful'
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    if (!confirm('This will delete the current WhatsApp config so you can re-enter it. Continue?')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset configuration');
        return;
      }

      toast.success('Configuration cleared. You can now start fresh.');
      setConfig(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);
      setQrCode(null);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
      setProviderType('meta');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  return (
    <div className="mt-4">
      {/* Custom Tabs to avoid nesting conflicts */}
      <div className="flex w-full max-w-[400px] mb-8 p-1 bg-secondary/40 border border-border rounded-xl">
        <button
          onClick={() => setProviderType('meta')}
          className={`flex-1 flex items-center justify-center py-2 px-3 text-sm font-medium rounded-lg transition-all ${
            providerType === 'meta'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
        >
          <Smartphone className="size-4 mr-2" />
          Meta Cloud API
        </button>
        <button
          onClick={() => setProviderType('unofficial')}
          className={`flex-1 flex items-center justify-center py-2 px-3 text-sm font-medium rounded-lg transition-all ${
            providerType === 'unofficial'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
        >
          <QrCode className="size-4 mr-2" />
          Direct QR Login
        </button>
      </div>

      {providerType === 'meta' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              {/* Main config form */}
              <div className="space-y-6">
                {/* Corrupted-token reset banner */}
                {showResetBanner && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <AlertTitle className="text-amber-800 mb-1">
                          Stored token can&apos;t be decrypted
                        </AlertTitle>
                        <AlertDescription className="text-amber-800/90 text-sm">
                          {statusMessage}
                        </AlertDescription>
                        <Button
                          onClick={handleReset}
                          disabled={resetting}
                          size="sm"
                          className="mt-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                        >
                          {resetting ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Resetting...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="size-4" />
                              Reset Configuration
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Alert>
                )}

                {/* Connection Status */}
                <Alert className="bg-card border-border shadow-sm rounded-2xl">
                  <div className="flex items-center gap-2">
                    {connectionStatus === 'connected' ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : (
                      <XCircle className="size-4 text-red-500" />
                    )}
                    <AlertTitle className="text-foreground font-semibold mb-0">
                      {connectionStatus === 'connected' ? 'Connected' : 'Not Connected'}
                    </AlertTitle>
                  </div>
                  <AlertDescription className="text-muted-foreground mt-1">
                    {connectionStatus === 'connected'
                      ? 'Your WhatsApp Business API is connected and ready to send/receive messages.'
                      : statusMessage ||
                        'Configure your Meta API credentials below to connect your WhatsApp Business account.'}
                  </AlertDescription>
                </Alert>

                {/* API Credentials */}
                <Card className="bg-card border-border ring-0 ring-transparent rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-foreground font-semibold">API Credentials</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Enter your Meta WhatsApp Business API credentials.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">Phone Number ID</Label>
                      <Input
                        placeholder="e.g. 100234567890123"
                        value={phoneNumberId}
                        onChange={(e) => setPhoneNumberId(e.target.value)}
                        className="bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">WhatsApp Business Account ID</Label>
                      <Input
                        placeholder="e.g. 100234567890456"
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        className="bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">Permanent Access Token</Label>
                      <div className="relative">
                        <Input
                          type={showToken ? 'text' : 'password'}
                          placeholder="Enter your access token"
                          value={accessToken}
                          onChange={(e) => {
                            setAccessToken(e.target.value);
                            setTokenEdited(true);
                          }}
                          onFocus={() => {
                            if (accessToken === MASKED_TOKEN) {
                              setAccessToken('');
                              setTokenEdited(true);
                            }
                          }}
                          className="bg-card border-border text-foreground placeholder:text-muted-foreground pr-10 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {config && !tokenEdited && (
                        <p className="text-xs text-muted-foreground">
                          Token is hidden for security. Re-enter it to update configuration.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">Webhook Verify Token</Label>
                      <Input
                        placeholder="Create a custom verify token"
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value)}
                        className="bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground">
                        A custom string you create. Must match the token you set in Meta webhook settings.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Webhook URL */}
                <Card className="bg-card border-border ring-0 ring-transparent rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-foreground font-semibold">Webhook Configuration</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Use this URL as your webhook callback in the Meta App Dashboard.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">Webhook Callback URL</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={webhookUrl}
                          className="bg-card border-border text-foreground font-mono text-sm rounded-xl"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyWebhookUrl}
                          className="shrink-0 border-border text-foreground hover:bg-secondary rounded-xl"
                        >
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/95 text-white rounded-xl font-medium"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Configuration'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing || !config}
                    className="border-border text-foreground hover:bg-secondary rounded-xl"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="size-4" />
                        Test API Connection
                      </>
                    )}
                  </Button>
                  {config && (
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      disabled={resetting}
                      className="border-red-500/20 text-red-650 hover:bg-red-500/10 rounded-xl"
                    >
                      {resetting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="size-4" />
                          Reset Configuration
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Setup Instructions Sidebar */}
              <div>
                <Card className="bg-card border-border ring-0 ring-transparent rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-foreground font-semibold text-base">Setup Instructions</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Follow these steps to connect your WhatsApp Business API.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion>
                      <AccordionItem className="border-border">
                        <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                          <span className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
                            Create a Meta App
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Go to <span className="text-primary">developers.facebook.com</span></li>
                            <li>Click &quot;My Apps&quot; and then &quot;Create App&quot;</li>
                            <li>Select &quot;Business&quot; as the app type</li>
                            <li>Fill in app details and create</li>
                          </ol>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem className="border-border">
                        <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                          <span className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
                            Add WhatsApp Product
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>In your app dashboard, click &quot;Add Product&quot;</li>
                            <li>Find &quot;WhatsApp&quot; and click &quot;Set Up&quot;</li>
                            <li>Follow the setup wizard to link your business</li>
                          </ol>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem className="border-border">
                        <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                          <span className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">3</span>
                            Get API Credentials
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Go to WhatsApp &gt; API Setup</li>
                            <li>Copy your <strong className="text-foreground font-semibold">Phone Number ID</strong></li>
                            <li>Copy your <strong className="text-foreground font-semibold">WhatsApp Business Account ID</strong></li>
                            <li>Generate a <strong className="text-foreground font-semibold">Permanent Access Token</strong> from Business Settings &gt; System Users</li>
                          </ol>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem className="border-border">
                        <AccordionTrigger className="text-foreground hover:text-foreground hover:no-underline">
                          <span className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">4</span>
                            Configure Webhooks
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Go to WhatsApp &gt; Configuration</li>
                            <li>Click &quot;Edit&quot; on the Webhook section</li>
                            <li>Paste the <strong className="text-foreground font-semibold">Webhook Callback URL</strong> from above</li>
                            <li>Enter the same <strong className="text-foreground font-semibold">Verify Token</strong> you set here</li>
                            <li>Subscribe to &quot;messages&quot; webhook field</li>
                          </ol>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="mt-4 pt-4 border-t border-border">
                      <a
                        href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-focus transition-colors font-medium"
                      >
                        <ExternalLink className="size-3.5" />
                        Meta WhatsApp API Documentation
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
      )}

      {providerType === 'unofficial' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
                <Alert className="bg-card border-border shadow-sm rounded-2xl">
                  <div className="flex items-center gap-2">
                    {connectionStatus === 'connected' ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-500" />
                    )}
                    <AlertTitle className="text-foreground font-semibold mb-0">
                      {connectionStatus === 'connected' ? 'Connected' : 'QR Login (Unofficial)'}
                    </AlertTitle>
                  </div>
                  <AlertDescription className="text-muted-foreground mt-1">
                    {connectionStatus === 'connected'
                      ? 'Your WhatsApp is connected via QR Code. You can now send and receive messages.'
                      : 'Scan the QR code to link your existing WhatsApp application directly. Note: This method does not require Meta verification, but carries a higher risk of ban if used for spam.'}
                  </AlertDescription>
                </Alert>

                <Card className="bg-card border-border rounded-2xl shadow-sm ring-0 ring-transparent">
                  <CardHeader>
                    <CardTitle className="text-foreground font-semibold">Scan to Connect</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Open WhatsApp on your phone, go to Linked Devices, and scan the QR code.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                      {connectionStatus === 'connected' ? (
                          <div className="flex flex-col items-center text-center space-y-4">
                              <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center">
                                  <CheckCircle2 className="size-12 text-primary" />
                              </div>
                              <h3 className="text-xl font-semibold text-foreground">Device Linked!</h3>
                              <p className="text-muted-foreground">Your phone is successfully connected.</p>
                          </div>
                      ) : connectionStatus === 'qr_ready' && qrCode ? (
                          <div className="flex flex-col items-center space-y-6">
                              <div className="bg-white p-4 rounded-xl shadow-inner border border-border">
                                  {/* Using a standard img tag since it's a data URL */}
                                  <img src={qrCode} alt="WhatsApp QR Code" className="size-64" />
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center">
                                  <RefreshCw className="size-4 mr-2 animate-spin text-primary" />
                                  Waiting for scan...
                              </p>
                          </div>
                      ) : connectionStatus === 'initializing' ? (
                          <div className="flex flex-col items-center space-y-4 py-12">
                              <Loader2 className="size-8 animate-spin text-primary" />
                              <p className="text-muted-foreground">Generating QR code...</p>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center space-y-6 py-8">
                              <QrCode className="size-16 text-muted-foreground" />
                              <p className="text-muted-foreground text-center max-w-sm">
                                  Click the button below to initialize the WhatsApp Web session and generate your login QR code.
                              </p>
                              <Button 
                                onClick={handleStartQRLogin} 
                                disabled={saving}
                                className="bg-primary hover:bg-primary/95 text-white rounded-xl font-medium shadow-sm"
                              >
                                {saving ? (
                                    <><Loader2 className="size-4 animate-spin mr-2" /> Initializing...</>
                                ) : (
                                    <><QrCode className="size-4 mr-2" /> Generate QR Code</>
                                )}
                              </Button>
                          </div>
                      )}
                  </CardContent>
                </Card>

                {/* Reset Button for Unofficial */}
                {config && config.provider === 'unofficial' && (
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      disabled={resetting}
                      className="border-red-500/20 text-red-650 hover:bg-red-500/10 rounded-xl"
                    >
                      {resetting ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="size-4 mr-2" />
                          Disconnect Device
                        </>
                      )}
                    </Button>
                )}
            </div>

            {/* Sidebar for QR Code Method */}
            <div>
                <Card className="bg-card border-border rounded-2xl shadow-sm ring-0 ring-transparent">
                  <CardHeader>
                    <CardTitle className="text-foreground font-semibold text-base">About QR Login</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      What you need to know about this method.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-foreground">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                          <AlertTriangle className="size-4 inline-block mr-1.5 mb-0.5 text-amber-600" />
                          <strong>Warning:</strong> Sending bulk or promotional messages via this method violates WhatsApp Terms of Service and may result in an instant ban.
                      </div>
                      <p>
                          <strong>✅ Benefits:</strong>
                          <br />• Zero messaging fees
                          <br />• No template approvals
                          <br />• Works with standard WhatsApp app
                      </p>
                      <p>
                          <strong>❌ Limitations:</strong>
                          <br />• Your server must stay running
                          <br />• Phone needs internet access
                          <br />• No verified "Green Tick"
                      </p>
                  </CardContent>
                </Card>
            </div>
          </div>
      )}
    </div>
  );
}
