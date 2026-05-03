'use client';

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

type Tab = 'Crawl' | 'Persona' | 'Appearance' | 'Preview' | 'Embed'

type Message = { role: 'user' | 'assistant'; content: string }

type Theme = {
  bubbleColor: string
  headerColor: string
  userMsgColor: string
  sendBtnColor: string
  accentColor: string
}

type KnowledgeState = {
  url: string | null
  crawledAt: string | null
  systemPrompt: string | null
  theme: Theme | null
  hasCrawled: boolean
}

const COLOR_OPTIONS = [
  { id: 'green',  value: '#36f4a4' },
  { id: 'blue',   value: '#2563eb' },
  { id: 'purple', value: '#8b5cf6' },
  { id: 'orange', value: '#FF5701' },
  { id: 'pink',   value: '#ec4899' },
  { id: 'red',    value: '#ef4444' },
  { id: 'yellow', value: '#eab308' },
  { id: 'white',  value: '#ffffff' },
]

const ICON_OPTIONS = [
  { id: 'robot',   emoji: '🤖' },
  { id: 'chat',    emoji: '💬' },
  { id: 'bolt',    emoji: '⚡' },
  { id: 'target',  emoji: '🎯' },
  { id: 'brain',   emoji: '🧠' },
  { id: 'star',    emoji: '🌟' },
  { id: 'crystal', emoji: '🔮' },
  { id: 'arm',     emoji: '🦾' },
]

export default function ConfigurePage() {
  const [activeTab, setActiveTab] = useState<Tab>('Crawl')
  const [userId, setUserId] = useState('')
  const [knowledge, setKnowledge] = useState<KnowledgeState>({
    url: null, crawledAt: null, systemPrompt: null, theme: null, hasCrawled: false
  })

  // Tab 1: Crawl States
  const [crawlUrl, setCrawlUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [crawlDone, setCrawlDone] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [crawlStats, setCrawlStats] = useState({ pages: 0, chunks: 0 })
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Tab 2: Persona States
  const [systemPrompt, setSystemPrompt] = useState('')
  const [savingPersona, setSavingPersona] = useState(false)
  const [personaSaved, setPersonaSaved] = useState(false)

  // Tab 3: Appearance States
  const [selectedColor, setSelectedColor] = useState('green')
  const [selectedIcon, setSelectedIcon] = useState('robot')
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [appearanceSaved, setAppearanceSaved] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [palette, setPalette] = useState<string[]>([])

  // Tab 4: Preview States
  const [previewMessages, setPreviewMessages] = useState<Message[]>([])
  const [previewInput, setPreviewInput] = useState('')
  const [previewStreaming, setPreviewStreaming] = useState(false)
  const previewBottomRef = useRef<HTMLDivElement>(null)

  // Tab 5: Embed States
  const [copied, setCopied] = useState(false)

  const activeColor = COLOR_OPTIONS.find(c => c.id === selectedColor)?.value ?? '#36f4a4'
  const activeIcon = ICON_OPTIONS.find(i => i.id === selectedIcon)?.emoji ?? '🤖'

  useEffect(() => {
    // Get userId
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.id) setUserId(d.id) })

    // Get existing knowledge
    fetch('/api/knowledge')
      .then(r => r.json())
      .then(d => {
        setKnowledge(d)
        if (d.url) setCrawlUrl(d.url)
        if (d.systemPrompt) setSystemPrompt(d.systemPrompt)
        if (d.theme) {
          const match = COLOR_OPTIONS.find(c => c.value === d.theme.bubbleColor)
          if (match) setSelectedColor(match.id)
        }
      })
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    previewBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [previewMessages, previewStreaming])

  const startCrawl = async () => {
    if (!crawlUrl.trim()) return
    setCrawling(true)
    setLogs([])
    setCrawlDone(false)
    setCrawlError('')
    setCrawlStats({ pages: 0, chunks: 0 })

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl.trim() }),
      })

      if (!res.body) throw new Error('No response stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const event = JSON.parse(line.replace('data: ', '').trim())

            if (event.type === 'start') setLogs(['🚀 ' + event.message])
            if (event.type === 'crawling') setLogs(prev => [...prev, `🔍 Crawling (${event.count}): ${event.page}`])
            if (event.type === 'page_done') setLogs(prev => [...prev, `✓ Done: ${event.page} (${event.chars} chars)`])
            if (event.type === 'page_error') setLogs(prev => [...prev, `✗ Failed: ${event.page}`])
            if (event.type === 'embedding') setLogs(prev => [...prev, `⚡ ${event.message}`])
            if (event.type === 'done') {
              setCrawlDone(true)
              setCrawlStats({ pages: event.pagesCrawled, chunks: event.chunks })
              setLogs(prev => [...prev, `✅ Complete! ${event.pagesCrawled} pages · ${event.chunks} chunks`])
              fetch('/api/knowledge').then(r => r.json()).then(d => setKnowledge(d))
            }
            if (event.type === 'error') {
              setCrawlError(event.message)
              setLogs(prev => [...prev, `❌ Error: ${event.message}`])
            }
          } catch { }
        }
      }
    } catch (err: any) {
      setCrawlError(err.message || 'Crawl failed')
    } finally {
      setCrawling(false)
    }
  }

  const savePersona = async () => {
    setSavingPersona(true)
    try {
      await fetch('/api/save-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: systemPrompt }),
      })
      setPersonaSaved(true)
      setTimeout(() => setPersonaSaved(false), 2000)
    } finally {
      setSavingPersona(false)
    }
  }

  const extractTheme = async () => {
    if (!knowledge.url) return
    setExtracting(true)
    try {
      const res = await fetch('/api/extract-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: knowledge.url }),
      })
      const data = await res.json()
      if (data.palette) setPalette(data.palette)
      if (data.theme?.bubbleColor) {
        const match = COLOR_OPTIONS.find(c => c.value === data.theme.bubbleColor)
        if (match) setSelectedColor(match.id)
      }
    } finally {
      setExtracting(false)
    }
  }

  const saveAppearance = async () => {
    setSavingAppearance(true)
    try {
      const theme = {
        bubbleColor: activeColor,
        headerColor: activeColor,
        userMsgColor: activeColor,
        sendBtnColor: activeColor,
        accentColor: activeColor,
      }
      await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })
      setAppearanceSaved(true)
      setTimeout(() => setAppearanceSaved(false), 2000)
    } finally {
      setSavingAppearance(false)
    }
  }

  const sendPreviewMessage = async (text?: string) => {
    const userText = text || previewInput.trim()
    if (!userText || previewStreaming || !userId) return

    const newMessages: Message[] = [...previewMessages, { role: 'user', content: userText }]
    setPreviewMessages(newMessages)
    setPreviewInput('')
    setPreviewStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, userId }),
      })

      if (!res.body) throw new Error('No stream')

      const streamMessages: Message[] = [...newMessages, { role: 'assistant', content: '' }]
      setPreviewMessages(streamMessages)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let streamed = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const textChunk = decoder.decode(value)
        const lines = textChunk.split('\n').filter(l => l.startsWith('data:'))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace('data: ', ''))
            if (data.token) {
              streamed += data.token
              setPreviewMessages([...newMessages, { role: 'assistant', content: streamed }])
              await new Promise(r => setTimeout(r, 18))
            }
            if (data.done) break
          } catch { }
        }
      }
    } catch (err: any) {
      setPreviewMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + err.message }])
    } finally {
      setPreviewStreaming(false)
    }
  }

  const embedCode = `<script\n  src="https://nocta-chat-bot.vercel.app/embed.js"\n  data-user-id="${userId}"\n  defer>\n</script>`

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const TABS: Tab[] = ['Crawl', 'Persona', 'Appearance', 'Preview', 'Embed']

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes typingBounce {
          0%,60%,100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 400, color: '#fff', letterSpacing: '-0.9px', marginBottom: 6 }}>
          Configure
        </h1>
        <p style={{ fontSize: 14, color: '#7d8187' }}>Set up and customize your AI chatbot.</p>
      </div>

      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid #2a2d35',
        marginBottom: 32, overflowX: 'auto'
      }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #36f4a4' : '2px solid transparent',
              color: activeTab === tab ? '#36f4a4' : '#7d8187',
              padding: '0 20px 14px', fontSize: 14, cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'color 0.15s',
              marginBottom: -1
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'Crawl' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 400, color: '#fff', marginBottom: 6 }}>Train your chatbot</h2>
              <p style={{ fontSize: 14, color: '#7d8187' }}>Paste your website URL. Nocta crawls up to 15 pages and learns your content.</p>
            </div>

            {knowledge.crawledAt && (
              <div style={{
                background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 8, padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: 12, color: '#7d8187' }}>Last crawled: </span>
                  <span style={{ fontSize: 12, color: '#fff' }}>{new Date(knowledge.crawledAt).toLocaleString()}</span>
                  <div style={{ fontSize: 12, color: '#36f4a4', marginTop: 2 }}>{knowledge.url}</div>
                </div>
                <button onClick={() => setCrawlDone(false)} style={{
                  background: 'transparent', border: '1px solid #2a2d35', color: '#7d8187',
                  borderRadius: 9999, padding: '6px 16px', fontSize: 13, cursor: 'pointer'
                }}>Re-crawl</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <input
                value={crawlUrl}
                onChange={e => setCrawlUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                disabled={crawling}
                onKeyDown={e => e.key === 'Enter' && startCrawl()}
                style={{
                  flex: 1, background: '#0a0a0a', border: '1px solid #2a2d35',
                  borderRadius: 8, padding: '12px 16px', color: '#fff',
                  fontSize: 14, outline: 'none', opacity: crawling ? 0.5 : 1
                }}
              />
              <button
                onClick={startCrawl}
                disabled={crawling || !crawlUrl.trim()}
                style={{
                  background: crawling ? '#7d8187' : '#36f4a4',
                  color: '#000', borderRadius: 9999, padding: '12px 24px',
                  border: 'none', fontWeight: 500, fontSize: 14,
                  cursor: crawling ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap', minWidth: 120,
                  display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                {crawling ? (
                  <>
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid #000', borderTopColor: 'transparent',
                      display: 'inline-block', animation: 'spin 0.8s linear infinite'
                    }} />
                    Crawling...
                  </>
                ) : 'Start Crawl'}
              </button>
            </div>

            {logs.length > 0 && (
              <div style={{
                background: '#0a0a0a', border: '1px solid #2a2d35',
                borderRadius: 12, padding: 20, maxHeight: 280, overflowY: 'auto'
              }}>
                <div style={{ fontSize: 12, color: '#7d8187', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {crawlDone ? '✅ Crawl Complete' : '⏳ Crawling...'}
                </div>
                {logs.map((log, i) => (
                  <div key={i} style={{
                    fontFamily: 'GeistMono, monospace', fontSize: 12,
                    color: i === logs.length - 1 && !crawlDone ? '#36f4a4' :
                           log.startsWith('✅') ? '#36f4a4' :
                           log.startsWith('✗') || log.startsWith('❌') ? '#ef4444' : '#7d8187',
                    padding: '3px 0', lineHeight: 1.6,
                  }}>
                    {log}
                  </div>
                ))}
                {crawlError && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>❌ {crawlError}</div>}
                <div ref={logsEndRef} />
              </div>
            )}

            {crawlDone && (
              <div style={{
                background: '#0d2420', border: '1px solid #36f4a430',
                borderRadius: 12, padding: 20, display: 'flex', gap: 32
              }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 400, color: '#36f4a4' }}>{crawlStats.pages}</div>
                  <div style={{ fontSize: 13, color: '#7d8187' }}>Pages crawled</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 400, color: '#36f4a4' }}>{crawlStats.chunks}</div>
                  <div style={{ fontSize: 13, color: '#7d8187' }}>Chunks indexed</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => setActiveTab('Persona')} style={{
                    background: '#36f4a4', color: '#000', borderRadius: 9999,
                    padding: '10px 20px', border: 'none', fontWeight: 500, fontSize: 14, cursor: 'pointer'
                  }}>Next: Set Persona →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Persona' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 400, color: '#fff', marginBottom: 6 }}>Bot Persona</h2>
              <p style={{ fontSize: 14, color: '#7d8187' }}>Give your chatbot a personality and instructions.</p>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: '#7d8187' }}>Instructions</label>
                <span style={{ fontSize: 12, color: '#4a4e56' }}>{systemPrompt.length} / 1000</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value.slice(0, 1000))}
                rows={10}
                placeholder="You are a helpful assistant for [Company Name]..."
                style={{
                  width: '100%', background: '#0a0a0a', border: '1px solid #2a2d35',
                  borderRadius: 8, padding: 16, color: '#fff', fontSize: 13,
                  fontFamily: 'GeistMono, monospace', lineHeight: 1.6, resize: 'vertical', outline: 'none'
                }}
              />
            </div>
            <button onClick={savePersona} disabled={savingPersona} style={{
              background: personaSaved ? '#0d2420' : '#36f4a4',
              color: personaSaved ? '#36f4a4' : '#000',
              border: personaSaved ? '1px solid #36f4a430' : 'none',
              borderRadius: 9999, padding: '12px 24px', fontWeight: 500, fontSize: 14,
              cursor: 'pointer', alignSelf: 'flex-start', transition: 'all 0.2s'
            }}>
              {personaSaved ? '✓ Persona Saved' : savingPersona ? 'Saving...' : 'Save Persona'}
            </button>
          </div>
        )}

        {activeTab === 'Appearance' && (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 400, color: '#fff', marginBottom: 6 }}>Appearance</h2>
                <p style={{ fontSize: 14, color: '#7d8187' }}>Customize how your chat widget looks.</p>
              </div>

              {knowledge.url && (
                <div style={{
                  background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 8, padding: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#fff' }}>Auto-detect brand colors</div>
                    <div style={{ fontSize: 12, color: '#7d8187' }}>Extract colors from your website</div>
                  </div>
                  <button onClick={extractTheme} disabled={extracting} style={{
                    background: 'transparent', border: '1px solid #2a2d35', color: '#7d8187',
                    borderRadius: 9999, padding: '6px 16px', fontSize: 13, cursor: 'pointer'
                  }}>{extracting ? 'Detecting...' : 'Detect Colors'}</button>
                </div>
              )}

              {palette.length > 0 && (
                <div>
                  <label style={{ fontSize: 13, color: '#7d8187', display: 'block', marginBottom: 10 }}>Detected from your website</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {palette.map(color => (
                      <div key={color} onClick={() => {
                        const match = COLOR_OPTIONS.find(c => c.value === color)
                        if (match) setSelectedColor(match.id)
                      }} style={{
                        width: 36, height: 36, borderRadius: '50%', background: color,
                        cursor: 'pointer', border: '2px solid #2a2d35'
                      }} title={color} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 13, color: '#7d8187', display: 'block', marginBottom: 10 }}>Bot Icon</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {ICON_OPTIONS.map(icon => (
                    <div key={icon.id} onClick={() => setSelectedIcon(icon.id)} style={{
                      height: 56, borderRadius: 12, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 24, cursor: 'pointer',
                      background: selectedIcon === icon.id ? '#36f4a420' : '#0a0a0a',
                      border: selectedIcon === icon.id ? '2px solid #36f4a4' : '1px solid #2a2d35'
                    }}>{icon.emoji}</div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, color: '#7d8187', display: 'block', marginBottom: 10 }}>Accent Color</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {COLOR_OPTIONS.map(color => (
                    <div key={color.id} onClick={() => setSelectedColor(color.id)} style={{
                      width: 40, height: 40, borderRadius: '50%', background: color.value,
                      cursor: 'pointer', border: selectedColor === color.id ? '2px solid #fff' : '2px solid transparent',
                      transform: selectedColor === color.id ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.15s'
                    }} />
                  ))}
                </div>
              </div>

              <button onClick={saveAppearance} disabled={savingAppearance} style={{
                background: appearanceSaved ? '#0d2420' : '#36f4a4', color: appearanceSaved ? '#36f4a4' : '#000',
                border: appearanceSaved ? '1px solid #36f4a430' : 'none', borderRadius: 9999,
                padding: '12px 24px', fontWeight: 500, fontSize: 14, cursor: 'pointer'
              }}>{appearanceSaved ? '✓ Saved' : savingAppearance ? 'Saving...' : 'Save Appearance'}</button>
            </div>

            <div style={{ width: 260, flexShrink: 0 }}>
              <label style={{ fontSize: 13, color: '#7d8187', display: 'block', marginBottom: 10 }}>Live Preview</label>
              <div style={{ background: '#f7f8fc', borderRadius: 16, overflow: 'hidden', border: '1px solid #2a2d35', fontFamily: 'DM Sans, sans-serif' }}>
                <div style={{ background: activeColor, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{activeIcon}</div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>AI Assistant</div>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '8px 12px', fontSize: 12, color: '#333', maxWidth: '85%' }}>Hi! How can I help you?</div>
                  <div style={{ background: activeColor, borderRadius: 12, padding: '8px 12px', fontSize: 12, color: '#000', maxWidth: '85%', alignSelf: 'flex-end' }}>Tell me more!</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 400, color: '#fff', marginBottom: 6 }}>Preview</h2>
              <p style={{ fontSize: 14, color: '#7d8187' }}>Test your chatbot live before embedding.</p>
            </div>
            {!knowledge.hasCrawled && (
              <div style={{ background: '#1f2228', border: '1px solid #eab308', borderRadius: 8, padding: 16, color: '#eab308', fontSize: 14 }}>⚠ You haven't crawled any website yet. Go to the Crawl tab first.</div>
            )}
            <div style={{ maxWidth: 560, background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#1f2228', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #2a2d35' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: activeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{activeIcon}</div>
                <div><div style={{ fontSize: 14, color: '#fff' }}>AI Assistant</div><div style={{ fontSize: 12, color: '#7d8187' }}>{previewStreaming ? 'Typing...' : '● Online'}</div></div>
              </div>
              <div style={{ height: 360, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {previewMessages.length === 0 ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4e56', fontSize: 13 }}>Send a message to test...</div> : 
                  previewMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '78%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: msg.role === 'user' ? activeColor : '#1f2228', color: msg.role === 'user' ? '#000' : '#fff', fontSize: 13
                      }}>{msg.content || '...'}</div>
                    </div>
                  ))
                }
                <div ref={previewBottomRef} />
              </div>
              <div style={{ borderTop: '1px solid #2a2d35', padding: 16, display: 'flex', gap: 10 }}>
                <input value={previewInput} onChange={e => setPreviewInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendPreviewMessage()} placeholder="Ask a question..." style={{ flex: 1, background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 8, padding: '10px 14px', color: '#fff' }} />
                <button onClick={() => sendPreviewMessage()} disabled={previewStreaming} style={{ background: activeColor, color: '#000', border: 'none', borderRadius: 9999, padding: '10px 18px', fontWeight: 500 }}>Send</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Embed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
            <div><h2 style={{ fontSize: 20, fontWeight: 400, color: '#fff', marginBottom: 6 }}>Embed Your Chatbot</h2><p style={{ fontSize: 14, color: '#7d8187' }}>Copy this script tag and paste it before &lt;/body&gt; on your website.</p></div>
            <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#7d8187' }}>HTML</span>
                <button onClick={copyEmbed} style={{ background: 'transparent', border: '1px solid #2a2d35', color: copied ? '#36f4a4' : '#7d8187', borderRadius: 9999, padding: '4px 14px', fontSize: 12 }}>{copied ? '✓ Copied!' : 'Copy'}</button>
              </div>
              <pre style={{ padding: 20, margin: 0, fontSize: 13, color: '#36f4a4', overflowX: 'auto' }}>{embedCode}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
