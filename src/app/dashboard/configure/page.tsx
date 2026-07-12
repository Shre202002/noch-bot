
'use client';
import { useState, useEffect, useRef } from "react"
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  PopoverFooter,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Share2, Copy, Mail, MessageSquare, Check, Database, Globe, Zap, Palette } from 'lucide-react';
import { BasicColorPicker } from '@/components/ui/color-picker';

type Tab = 'Crawl' | 'Vectorize' | 'Theme' | 'Preview' | 'Embed Code'
type Message = { role: 'user' | 'assistant'; content: string }

export default function ConfigurePage() {
  const [crawlUrl, setCrawlUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlLogs, setCrawlLogs] = useState<string[]>([])
  const [crawledPages, setCrawledPages] = useState<{ url: string, chars: number }[]>([])
  const [crawlDone, setCrawlDone] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [embedDone, setEmbedDone] = useState(false)
  const [chunkCount, setChunkCount] = useState(0)
  const [extractingTheme, setExtractingTheme] = useState(false)
  const [palette, setPalette] = useState<string[]>([])
  const [themeConfig, setThemeConfig] = useState({
    bubbleColor: '#36f4a4', headerColor: '#36f4a4',
    userMsgColor: '#36f4a4', sendBtnColor: '#36f4a4', accentColor: '#36f4a4',
  })
  const [themeSaved, setThemeSaved] = useState(false)
  const [previewMessages, setPreviewMessages] = useState<Message[]>([])
  const [previewInput, setPreviewInput] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('Crawl')
  const [userId, setUserId] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [copiedShareUrl, setCopiedShareUrl] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const previewBottomRef = useRef<HTMLDivElement>(null)

  const [previewTypingText, setPreviewTypingText] = useState('')
  const [previewIsTyping, setPreviewIsTyping] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.id) setUserId(d.id) })
    setBaseUrl(window.location.origin)
    fetch('/api/knowledge').then(r => r.json()).then(d => {
      if (d.url) { setCrawlUrl(d.url); setCrawlDone(true); setEmbedDone(true) }
      if (d.theme) setThemeConfig(d.theme)
      if (d.palette) setPalette(d.palette)
      if (d.chunkCount) setChunkCount(d.chunkCount)
    })
  }, [])

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [crawlLogs])
  useEffect(() => { previewBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [previewMessages])

  const startCrawl = async () => {
    if (!crawlUrl.trim()) return
    setCrawling(true)
    setCrawlLogs(['🚀 Starting crawl for ' + crawlUrl.trim()])
    setCrawledPages([])
    setCrawlDone(false)
    setCrawlError('')
    setEmbedDone(false)
    setChunkCount(0)

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl.trim() }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setCrawlError(data.error || 'Crawl failed')
        setCrawlLogs(prev => [...prev, '❌ ' + (data.error || 'Crawl failed')])
        return
      }

      const pages = data.pages || []
      const logs: string[] = ['🚀 Starting crawl for ' + crawlUrl.trim()]

      pages.forEach((p: { url: string, chars: number }, i: number) => {
        logs.push(`🔍 [${i + 1}] ${p.url} (${(p.chars / 1000).toFixed(1)}k chars)`)
        logs.push(`✓ ${p.url} — ${(p.chars / 1000).toFixed(1)}k chars`)
      })

      logs.push(`✅ Crawl complete — ${pages.length} pages crawled`)
      logs.push(`⚡ ${data.chunks} chunks created`)
      logs.push(`✅ ${data.chunks} vectors stored in Qdrant!`)

      setCrawlLogs(logs)
      setCrawledPages(pages)
      setCrawlDone(true)
      setEmbedDone(true)
      setChunkCount(data.chunks || 0)

    } catch (err: any) {
      setCrawlError(err.message)
      setCrawlLogs(prev => [...prev, '❌ ' + err.message])
    } finally {
      setCrawling(false)
    }
  }

  const extractTheme = async () => {
    if (!crawlUrl) return
    setExtractingTheme(true)
    try {
      const res = await fetch('/api/extract-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl }),
      })
      const data = await res.json()
      if (data.palette?.length > 0) {
        setPalette(data.palette)
        const primary = data.palette[0]
        setThemeConfig({
          bubbleColor: primary, headerColor: primary,
          userMsgColor: primary, sendBtnColor: primary,
          accentColor: data.palette[1] || primary,
        })
      }
    } catch (err) {
      console.error('Theme extraction failed:', err)
    } finally {
      setExtractingTheme(false)
    }
  }

  const saveTheme = async () => {
    try {
      await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeConfig }),
      })
      setThemeSaved(true)
      setTimeout(() => setThemeSaved(false), 2000)
    } catch (err) { console.error('Save theme failed:', err) }
  }

  const sendPreviewMessage = async (text?: string) => {
    const userText = text || previewInput.trim();

    if (!userText || previewLoading || previewIsTyping || !userId) {
      return;
    }

    const newMessages: Message[] = [
      ...previewMessages,
      { role: "user", content: userText },
    ];

    setPreviewMessages(newMessages);
    setPreviewInput("");
    setPreviewLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
          userId,
        }),
      });

      if (!res.body) {
        const data = await res.json();
        setPreviewLoading(false);
        setPreviewMessages([...newMessages, { role: "assistant", content: data.text || "Sorry, no response." }]);
        return;
      }

      const data = await res.json();
      setPreviewLoading(false);
      setPreviewIsTyping(true);
      let streamedText = "";
      const fullResponse = data.text || "";
      
      let i = 0;
      const interval = setInterval(() => {
        streamedText = fullResponse.slice(0, i + 1);
        setPreviewTypingText(streamedText);
        i++;
        if (i >= fullResponse.length) {
          clearInterval(interval);
          setPreviewMessages([...newMessages, { role: "assistant", content: fullResponse }]);
          setPreviewTypingText("");
          setPreviewIsTyping(false);
        }
      }, 12);

    } catch (err: any) {
      setPreviewLoading(false);
      setPreviewIsTyping(false);
      setPreviewMessages([...newMessages, { role: "assistant", content: "⚠️ Error: " + err.message }]);
    }
  };

  const scriptUrl = `${baseUrl}/embed.js`;
  const embedCode = `<script\n  src="${scriptUrl}"\n  data-user-id="${userId}"\n  defer>\n</script>`;

  const THEME_COMPONENTS = [
    { key: 'bubbleColor', label: 'Chat Bubble', desc: 'Floating button color' },
    { key: 'headerColor', label: 'Header Bar', desc: 'Top bar of chat window' },
    { key: 'userMsgColor', label: 'User Messages', desc: 'Sent message bubbles' },
    { key: 'sendBtnColor', label: 'Send Button', desc: 'Send arrow button' },
    { key: 'accentColor', label: 'Accent / Links', desc: 'Hover states and links' },
  ] as const

  const PRESET_COLORS = ['#36f4a4', '#2563eb', '#8b5cf6', '#FF5701', '#ec4899', '#ef4444', '#eab308', '#ffffff']

  const shareOptions = [
    {
      name: 'Copy Link',
      icon: Copy,
      action: () => {
        navigator.clipboard.writeText(scriptUrl);
        setCopiedShareUrl(true);
        setTimeout(() => setCopiedShareUrl(false), 2000);
      },
    },
    { 
      name: 'Email', 
      icon: Mail, 
      action: () => {
        const subject = encodeURIComponent("Nochq AI Chatbot Integration Script");
        const body = encodeURIComponent(
          `Hi,\n\nHere is the integration script for the Nochq AI chatbot. Paste this snippet before the closing </body> tag on your website:\n\n${embedCode}\n\nDocumentation: ${baseUrl}/docs`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      } 
    },
    { 
      name: 'Message', 
      icon: MessageSquare, 
      action: async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Nochq AI Chatbot',
              text: `Integration script for Nochq AI: ${embedCode}`,
              url: scriptUrl,
            });
          } catch (err) {
            // User cancelled or share failed
          }
        } else {
          // Fallback: copy code to clipboard
          navigator.clipboard.writeText(embedCode);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } 
    },
  ];

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes typingBounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
        @keyframes cursorBlink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 400, color: '#fff', letterSpacing: '-0.9px', marginBottom: 6 }}>Configure</h1>
        <p style={{ fontSize: 14, color: '#7d8187' }}>Set up your AI chatbot step by step.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { tab: 'Crawl', done: crawlDone, label: '1. Crawl' },
          { tab: 'Vectorize', done: embedDone, label: '2. Vectorize' },
          { tab: 'Theme', done: themeSaved, label: '3. Theme' },
          { tab: 'Preview', done: previewMessages.length > 0, label: '4. Preview' },
          { tab: 'Embed Code', done: false, label: '5. Embed' },
        ].map(({ tab, done, label }) => (
          <div key={tab} onClick={() => setActiveTab(tab as Tab)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 9999, cursor: 'pointer',
            background: activeTab === tab ? '#36f4a420' : 'transparent',
            border: activeTab === tab ? '1px solid #36f4a4' : '1px solid #2a2d35',
            color: activeTab === tab ? '#36f4a4' : done ? '#7d8187' : '#4a4e56',
            fontSize: 13, transition: 'all 0.15s'
          }}>
            {done && <span style={{ color: '#36f4a4' }}>✓</span>}
            {label}
          </div>
        ))}
      </div>

      <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 16, padding: 32 }}>
        {activeTab === 'Crawl' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 1 — Crawl Your Website</h2>
              <p style={{ fontSize: 14, color: '#7d8187' }}>Enter your website URL. Nochq will crawl up to 15 pages and extract all content.</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                value={crawlUrl}
                onChange={e => setCrawlUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !crawling && startCrawl()}
                placeholder="https://yourwebsite.com"
                disabled={crawling}
                style={{ flex: 1, background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 8, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none' }}
              />
              <button onClick={startCrawl} disabled={crawling || !crawlUrl.trim()} style={{
                background: crawling ? '#2a2d35' : '#36f4a4', color: crawling ? '#7d8187' : '#000',
                border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500,
                fontSize: 14, cursor: crawling ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'
              }}>
                {crawling ? (
                  <><span style={{ width: 14, height: 14, border: '2px solid #7d8187', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Crawling...</>
                ) : crawlDone ? 'Re-crawl' : 'Start Crawl'}
              </button>
            </div>
            {crawlLogs.length > 0 && (
              <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, padding: 20, maxHeight: 220, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, color: '#7d8187', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Log</div>
                {crawlLogs.map((log, i) => (
                  <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, padding: '2px 0', color: log.startsWith('✅') ? '#36f4a4' : log.startsWith('❌') ? '#ef4444' : i === crawlLogs.length - 1 ? '#36f4a4' : '#7d8187' }}>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
            {crawledPages.length > 0 && (
              <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: '#7d8187', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Crawled Pages ({crawledPages.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {crawledPages.map((page, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#1f2228', borderRadius: 8, border: '1px solid #2a2d35' }}>
                      <span style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{page.url}</span>
                      <span style={{ fontSize: 11, color: '#7d8187', flexShrink: 0 }}>{(page.chars / 1000).toFixed(1)}k chars</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {crawlError && <div style={{ background: '#1a0a0a', border: '1px solid #ef4444', borderRadius: 8, padding: 16, color: '#ef4444', fontSize: 14 }}>❌ {crawlError}</div>}
            {crawlDone && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setActiveTab('Vectorize')} style={{ background: '#36f4a4', color: '#000', border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Next: Review Vectors →</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Vectorize' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 2 — Vector Database Status</h2>
              <p style={{ fontSize: 14, color: '#7d8187' }}>Your website content has been chunked and converted into high-dimensional vectors for AI retrieval.</p>
            </div>

            {!embedDone ? (
              <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <Database className="h-12 w-12 text-[#4a4e56] mx-auto mb-4" />
                <p style={{ color: '#7d8187', fontSize: 14 }}>No vector data found. Please complete the Crawl step first.</p>
                <button onClick={() => setActiveTab('Crawl')} style={{ marginTop: 16, background: 'transparent', border: '1px solid #36f4a4', color: '#36f4a4', borderRadius: 9999, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Go to Crawl</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', gap: 24, background: '#0d2420', border: '1px solid #36f4a430', borderRadius: 12, padding: 32 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#36f4a4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>Chunks Indexed</div>
                    <div style={{ fontSize: 48, color: '#fff', fontWeight: 300, lineHeight: 1 }}>{chunkCount}</div>
                    <div style={{ fontSize: 13, color: '#7d8187', marginTop: 8 }}>Individual knowledge units</div>
                  </div>
                  <div style={{ width: 1, background: '#36f4a420' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#36f4a4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>Pages Processed</div>
                    <div style={{ fontSize: 48, color: '#fff', fontWeight: 300, lineHeight: 1 }}>{crawledPages.length || (crawlDone ? '...' : 0)}</div>
                    <div style={{ fontSize: 13, color: '#7d8187', marginTop: 8 }}>Unique URLs vectorized</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 12 }}>
                    <div style={{ background: '#36f4a4', color: '#000', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap className="h-3 w-3 fill-current" /> Stored in Qdrant
                    </div>
                    <span style={{ fontSize: 11, color: '#7d8187' }}>Distance Metric: Cosine</span>
                  </div>
                </div>

                <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, padding: 20 }}>
                  <h3 style={{ fontSize: 13, color: '#fff', marginBottom: 12, fontWeight: 500 }}>Database Optimization</h3>
                  <p style={{ fontSize: 13, color: '#7d8187', lineHeight: 1.6 }}>
                    Your data is currently indexed in our primary <strong>NochBot</strong> collection. 
                    This ensures sub-100ms retrieval times during chat sessions. 
                    If you update your website, we recommend re-crawling to sync the latest content.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <button onClick={() => setActiveTab('Crawl')} style={{ color: '#7d8187', background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>Re-crawl website</button>
                  <button onClick={() => setActiveTab('Theme')} style={{ background: '#36f4a4', color: '#000', border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Next: Detect Theme →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Theme' && (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 3 — Detect & Set Theme</h2>
                <p style={{ fontSize: 14, color: '#7d8187' }}>Auto-detect your brand colors, then assign each color to chatbot components.</p>
              </div>
              <button onClick={extractTheme} style={{ background: 'transparent', border: '1px solid #36f4a4', color: '#36f4a4', borderRadius: 9999, padding: '12px 24px', fontSize: 14, cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                {extractingTheme ? (<><span style={{ width: 14, height: 14, border: '2px solid #36f4a4', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Detecting...</>) : '🎨 Detect Brand Colors'}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {THEME_COMPONENTS.map(({ key, label, desc }) => (
                  <div key={key} style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 10, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div><div style={{ fontSize: 13, color: '#fff' }}>{label}</div><div style={{ fontSize: 11, color: '#7d8187' }}>{desc}</div></div>
                      <BasicColorPicker
                        value={themeConfig[key as keyof typeof themeConfig]}
                        onValueChange={(details) => setThemeConfig(prev => ({ ...prev, [key]: details.value.toString("hex") }))}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[...palette, ...PRESET_COLORS].filter((c, i, a) => a.indexOf(c) === i).map(color => (
                        <div key={color} onClick={() => setThemeConfig(prev => ({ ...prev, [key]: color }))} title={color} style={{ width: 28, height: 28, borderRadius: '50%', background: color, cursor: 'pointer', border: themeConfig[key as keyof typeof themeConfig] === color ? '2px solid #fff' : '2px solid transparent', transform: themeConfig[key as keyof typeof themeConfig] === color ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.15s' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={saveTheme} style={{ background: themeSaved ? '#0d2420' : '#36f4a4', color: themeSaved ? '#36f4a4' : '#000', border: themeSaved ? '1px solid #36f4a430' : 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>{themeSaved ? '✓ Saved' : 'Save Theme'}</button>
                <button onClick={() => setActiveTab('Preview')} style={{ background: '#36f4a4', color: '#000', border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Next: Preview →</button>
              </div>
            </div>
            <div style={{ width: 260, flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: '#7d8187', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Preview</div>
              <div style={{ background: '#f7f8fc', borderRadius: 16, overflow: 'hidden', border: '1px solid #2a2d35' }}>
                <div style={{ background: themeConfig.headerColor, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                  <div><div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>AI Assistant</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>● Online</div></div>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '8px 12px', fontSize: 12, color: '#333', maxWidth: '85%' }}>Hi! How can I help?</div>
                  <div style={{ background: themeConfig.userMsgColor, borderRadius: 12, padding: '8px 12px', fontSize: 12, color: '#000', maxWidth: '85%', alignSelf: 'flex-end' }}>Tell me more!</div>
                </div>
                <div style={{ borderTop: '1px solid #eee', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', background: '#fff' }}>
                  <div style={{ flex: 1, fontSize: 11, color: '#bbb', fontStyle: 'italic' }}>Ask a question...</div>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: themeConfig.sendBtnColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>➤</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 4 — Preview Your Chatbot</h2>
              <p style={{ fontSize: 14, color: '#7d8187' }}>Interact with your agent live using the custom colors you selected.</p>
            </div>
            {!crawlDone && <div style={{ background: '#1f2228', border: '1px solid #eab308', borderRadius: 8, padding: 16, color: '#eab308', fontSize: 14 }}>⚠ Complete Step 1 (Crawl) first.</div>}
            <div style={{ maxWidth: 560, background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: themeConfig.headerColor, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                <div>
                  <div style={{ fontSize: 14, color: '#fff' }}>AI Assistant</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: previewLoading ? '#eab308' : '#36f4a4' }} />
                    {previewLoading ? 'Typing...' : 'Online'}
                  </div>
                </div>
              </div>
              <div style={{ height: 360, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {previewMessages.length === 0 && !previewLoading && !previewIsTyping ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4e56', fontSize: 13 }}>Send a message to test your chatbot...</div>
                ) : (
                  <>
                    {previewMessages.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? themeConfig.userMsgColor : '#1f2228', color: msg.role === 'user' ? '#000' : '#fff', fontSize: 13, lineHeight: 1.55, border: msg.role === 'assistant' ? '1px solid #2a2d35' : 'none' }}>{msg.content}</div>
                      </div>
                    ))}
                    {previewLoading && !previewIsTyping && (
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1f2228', border: '1px solid #2a2d35', display: 'flex', gap: 4 }}>
                          {[0, 1, 2].map(j => (<span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7d8187', display: 'inline-block', animation: `typingBounce 1.2s infinite ${j * 0.2}s` }} />))}
                        </div>
                      </div>
                    )}
                    {previewIsTyping && (
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1f2228', color: '#fff', fontSize: 13, lineHeight: 1.55, border: '1px solid #2a2d35' }}>
                          {previewTypingText}<span style={{ display: 'inline-block', width: 2, height: '1em', background: themeConfig.sendBtnColor, marginLeft: 3, verticalAlign: 'text-bottom', animation: 'cursorBlink 0.7s infinite' }} />
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={previewBottomRef} />
              </div>
              <div style={{ borderTop: '1px solid #2a2d35', padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input value={previewInput} onChange={e => setPreviewInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendPreviewMessage()} placeholder="Ask a question..." disabled={previewLoading || !crawlDone} style={{ flex: 1, background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }} />
                <button onClick={() => sendPreviewMessage()} disabled={previewLoading || !previewInput.trim() || !crawlDone} style={{ background: themeConfig?.sendBtnColor || '#6366f1', color: '#000', border: 'none', borderRadius: 9999, padding: '10px 18px', fontWeight: 500, fontSize: 13, cursor: 'pointer', opacity: previewLoading ? 0.5 : 1 }}>Send</button>
              </div>
            </div>
            {previewMessages.filter(m => m.role === 'assistant' && m.content).length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setActiveTab('Embed Code')} style={{ background: '#36f4a4', color: '#000', border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Next: Get Embed Code →</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Embed Code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
            <div className="flex justify-between items-center">
              <div>
                <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 5 — Embed Your Chatbot</h2>
                <p style={{ fontSize: 14, color: '#7d8187' }}>Paste this script tag before &lt;/body&gt; on any website.</p>
              </div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-transparent border-[#2a2d35] text-[#7d8187] hover:text-white hover:border-[#36f4a4] rounded-full px-6 cursor-pointer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share Snippet
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-[#0a0a0a] border-[#2a2d35] text-white">
                  <PopoverHeader>
                    <PopoverTitle>Share this snippet</PopoverTitle>
                    <PopoverDescription className="text-[#7d8187]">
                      Distribute your chatbot integration code.
                    </PopoverDescription>
                  </PopoverHeader>
                  <PopoverBody className="space-y-1 px-2 py-2">
                    {shareOptions.map((option) => (
                      <Button
                        key={option.name}
                        variant="ghost"
                        className="w-full justify-start text-[#7d8187] hover:text-white hover:bg-[#1f2228] cursor-pointer"
                        size="sm"
                        onClick={option.action}
                      >
                        <option.icon className="mr-2 h-4 w-4" />
                        {option.name}
                        {option.name === 'Copy Link' && copiedShareUrl && <Check className="ml-auto h-3 w-3 text-[#36f4a4]" />}
                      </Button>
                    ))}
                  </PopoverBody>
                  <PopoverFooter className="py-4">
                    <Label htmlFor="share-url" className="text-xs text-[#7d8187] mb-2 block">Direct Script URL</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="share-url"
                        value={scriptUrl}
                        readOnly
                        className="text-[10px] h-8 bg-[#1f2228] border-[#2a2d35] text-[#36f4a4]"
                      />
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 cursor-pointer" onClick={() => {
                        navigator.clipboard.writeText(scriptUrl);
                        setCopiedShareUrl(true);
                        setTimeout(() => setCopiedShareUrl(false), 2000);
                      }}>
                        {copiedShareUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </PopoverFooter>
                </PopoverContent>
              </Popover>
            </div>

            {!crawlDone && <div style={{ background: '#1f2228', border: '1px solid #eab308', borderRadius: 8, padding: 16, color: '#eab308', fontSize: 14 }}>⚠ Complete Steps 1–3 before embedding.</div>}
            
            <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#7d8187', fontFamily: 'monospace' }}>HTML — paste before &lt;/body&gt;</span>
                <button onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ background: copied ? '#0d2420' : 'transparent', border: '1px solid #2a2d35', color: copied ? '#36f4a4' : '#7d8187', borderRadius: 9999, padding: '4px 14px', fontSize: 12, cursor: 'pointer' }}>{copied ? '✓ Copied!' : 'Copy'}</button>
              </div>
              <pre style={{ padding: 20, margin: 0, fontSize: 13, fontFamily: 'monospace', color: '#36f4a4', overflowX: 'auto', lineHeight: 1.8 }}>{embedCode}</pre>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Copy the script tag above', 'Paste it before </body> in your website HTML', 'Save and reload — your chatbot is live instantly', 'Works on: Next.js, React, WordPress, Webflow, plain HTML'].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: '#36f4a420', color: '#36f4a4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500 }}>{i + 1}</div>
                  <span style={{ fontSize: 14, color: '#7d8187' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
