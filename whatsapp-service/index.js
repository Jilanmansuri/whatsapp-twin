const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from multiple possible sources (.env in current dir, parent .env.local, or environment variables)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ws = require('ws');

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: {
    transport: ws,
  },
});

// Store active clients
const clients = new Map();

async function cleanupClient(userId) {
  if (!userId) return;
  console.log(`Cleaning up WhatsApp Client for user: ${userId}`);
  
  if (clients.has(userId)) {
    const client = clients.get(userId);
    try {
      await client.logout().catch(() => {});
      await client.destroy().catch(() => {});
    } catch (e) {
      console.error(`Error destroying client for user ${userId}:`, e);
    }
    clients.delete(userId);
  }

  // Delete local session folder to prevent automatic re-login
  const fs = require('fs');
  const sessionDir = path.join(__dirname, '.wwebjs_auth', `session-${userId}`);
  if (fs.existsSync(sessionDir)) {
    try {
      console.log(`Deleting session directory: ${sessionDir}`);
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Failed to delete session directory for user ${userId}:`, err);
    }
  }
}

async function start() {
  console.log("Starting WhatsApp Unofficial Service...");

  // Subscribe to changes in whatsapp_config to start/stop clients
  supabase.channel('custom-all-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'whatsapp_config' },
      async (payload) => {
        console.log('Change received!', payload);
        const userId = payload.old ? payload.old.user_id : (payload.new ? payload.new.user_id : null);
        
        if (payload.eventType === 'DELETE') {
          await cleanupClient(userId);
        } else if (payload.new) {
          if (payload.new.provider === 'unofficial') {
            if (payload.new.status === 'initializing') {
              // Always clean previous session files first to prevent corrupt linking
              await cleanupClient(payload.new.user_id);
              initializeClient(payload.new.user_id);
            } else if (payload.new.status === 'disconnected') {
              await cleanupClient(payload.new.user_id);
            }
          } else {
            // Provider changed to Meta, cleanup unofficial client
            await cleanupClient(payload.new.user_id);
          }
        }
      }
    )
    .subscribe();

  // Listen for outbound messages to send
  supabase.channel('outbound-messages')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      async (payload) => {
        const msg = payload.new;
        if (!msg || msg.status !== 'sending') return;
        if (msg.sender_type !== 'agent' && msg.sender_type !== 'bot') return;
        
        console.log(`[Outbound] Sending message: "${msg.content_text.substring(0, 40)}..."`);
        
        // Find the conversation and user
        const { data: conversation } = await supabase
          .from('conversations')
          .select('user_id, contact:contacts(phone)')
          .eq('id', msg.conversation_id)
          .single();

        if (!conversation) return;

        const client = clients.get(conversation.user_id);
        if (!client) {
          console.error(`No WhatsApp client available for user: ${conversation.user_id}`);
          return;
        }

        try {
          let toPhone = conversation.contact.phone;
          if (!toPhone.includes('@')) {
            toPhone = toPhone.replace(/[^0-9]/g, '') + '@c.us';
          }
          console.log(`[Outbound] Sending to formatted destination: ${toPhone}`);
          const sent = await client.sendMessage(toPhone, msg.content_text);
          await supabase
            .from('messages')
            .update({ status: 'sent', sent_at: new Date(), message_id: sent?.id?.id || null })
            .eq('id', msg.id);
        } catch (e) {
          console.error("Failed to send message via WhatsApp Web", e);
          await supabase
            .from('messages')
            .update({ status: 'failed' })
            .eq('id', msg.id);
        }
      }
    )
    .subscribe();

  // Load existing unofficial configs that need initialization or are connected
  const { data: configs, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .eq('provider', 'unofficial');

  if (error) {
    console.error("Error fetching configs:", error);
    return;
  }

  for (const config of configs) {
    if (!clients.has(config.user_id)) {
      if (config.status === 'connected') {
        initializeClient(config.user_id);
      } else if (config.status === 'initializing') {
        cleanupClient(config.user_id).then(() => initializeClient(config.user_id));
      }
    }
  }

  // Periodic poll fallback in case Supabase Realtime publication doesn't include whatsapp_config
  setInterval(async () => {
    try {
      const { data: pendingConfigs } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('provider', 'unofficial')
        .eq('status', 'initializing');

      if (pendingConfigs && pendingConfigs.length > 0) {
        for (const config of pendingConfigs) {
          if (!clients.has(config.user_id)) {
            console.log(`[Polling] Found initializing request for user: ${config.user_id}`);
            await cleanupClient(config.user_id);
            initializeClient(config.user_id);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }, 3000);
}

async function initializeClient(userId) {
  console.log(`Initializing WhatsApp Client for user: ${userId}`);
  
  const fs = require('fs');
  const candidatePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);

  const puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ]
  };

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      puppeteerConfig.executablePath = p;
      break;
    }
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: puppeteerConfig,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  clients.set(userId, client);

  let isClientReady = false;

  client.on('qr', async (qr) => {
    console.log(`QR RECEIVED FOR USER ${userId}`);
    // Generate base64 data URL
    try {
        const qrDataUrl = await qrcode.toDataURL(qr);
        await supabase
        .from('whatsapp_config')
        .update({ 
            qr_code: qrDataUrl, 
            status: 'qr_ready',
            updated_at: new Date()
        })
        .eq('user_id', userId);
    } catch (err) {
        console.error("Error generating QR code", err);
    }
  });

  client.on('ready', async () => {
    isClientReady = true;
    console.log(`Client is ready for user: ${userId}`);
    await supabase
      .from('whatsapp_config')
      .update({ 
          qr_code: null, 
          status: 'connected',
          connected_at: new Date(),
          updated_at: new Date()
      })
      .eq('user_id', userId);
  });

  client.on('authenticated', () => {
    console.log(`Client authenticated for user: ${userId}`);
  });

  client.on('auth_failure', async msg => {
    console.error(`Client auth failure for user: ${userId}`, msg);
    await supabase
      .from('whatsapp_config')
      .update({ status: 'error', updated_at: new Date() })
      .eq('user_id', userId);
  });

  client.on('disconnected', async (reason) => {
    isClientReady = false;
    console.log(`Client disconnected for user: ${userId}`, reason);
    await supabase
      .from('whatsapp_config')
      .update({ status: 'disconnected', updated_at: new Date() })
      .eq('user_id', userId);
    clients.delete(userId);
  });

  client.on('message', async msg => {
    console.log(`[MSG] event fired for user ${userId}  from=${msg.from}  body="${(msg.body || '').substring(0,40)}"  fromMe=${msg.fromMe}`);

    // Ignore status broadcasts
    if (msg.from === 'status@broadcast') {
      console.log('[MSG] Ignoring status@broadcast');
      return;
    }

    // Ignore group chats
    if (msg.from.endsWith('@g.us')) {
      console.log('[MSG] Ignoring group chat message');
      return;
    }

    console.log(`[MSG] Processing message for user ${userId}:`, msg.body);
    
    try {
        const displayPhone = msg.from.split('@')[0];
        
        let notifyName = displayPhone;
        let phoneNo = displayPhone;
        
        if (isClientReady) {
            try {
                // Retrieve contact details with a 2.5-second timeout to prevent hanging on LID query
                const waContact = await Promise.race([
                    msg.getContact(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
                ]);
                
                phoneNo = waContact.id.user || displayPhone;
                notifyName = waContact.name || waContact.pushname || (waContact.number ? '+' + waContact.number : null) || displayPhone;
                console.log(`[MSG] Successfully resolved contact info. Name: ${notifyName}, Phone: ${phoneNo}`);
            } catch (contactErr) {
                console.log(`[MSG] Contact resolution timed out or failed for ${msg.from}. Using fallback.`);
                notifyName = msg._data?.notifyName || msg._data?.pushname || displayPhone;
            }
        } else {
            console.log(`[MSG] Message received while client is not ready. Using fast fallback without getContact.`);
            notifyName = msg._data?.notifyName || msg._data?.pushname || displayPhone;
        }

        // Force standard c.us format in database so that it maps to the real phone number
        const rawPhone = phoneNo + '@c.us'; 
        let isNewContact = false;

        // 1. Find or create contact
        // We first try to find by the full rawPhone, or fallback to the old format without @
        let { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', userId)
          .eq('phone', rawPhone)
          .maybeSingle();

        if (contactError) {
            console.error(`[MSG] Error querying contact for JID ${rawPhone}:`, contactError);
        }

        if (!contact) {
            // Try to find old format contact (without JID suffix)
            const { data: oldContact, error: oldContactErr } = await supabase
              .from('contacts')
              .select('*')
              .eq('user_id', userId)
              .eq('phone', displayPhone)
              .maybeSingle();
              
            if (oldContactErr) {
                console.error("[MSG] Error querying old contact:", oldContactErr);
            }
              
            if (oldContact) {
                // Update old contact to the new full JID format
                const { data: updatedContact, error: updateErr } = await supabase
                  .from('contacts')
                  .update({ phone: rawPhone, name: notifyName })
                  .eq('id', oldContact.id)
                  .select().single();
                  
                if (updateErr) {
                    console.error("[MSG] Error updating contact:", updateErr);
                }
                contact = updatedContact;
            } else {
                const { data: newContact, error: insertErr } = await supabase
                  .from('contacts')
                  .upsert({ user_id: userId, phone: rawPhone, name: notifyName }, { onConflict: 'user_id, phone' })
                  .select().single();
                  
                if (insertErr) {
                    console.error("[MSG] Error upserting new contact:", insertErr);
                }
                contact = newContact;
                isNewContact = true;
            }
        } else if (!contact.name || contact.name === 'Unknown' || contact.name === displayPhone) {
            // Update name if it is currently Unknown or displayPhone
            const { error: nameUpdateErr } = await supabase
              .from('contacts')
              .update({ name: notifyName })
              .eq('id', contact.id);
              
            if (nameUpdateErr) {
                console.error("[MSG] Error updating contact name:", nameUpdateErr);
            }
        }

        if (!contact) {
            console.error("[MSG] Failed to resolve or create contact. Exiting handler.");
            return; 
        }

        // 2. Find or create conversation
        let { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', userId)
          .eq('contact_id', contact.id)
          .maybeSingle();

        if (convError) {
            console.error("[MSG] Error querying conversation:", convError);
        }

        if (!conversation) {
          const { data: newConv, error: newConvErr } = await supabase
            .from('conversations')
            .upsert({
              user_id: userId,
              contact_id: contact.id,
              status: 'open',
              unread_count: 1,
              last_message_text: msg.body || '[Media]',
              last_message_at: new Date().toISOString()
            }, { onConflict: 'user_id, contact_id' })
            .select().single();
            
          if (newConvErr) {
              console.error("[MSG] Error upserting conversation:", newConvErr);
          }
          conversation = newConv;
        } else {
          const { error: convUpdateErr } = await supabase
            .from('conversations')
            .update({
              status: 'open',
              unread_count: (conversation.unread_count || 0) + 1,
              last_message_text: msg.body || '[Media]',
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', conversation.id);
            
          if (convUpdateErr) {
              console.error("[MSG] Error updating conversation:", convUpdateErr);
          }
        }

        if (!conversation) {
            console.error("[MSG] Failed to resolve or create conversation. Exiting handler.");
            return;
        }

        const { count: priorCustomerMsgCount, error: countErr } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversation.id)
          .eq('sender_type', 'customer');
          
        if (countErr) {
            console.error("[MSG] Error counting prior messages:", countErr);
        }
          
        const isFirstInboundMessage = (priorCustomerMsgCount || 0) === 0;

        // 3. Insert message
        const { error: msgInsertErr } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            sender_type: 'customer',
            content_type: msg.hasMedia ? 'image' : 'text',
            content_text: msg.body,
            message_id: msg.id.id,
            status: 'delivered'
          });

        if (msgInsertErr) {
            console.error("[MSG] Error inserting message:", msgInsertErr);
        } else {
            console.log(`[MSG] Successfully stored message in database for contact: ${notifyName} (${rawPhone})`);
        }

        // 4. Trigger Automations
        const automationTriggers = ['new_message_received', 'keyword_match'];
        if (isNewContact) automationTriggers.unshift('new_contact_created');
        if (isFirstInboundMessage) automationTriggers.unshift('first_inbound_message');
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        for (const triggerType of automationTriggers) {
            try {
                await fetch(`${appUrl}/api/automations/engine`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseKey}`
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        trigger_type: triggerType,
                        contact_id: contact.id,
                        context: {
                            message_text: msg.body || '',
                            conversation_id: conversation.id
                        }
                    })
                });
            } catch (err) {
                console.error(`[automations] failed to trigger ${triggerType}:`, err);
            }
        }

        // 5. Trigger AI Auto Reply
        try {
            const { data: aiSettings } = await supabase
              .from('ai_settings')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();

            if (aiSettings && aiSettings.api_key && aiSettings.auto_reply_mode === 'auto') {
                console.log(`[AI] Auto-reply is enabled for user ${userId}. Requesting reply...`);
                const response = await fetch(`${appUrl}/api/ai/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseKey}`
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        message: msg.body,
                        conversation_id: conversation.id
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.reply) {
                        console.log(`[AI] Successfully generated reply: "${data.reply}"`);
                        const { error: insertErr } = await supabase
                          .from('messages')
                          .insert({
                            conversation_id: conversation.id,
                            sender_type: 'bot',
                            content_type: 'text',
                            content_text: data.reply,
                            status: 'sending'
                          });
                        
                        if (insertErr) {
                            console.error('[AI] Failed to store generated reply message:', insertErr);
                        }
                    }
                } else {
                    const errText = await response.text();
                    console.error('[AI] Generation request failed:', errText);
                }
            }
        } catch (aiErr) {
            console.error('[AI] Exception in auto-reply logic:', aiErr);
        }

    } catch (e) {
        console.error("Error processing incoming message", e);
        require('fs').appendFileSync('whatsapp-error.log', new Date().toISOString() + ' ' + (e.stack || e) + '\n');
    }
  });

  client.initialize();
}

// Lightweight HTTP health-check server for Render Web Service port detection
const http = require('http');
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'whatsapp-service', timestamp: new Date() }));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[HealthCheck] Server listening on port ${PORT}`);
});

start();
