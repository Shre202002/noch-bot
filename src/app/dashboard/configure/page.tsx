'use client';

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

type Tab = 'Crawl' | 'Embed' | 'Theme' | 'Preview' | 'Embed Code'

type Message = { role: 'user' | 'assistant'; content: string }

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

const THEME_COMPONENTS = [
  { key: 'bubbleColor',  label: 'Chat Bubble',     desc: 'Floating button color' },
  { key: 'headerColor',  label: 'Header Bar',       desc: 'Top bar of chat window' },
  { key: 'userMsgColor', label: 'User Messages',    desc: 'Sent message bubbles' },
  { key: 'sendBtnColor', label: 'Send Button',      desc: 'Send arrow button' },
  { key: 'accentColor',  label: 'Accent / Links',   desc: 'Hover states and links' },
] as const

export default function ConfigurePage() {
  // Step 1 — Crawl
  const [crawlUrl, setCrawlUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlLogs, setCrawlLogs] = useState<string[]>([])
  const [crawledPages, setCrawledPages] = useState<{url: string, chars: number}[]>([])
  const [crawlDone, setCrawlDone] = useState(false)
  const [crawlError, setCrawlError] = useState('')

  // Step 2 — Embedding
  const [embedding, setEmbedding] = useState(false)
  const [embedLogs, setEmbedLogs] = useState<string[]>([])
  const [embedDone, setEmbedDone] = useState(false)
  const [chunkCount, setChunkCount] = useState(0)

  // Step 3 — Theme
  const [extractingTheme, setExtractingTheme] = useState(false)
  const [palette, setPalette] = useState<string[]>([])
  const [themeConfig, setThemeConfig] = useState({
    bubbleColor:  '#36f4a4',
    headerColor:  '#36f4a4',
    userMsgColor: '#36f4a4',
    sendBtnColor: '#36f4a4',
    accentColor:  '#36f4a4',
  })
  const [themeSaved, setThemeSaved] = useState(false)

  // Step 4 — Preview
  const [previewMessages, setPreviewMessages] = useState<Message[]>([])
  const [previewInput, setPreviewInput] = useState('')
  const [previewStreaming, setPreviewStreaming] = useState(false)

  // Step 5 — Embed
  const [copied, setCopied] = useState(false)

  // Global
  const [activeTab, setActiveTab] = useState<Tab>('Crawl')
  const [userId, setUserId] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)
  const previewBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Get userId
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.id) setUserId(d.id) })

    // Dynamic base URL
    setBaseUrl(window.location.origin)

    // Load existing knowledge
    fetch('/api/knowledge')
      .then(r => r.json())
      .then(d => {
        if (d.url) {
          setCrawlUrl(d.url)
          setCrawlDone(true)
          setEmbedDone(true)
        }
        if (d.theme) setThemeConfig(d.theme)
        if (d.palette) setPalette(d.palette)
      })
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [crawlLogs, embedLogs])

  useEffect(() => {
    previewBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [previewMessages, previewStreaming])

  const startCrawl = async () => {
    if (!crawlUrl.trim()) return
    setCrawling(true)
    setCrawlLogs([])
    setCrawledPages([])
    setCrawlDone(false)
    setCrawlError('')
    setEmbedDone(false)
    setChunkCount(0)
    setEmbedLogs([])

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl.trim() }),
      })

      if (!res.body) throw new Error('No response stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const pages: {url: string, chars: number}[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data:'))

        for (const line of lines) {
          try {
            const event = JSON.parse(line.replace('data: ', '').trim())

            switch(event.type) {
              case 'start':
                setCrawlLogs(['🚀 ' + event.message])
                break
              case 'crawling':
                setCrawlLogs(prev => [...prev, `🔍 [${event.count}] ${event.page}`])
                break
              case 'page_done':
                pages.push({ url: event.page, chars: event.chars })
                setCrawledPages([...pages])
                setCrawlLogs(prev => [...prev, `✓ ${event.page}`])
                break
              case 'page_error':
                setCrawlLogs(prev => [...prev, `✗ Failed: ${event.page}`])
                break
              case 'embedding':
                setEmbedLogs(prev => [...prev, `⚡ ${event.message}`])
                if (event.message?.includes('vectors stored')) {
                  setEmbedDone(true)
                  const match = event.message.match(/(\d+) vectors/)
                  if (match) setChunkCount(parseInt(match[1]))
                }
                break
              case 'done':
                setCrawlDone(true)
                setChunkCount(event.chunks || 0)
                setCrawlLogs(prev => [...prev, `✅ Crawl complete — ${event.pagesCrawled} pages`])
                break
              case 'error':
                setCrawlError(event.message)
                setCrawlLogs(prev => [...prev, `❌ ${event.message}`])
                break
            }
          } catch { }
        }
      }
    } catch (err: any) {
      setCrawlError(err.message)
    } finally {
      setCrawling(false)
    }
  }

  const extractTheme = async () => {
    if (!crawlUrl) return
    setExtractingTheme(true)
    setPalette([])
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
          bubbleColor:  primary,
          headerColor:  primary,
          userMsgColor: primary,
          sendBtnColor: primary,
          accentColor:  data.palette[1] || primary,
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
    } catch (err) {
      console.error('Save theme failed:', err)
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

  const embedCode = `<script\n  src="${baseUrl}/embed.js"\n  data-user-id="${userId}"\n  defer>\n</script>`

  const TABS = ['Crawl', 'Embed', 'Theme', 'Preview', 'Embed Code'] as const

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
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
        <p style={{ fontSize: 14, color: '#7d8187' }}>Set up your AI chatbot step by step.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { tab: 'Crawl', done: crawlDone, label: '1. Crawl' },
          { tab: 'Embed', done: embedDone, label: '2. Vectorize' },
          { tab: 'Theme', done: themeSaved, label: '3. Theme' },
          { tab: 'Preview', done: previewMessages.length > 0, label: '4. Preview' },
          { tab: 'Embed Code', done: false, label: '5. Embed' },
        ].map(({ tab, done, label }) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 9999, cursor: 'pointer',
              background: activeTab === tab ? '#36f4a420' : 'transparent',
              border: activeTab === tab ? '1px solid #36f4a4' : '1px solid #2a2d35',
              color: activeTab === tab ? '#36f4a4' : done ? '#7d8187' : '#4a4e56',
              fontSize: 13, transition: 'all 0.15s'
            }}
          >
            {done && <span style={{ color: '#36f4a4' }}>✓</span>}
            {label}
          </div>
        ))}
      </div>

      <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 16, padding: 32 }}>
        {activeTab === 'Crawl' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <div>
              <h2 style={{ fontSize:20, color:'#fff', fontWeight:400, marginBottom:6 }}>Step 1 — Crawl Your Website</h2>
              <p style={{ fontSize:14, color:'#7d8187' }}>Enter your website URL. Nocta will crawl up to 15 pages and extract all content.</p>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <input
                value={crawlUrl}
                onChange={e => setCrawlUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !crawling && startCrawl()}
                placeholder="https://yourwebsite.com"
                disabled={crawling}
                style={{
                  flex:1, background:'#0a0a0a', border:'1px solid #2a2d35',
                  borderRadius:8, padding:'12px 16px', color:'#fff',
                  fontSize:14, outline:'none'
                }}
              />
              <button
                onClick={startCrawl}
                disabled={crawling || !crawlUrl.trim()}
                style={{
                  background: crawling ? '#2a2d35' : '#36f4a4',
                  color: crawling ? '#7d8187' : '#000',
                  border:'none', borderRadius:9999,
                  padding:'12px 28px', fontWeight:500,
                  fontSize:14, cursor: crawling ? 'not-allowed' : 'pointer',
                  display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap'
                }}
              >
                {crawling ? (
                  <>
                    <span style={{
                      width:14, height:14, border:'2px solid #7d8187',
                      borderTopColor:'#fff', borderRadius:'50%',
                      display:'inline-block', animation:'spin 0.8s linear infinite'
                    }}/>
                    Crawling...
                  </>
                ) : crawlDone ? 'Re-crawl' : 'Start Crawl'}
              </button>
            </div>

            {crawlLogs.length > 0 && (
              <div style={{
                background:'#0a0a0a', border:'1px solid #2a2d35',
                borderRadius:12, padding:20, maxHeight:220, overflowY:'auto'
              }}>
                <div style={{ fontSize:11, color:'#7d8187', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Live Log</div>
                {crawlLogs.map((log, i) => (
                  <div key={i} style={{
                    fontFamily:'GeistMono, monospace', fontSize:12, padding:'2px 0',
                    color: log.startsWith('✅') ? '#36f4a4' : log.startsWith('❌') || log.startsWith('✗') ? '#ef4444' : i === crawlLogs.length-1 ? '#36f4a4' : '#7d8187'
                  }}>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}

            {crawledPages.length > 0 && (
              <div style={{ background:'#1f2228', border:'1px solid #2a2d35', borderRadius:12, padding:20 }}>
                <div style={{ fontSize:11, color:'#7d8187', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.08em' }}>Crawled Pages ({crawledPages.length})</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {crawledPages.map((page, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#0a0a0a', borderRadius:8, border:'1px solid #2a2d35' }}>
                      <span style={{ fontSize:12, color:'#fff', fontFamily:'GeistMono, monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'75%' }}>{page.url}</span>
                      <span style={{ fontSize:11, color:'#7d8187', flexShrink:0 }}>{(page.chars/1000).toFixed(1)}k chars</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {crawlError && <div style={{ background:'#1a0a0a', border:'1px solid #ef4444', borderRadius:8, padding:16, color:'#ef4444', fontSize:14 }}>❌ {crawlError}</div>}
            {crawlDone && (
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button onClick={() => setActiveTab('Embed')} style={{ background:'#36f4a4', color:'#000', border:'none', borderRadius:9999, padding:'12px 28px', fontWeight:500, fontSize:14, cursor:'pointer' }}>Next: Vectorize Data →</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Embed' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
            <div>
              <h2 style={{ fontSize:20, color:'#fff', fontWeight:400, marginBottom:6 }}>Step 2 — Vectorize & Store</h2>
              <p style={{ fontSize:14, color:'#7d8187' }}>Your crawled content is chunked into 500-word segments and stored as vectors in Qdrant.</p>
            </div>
            {!crawlDone ? (
              <div style={{ background:'#1f2228', border:'1px solid #eab308', borderRadius:8, padding:16, color:'#eab308', fontSize:14 }}>⚠ Complete Step 1 (Crawl) first.</div>
            ) : (
              <>
                <div style={{ background:'#0a0a0a', border:'1px solid #2a2d35', borderRadius:12, padding:20, minHeight:120 }}>
                  <div style={{ fontSize:11, color:'#7d8187', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Vector Storage Log</div>
                  {embedLogs.length === 0 ? <div style={{ color:'#4a4e56', fontSize:13 }}>Embedding logs will appear here during crawl...</div> : embedLogs.map((log, i) => (
                    <div key={i} style={{ fontFamily:'GeistMono, monospace', fontSize:12, padding:'2px 0', color: log.includes('✅') ? '#36f4a4' : '#7d8187' }}>{log}</div>
                  ))}
                </div>
                {embedDone && (
                  <div style={{ display:'flex', gap:24, background:'#0d2420', border:'1px solid #36f4a430', borderRadius:12, padding:24 }}>
                    <div><div style={{ fontSize:32, color:'#36f4a4', fontWeight:400 }}>{chunkCount}</div><div style={{ fontSize:13, color:'#7d8187' }}>Chunks indexed</div></div>
                    <div><div style={{ fontSize:32, color:'#36f4a4', fontWeight:400 }}>{crawledPages.length}</div><div style={{ fontSize:13, color:'#7d8187' }}>Pages vectorized</div></div>
                    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center' }}><div style={{ background:'#36f4a420', border:'1px solid #36f4a430', borderRadius:8, padding:'8px 16px', color:'#36f4a4', fontSize:13 }}>✓ Stored in Qdrant</div></div>
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button onClick={() => setActiveTab('Theme')} style={{ background:'#36f4a4', color:'#000', border:'none', borderRadius:9999, padding:'12px 28px', fontWeight:500, fontSize:14, cursor:'pointer' }}>Next: Detect Theme →</button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'Theme' && (
          <div style={{ display:'flex', gap:32, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:300, display:'flex', flexDirection:'column', gap:24 }}>
              <div><h2 style={{ fontSize:20, color:'#fff', fontWeight:400, marginBottom:6 }}>Step 3 — Detect & Set Theme</h2><p style={{ fontSize:14, color:'#7d8187' }}>Auto-detect your brand colors, then assign each color to chatbot components.</p></div>
              <button onClick={extractTheme} disabled={extractingTheme || !crawlUrl} style={{ background:'transparent', border:'1px solid #36f4a4', color:'#36f4a4', borderRadius:9999, padding:'12px 24px', fontSize:14, cursor:'pointer', alignSelf:'flex-start', display:'flex', alignItems:'center', gap:8, opacity: !crawlUrl ? 0.4 : 1 }}>
                {extractingTheme ? (<><span style={{ width:14, height:14, border:'2px solid #36f4a4', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }}/>Detecting...</>) : '🎨 Detect Brand Colors'}
              </button>
              {palette.length > 0 && (
                <div><div style={{ fontSize:12, color:'#7d8187', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Detected Colors ({palette.length})</div><div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>{palette.map((color, i) => (<div key={i} title={color} style={{ width:40, height:40, borderRadius:'50%', background:color, cursor:'pointer', border:'2px solid #2a2d35', transition:'transform 0.15s', position:'relative' }}><div style={{ position:'absolute', bottom:-20, left:'50%', transform:'translateX(-50%)', fontSize:9, color:'#4a4e56', fontFamily:'GeistMono, monospace', whiteSpace:'nowrap' }}>{color}</div></div>))}</div></div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:8 }}>
                <div style={{ fontSize:13, color:'#fff' }}>Assign Colors to Components</div>
                {THEME_COMPONENTS.map(({ key, label, desc }) => (
                  <div key={key} style={{ background:'#1f2228', border:'1px solid #2a2d35', borderRadius:10, padding:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}><div><div style={{ fontSize:13, color:'#fff' }}>{label}</div><div style={{ fontSize:11, color:'#7d8187' }}>{desc}</div></div><div style={{ width:32, height:32, borderRadius:8, background: themeConfig[key as keyof typeof themeConfig], border:'2px solid #2a2d35', flexShrink:0 }} /></div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {palette.map((color, i) => (<div key={`palette-${i}`} onClick={() => setThemeConfig(prev => ({ ...prev, [key]: color }))} title={color} style={{ width:28, height:28, borderRadius:'50%', background:color, cursor:'pointer', border: themeConfig[key as keyof typeof themeConfig] === color ? '2px solid #fff' : '2px solid transparent', transform: themeConfig[key as keyof typeof themeConfig] === color ? 'scale(1.15)' : 'scale(1)', transition:'all 0.15s' }} />))}
                      {palette.length > 0 && <div style={{ width:1, background:'#2a2d35', margin:'0 4px' }} />}
                      {['#36f4a4','#2563eb','#8b5cf6','#FF5701','#ec4899','#ef4444','#eab308','#ffffff'].map(color => (<div key={color} onClick={() => setThemeConfig(prev => ({ ...prev, [key]: color }))} title={color} style={{ width:28, height:28, borderRadius:'50%', background:color, cursor:'pointer', border: themeConfig[key as keyof typeof themeConfig] === color ? '2px solid #fff' : '2px solid transparent', transform: themeConfig[key as keyof typeof themeConfig] === color ? 'scale(1.15)' : 'scale(1)', transition:'all 0.15s' }} />))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={saveTheme} style={{ background: themeSaved ? '#0d2420' : '#36f4a4', color: themeSaved ? '#36f4a4' : '#000', border: themeSaved ? '1px solid #36f4a430' : 'none', borderRadius:9999, padding:'12px 28px', fontWeight:500, fontSize:14, cursor:'pointer', alignSelf:'flex-start', transition:'all 0.2s' }}>{themeSaved ? '✓ Theme Saved' : 'Save Theme'}</button>
              <div style={{ display:'flex', justifyContent:'flex-end' }}><button onClick={() => setActiveTab('Preview')} style={{ background:'#36f4a4', color:'#000', border:'none', borderRadius:9999, padding:'12px 28px', fontWeight:500, fontSize:14, cursor:'pointer' }}>Next: Preview Chatbot →</button></div>
            </div>
            <div style={{ width:260, flexShrink:0 }}>
              <div style={{ fontSize:12, color:'#7d8187', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Live Preview</div>
              <div style={{ background:'#f7f8fc', borderRadius:16, overflow:'hidden', border:'1px solid #2a2d35', fontFamily:'DM Sans, sans-serif' }}>
                <div style={{ background: themeConfig.headerColor, padding:'14px 16px', display:'flex', alignItems:'center', gap:10 }}><div style={{ width:32, height:32, borderRadius:10, background:'rgba(0,0,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🤖</div><div><div style={{ fontSize:13, fontWeight:500, color:'#fff' }}>AI Assistant</div><div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>● Online</div></div></div>
                <div style={{ padding:12, display:'flex', flexDirection:'column', gap:8 }}><div style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:'8px 12px', fontSize:12, color:'#333', maxWidth:'85%' }}>Hi! How can I help you today?</div><div style={{ background: themeConfig.userMsgColor, borderRadius:12, padding:'8px 12px', fontSize:12, color:'#000', maxWidth:'85%', alignSelf:'flex-end' }}>Tell me more!</div></div>
                <div style={{ borderTop:'1px solid #eee', padding:'10px 12px', display:'flex', gap:8, alignItems:'center', background:'#fff' }}><div style={{ flex:1, fontSize:11, color:'#bbb', fontStyle:'italic' }}>Ask a question...</div><div style={{ width:26, height:26, borderRadius:8, background: themeConfig.sendBtnColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>➤</div></div>
                <div style={{ padding:'10px 12px', display:'flex', justifyContent:'flex-end' }}><div style={{ width:44, height:44, borderRadius:'50%', background: themeConfig.bubbleColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>💬</div></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div><h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 4 — Preview Your Chatbot</h2><p style={{ fontSize: 14, color: '#7d8187' }}>Interact with your agent live using the custom colors you selected.</p></div>
            {!crawlDone && <div style={{ background:'#1f2228', border:'1px solid #eab308', borderRadius:8, padding:16, color:'#eab308', fontSize:14 }}>⚠ Complete Step 1 (Crawl) first.</div>}
            <div style={{ maxWidth: 560, background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: themeConfig.headerColor, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #2a2d35' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                <div><div style={{ fontSize: 14, color: '#fff' }}>AI Assistant</div><div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff/70' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: previewStreaming ? '#eab308' : '#36f4a4' }} />{previewStreaming ? 'Typing...' : 'Online'}</div></div>
              </div>
              <div style={{ height: 360, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {previewMessages.length === 0 ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4e56', fontSize: 13 }}>Send a message to test your chatbot...</div> : previewMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? themeConfig.userMsgColor : '#1f2228', color: msg.role === 'user' ? '#000' : '#fff', fontSize: 13, lineHeight: 1.55, border: msg.role === 'assistant' ? '1px solid #2a2d35' : 'none' }}>
                      {msg.content || <span style={{ display: 'flex', gap: 4 }}>{[0,1,2].map(i => (<span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7d8187', display: 'inline-block', animation: `typingBounce 1.2s infinite ${i * 0.2}s` }} />))}</span>}
                    </div>
                  </div>
                ))}
                <div ref={previewBottomRef} />
              </div>
              <div style={{ borderTop: '1px solid #2a2d35', padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input value={previewInput} onChange={e => setPreviewInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendPreviewMessage()} placeholder="Ask a question..." disabled={previewStreaming || !crawlDone} style={{ flex: 1, background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', opacity: !crawlDone ? 0.5 : 1 }} />
                <button onClick={() => sendPreviewMessage()} disabled={previewStreaming || !previewInput.trim() || !crawlDone} style={{ background: themeConfig.sendBtnColor, color: '#000', border: 'none', borderRadius: 9999, padding: '10px 18px', fontWeight: 500, fontSize: 13, cursor: 'pointer', opacity: previewStreaming ? 0.5 : 1 }}>Send</button>
              </div>
            </div>
            {previewMessages.length > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end' }}><button onClick={() => setActiveTab('Embed Code')} style={{ background:'#36f4a4', color:'#000', border:'none', borderRadius:9999, padding:'12px 28px', fontWeight:500, fontSize:14, cursor:'pointer' }}>Next: Get Embed Code →</button></div>
            )}
          </div>
        )}

        {activeTab === 'Embed Code' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24, maxWidth:640 }}>
            <div><h2 style={{ fontSize:20, color:'#fff', fontWeight:400, marginBottom:6 }}>Step 5 — Embed Your Chatbot</h2><p style={{ fontSize:14, color:'#7d8187' }}>Paste this script tag before &lt;/body&gt; on any website. Works on localhost and in production automatically.</p></div>
            {!crawlDone && <div style={{ background:'#1f2228', border:'1px solid #eab308', borderRadius:8, padding:16, color:'#eab308', fontSize:14 }}>⚠ Complete Steps 1–3 before embedding.</div>}
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'#1f2228', border:'1px solid #2a2d35', borderRadius:8, padding:'10px 16px', alignSelf:'flex-start' }}><div style={{ width:8, height:8, borderRadius:'50%', background: baseUrl.includes('localhost') ? '#eab308' : '#36f4a4' }}/><span style={{ fontSize:13, color:'#7d8187' }}>Environment: <span style={{ color:'#fff' }}>{baseUrl}</span></span></div>
            <div style={{ background:'#0a0a0a', border:'1px solid #2a2d35', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'10px 16px', borderBottom:'1px solid #2a2d35', display:'flex', justifyContent:'space-between', alignItems:'center' }}><span style={{ fontSize:12, color:'#7d8187', fontFamily:'GeistMono, monospace' }}>HTML — paste before &lt;/body&gt;</span><button onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ background: copied ? '#0d2420' : 'transparent', border:'1px solid #2a2d35', color: copied ? '#36f4a4' : '#7d8187', borderRadius:9999, padding:'4px 14px', fontSize:12, cursor:'pointer', transition:'all 0.2s' }}>{copied ? '✓ Copied!' : 'Copy'}</button></div>
              <pre style={{ padding:20, margin:0, fontSize:13, fontFamily:'GeistMono, monospace', color:'#36f4a4', overflowX:'auto', lineHeight:1.8 }}>{embedCode}</pre>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}><div style={{ fontSize:11, color:'#7d8187', textTransform:'uppercase', letterSpacing:'0.08em' }}>How to install</div>{['Copy the script tag above', 'Paste it before </body> in your website HTML', 'Save and reload — your chatbot is live instantly', 'Works on: Next.js, React, WordPress, Webflow, plain HTML'].map((step, i) => (<div key={i} style={{ display:'flex', alignItems:'center', gap:14 }}><div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, background:'#36f4a420', color:'#36f4a4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500 }}>{i + 1}</div><span style={{ fontSize:14, color:'#7d8187' }}>{step}</span></div>))}</div>
          </div>
        )}
      </div>
    </div>
  )
}
