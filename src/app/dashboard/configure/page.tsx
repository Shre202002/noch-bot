'use client';

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
  Bot, Globe, Palette, Eye, Code2, Loader2, CheckCircle2, 
  AlertCircle, MessageSquare, Zap, Target, Brain, Star, Wand2, 
  Copy, Check, ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BOT_ICONS = [
  { id: 'robot', icon: Bot, label: 'Robot' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'bolt', icon: Zap, label: 'Bolt' },
  { id: 'target', icon: Target, label: 'Target' },
  { id: 'brain', icon: Brain, label: 'Brain' },
  { id: 'star', icon: Star, label: 'Star' },
  { id: 'wand', icon: Wand2, label: 'Wand' },
  { id: 'shield', icon: ShieldAlert, label: 'Shield' },
];

const ACCENT_COLORS = [
  { id: 'green', value: '#36f4a4', label: 'Emerald' },
  { id: 'blue', value: '#2563eb', label: 'Ocean' },
  { id: 'purple', value: '#8b5cf6', label: 'Grape' },
  { id: 'orange', value: '#FF5701', label: 'Sunset' },
  { id: 'pink', value: '#ec4899', label: 'Bubble' },
  { id: 'red', value: '#ef4444', label: 'Ruby' },
  { id: 'yellow', value: '#eab308', label: 'Gold' },
  { id: 'white', value: '#ffffff', label: 'Pure' },
];

export default function ConfigurePage() {
  const [activeTab, setActiveTab] = useState('Crawl');
  const [userId, setUserId] = useState('');
  const { toast } = useToast();

  // Shared state
  const [loading, setLoading] = useState(true);

  // Tab 1: Crawl
  const [url, setUrl] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [crawlDone, setCrawlDone] = useState(false);
  const [crawlError, setCrawlError] = useState('');
  const [lastCrawled, setLastCrawled] = useState<{ url: string, crawledAt: string } | null>(null);
  const [chunkCount, setChunkCount] = useState(0);

  // Tab 2: Persona
  const [botName, setBotName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [savingPersona, setSavingPersona] = useState(false);

  // Tab 3: Appearance
  const [botIcon, setBotIcon] = useState('robot');
  const [botColor, setBotColor] = useState('green');
  const [savingAppearance, setSavingAppearance] = useState(false);

  // Tab 4: Preview
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tab 5: Embed
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, knowledgeRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/knowledge')
        ]);

        if (meRes.ok) {
          const meData = await meRes.json();
          setUserId(meData.id);
        }

        if (knowledgeRes.ok) {
          const kData = await knowledgeRes.json();
          if (kData) {
            setUrl(kData.url || '');
            setBotName(kData.botName || '');
            setSystemPrompt(kData.systemPrompt || '');
            setBotIcon(kData.botIcon || 'robot');
            setBotColor(kData.botColor || 'green');
            if (kData.url && kData.crawledAt) {
              setLastCrawled({ url: kData.url, crawledAt: kData.crawledAt });
              setChunkCount(kData.chunkCount || 0);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load configuration:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startCrawl = async () => {
    if (!url) return;
    setCrawling(true);
    setLogs([]);
    setCrawlDone(false);
    setCrawlError('');

    try {
      // Simulation of a SSE crawl for UI demonstration
      // In a real implementation, this would be fetch('/api/crawl')
      const fakePages = ['/', '/about', '/pricing', '/features', '/docs'];
      for (let i = 0; i < fakePages.length; i++) {
        await new Promise(r => setTimeout(r, 800));
        setLogs(prev => [...prev, `✓ ${url}${fakePages[i]}`]);
      }
      
      await new Promise(r => setTimeout(r, 1000));
      setChunkCount(124);
      setLogs(prev => [...prev, `Done — 124 chunks indexed`]);
      setCrawlDone(true);
      setLastCrawled({ url, crawledAt: new Date().toISOString() });
      
      toast({
        title: "Crawl Complete",
        description: "Website successfully indexed.",
      });
    } catch (err) {
      setCrawlError('Crawl failed. Check the URL and try again.');
    } finally {
      setCrawling(false);
    }
  };

  const savePersona = async () => {
    setSavingPersona(true);
    try {
      const res = await fetch('/api/knowledge/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botName, systemPrompt }),
      });
      if (res.ok) {
        toast({ title: "Persona saved" });
      }
    } finally {
      setSavingPersona(false);
    }
  };

  const saveAppearance = async () => {
    setSavingAppearance(true);
    try {
      const res = await fetch('/api/knowledge/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botIcon, botColor }),
      });
      if (res.ok) {
        toast({ title: "Appearance saved" });
      }
    } finally {
      setSavingAppearance(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || streaming) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setStreaming(true);

    try {
      // Mock streaming response for preview UI
      let currentResponse = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      const words = "Hello! I am your Nocta agent. How can I help you today?".split(' ');
      for (const word of words) {
        await new Promise(r => setTimeout(r, 100));
        currentResponse += word + ' ';
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1].content = currentResponse.trim();
          return next;
        });
      }
    } finally {
      setStreaming(false);
    }
  };

  const copyEmbedCode = () => {
    const code = `<script
  src="https://nocta-chat-bot.vercel.app/embed.js"
  data-user-id="${userId}"
  defer>
</script>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Code copied to clipboard" });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeColorValue = ACCENT_COLORS.find(c => c.id === botColor)?.value || '#36f4a4';
  const ActiveIcon = BOT_ICONS.find(i => i.id === botIcon)?.icon || Bot;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.9px' }}>Configure</h1>
        <p className="text-muted-foreground">Set up your AI chatbot persona, knowledge, and style.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 mb-8 space-x-8">
          {['Crawl', 'Persona', 'Appearance', 'Preview', 'Embed'].map((tab) => (
            <TabsTrigger 
              key={tab}
              value={tab} 
              className="bg-transparent border-none rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary px-0 pb-3 text-sm font-medium transition-all"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Crawl" className="space-y-6 mt-0 outline-none">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Train your chatbot</CardTitle>
              <CardDescription>Paste your website URL. Nocta will crawl up to 15 pages and learn your content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {lastCrawled && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-2 text-xs">
                    <Globe className="h-3 w-3 text-primary" />
                    <span className="text-muted-foreground">Last crawled:</span>
                    <span className="text-foreground font-medium">{new Date(lastCrawled.crawledAt).toLocaleDateString()}</span>
                    <span className="text-muted-foreground">URL:</span>
                    <span className="text-foreground font-medium truncate max-w-[200px]">{lastCrawled.url}</span>
                  </div>
                  <div className="text-[10px] uppercase font-bold text-primary tracking-widest">
                    {chunkCount} Chunks
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Input 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourwebsite.com" 
                  className="bg-background border-border h-11"
                  disabled={crawling}
                />
                <Button 
                  onClick={startCrawl}
                  disabled={crawling || !url}
                  className="bg-primary text-primary-foreground h-11 px-8 font-bold"
                >
                  {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Crawl'}
                </Button>
              </div>

              {(crawling || logs.length > 0) && (
                <div className="mt-8 rounded-2xl bg-black border border-border p-5 space-y-4 shadow-inner">
                   <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {crawlDone ? 'Crawl Complete' : 'System Logs'}
                      </p>
                      {crawlDone ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                   </div>
                   <div className="space-y-1.5 max-h-[200px] overflow-y-auto font-mono text-xs">
                      {logs.map((log, i) => (
                        <div key={i} className={cn(
                          "transition-all duration-300",
                          i === logs.length - 1 ? "text-primary font-bold" : "text-muted-foreground/60"
                        )}>
                          {log}
                        </div>
                      ))}
                      {crawlError && <div className="text-destructive font-bold">✗ {crawlError}</div>}
                   </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Persona" className="space-y-6 mt-0 outline-none">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Bot Persona</CardTitle>
              <CardDescription>Give your chatbot a name and instructions on how to behave.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bot Name</label>
                <Input 
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="e.g. Nocta Assistant" 
                  maxLength={40}
                  className="bg-background border-border"
                />
                <p className="text-[11px] text-muted-foreground">This name appears in the chat widget header</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Instructions (System Prompt)</label>
                  <span className="text-[10px] font-bold text-muted-foreground">{systemPrompt.length} / 1000</span>
                </div>
                <Textarea 
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                  maxLength={1000}
                  placeholder="You are a helpful assistant..."
                  className="bg-black border-border font-mono text-sm leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">Tell the bot how to behave, what to focus on, and what tone to use (e.g. "professional", "friendly").</p>
              </div>

              <Button 
                onClick={savePersona}
                disabled={savingPersona}
                className="w-full bg-primary text-primary-foreground font-bold h-11"
              >
                {savingPersona ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Persona'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Appearance" className="mt-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-xl">Visual Style</CardTitle>
                  <CardDescription>Customize the look and feel of your chatbot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-sm font-medium">Bot Icon</label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                      {BOT_ICONS.map((icon) => (
                        <button
                          key={icon.id}
                          onClick={() => setBotIcon(icon.id)}
                          className={cn(
                            "h-12 w-12 flex items-center justify-center rounded-xl border transition-all",
                            botIcon === icon.id 
                              ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(54,244,164,0.2)]" 
                              : "border-border bg-black text-muted-foreground hover:border-muted-foreground/30"
                          )}
                          title={icon.label}
                        >
                          <icon.icon className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                       <label className="text-sm font-medium">Accent Color</label>
                       <p className="text-[11px] text-muted-foreground">Used for the chat bubble and buttons</p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {ACCENT_COLORS.map((color) => (
                        <button
                          key={color.id}
                          onClick={() => setBotColor(color.id)}
                          className={cn(
                            "h-10 w-10 rounded-full transition-transform hover:scale-110",
                            botColor === color.id ? "ring-2 ring-white ring-offset-4 ring-offset-black scale-110" : ""
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>

                  <Button 
                    onClick={saveAppearance}
                    disabled={savingAppearance}
                    className="w-full bg-primary text-primary-foreground font-bold h-11"
                  >
                    {savingAppearance ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Appearance'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
               <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Live Preview</p>
               <div className="bg-[#1f2228] border border-border rounded-3xl overflow-hidden shadow-2xl">
                  <div 
                    className="p-5 flex items-center gap-3 transition-colors duration-500" 
                    style={{ backgroundColor: activeColorValue }}
                  >
                     <div className="h-8 w-8 rounded-lg bg-black/20 flex items-center justify-center text-white">
                        <ActiveIcon className="h-4 w-4" />
                     </div>
                     <span className="font-bold text-black truncate text-sm">
                        {botName || 'My Bot'}
                     </span>
                     <div className="ml-auto h-2 w-2 rounded-full bg-black/30" />
                  </div>
                  <div className="h-64 p-5 flex flex-col gap-4 overflow-y-auto bg-black/40">
                     <div className="flex justify-start">
                        <div className="bg-[#2a2d35] rounded-2xl rounded-tl-none px-4 py-3 text-xs text-white max-w-[85%] leading-relaxed shadow-sm">
                           How can I help you?
                        </div>
                     </div>
                     <div className="flex justify-end">
                        <div 
                          className="rounded-2xl rounded-tr-none px-4 py-3 text-xs font-medium max-w-[85%] leading-relaxed shadow-lg transition-colors duration-500"
                          style={{ backgroundColor: activeColorValue, color: botColor === 'white' ? 'black' : 'black' }}
                        >
                           What is your pricing?
                        </div>
                     </div>
                  </div>
                  <div className="p-4 bg-black/60 border-t border-border flex gap-2">
                     <div className="flex-1 h-8 rounded-full bg-[#2a2d35] px-4 flex items-center text-[10px] text-muted-foreground">Type something...</div>
                     <div 
                       className="h-8 w-8 rounded-full flex items-center justify-center shadow-md transition-colors duration-500"
                       style={{ backgroundColor: activeColorValue }}
                     >
                        <Zap className="h-3 w-3 text-black" />
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="Preview" className="space-y-6 mt-0 outline-none">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Staging Environment</CardTitle>
              <CardDescription>Test your chatbot with real questions based on your crawled content.</CardDescription>
            </CardHeader>
            <CardContent>
              {!lastCrawled && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 mb-6">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">You haven't crawled any website yet. Go to the Crawl tab first to provide knowledge.</p>
                </div>
              )}

              <div className="max-w-[560px] mx-auto border border-border rounded-2xl overflow-hidden bg-black shadow-2xl">
                 <div 
                   className="px-5 py-3.5 flex items-center gap-3 border-b border-border/50 transition-colors"
                   style={{ backgroundColor: activeColorValue + '15' }}
                 >
                    <div 
                      className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: activeColorValue, color: 'black' }}
                    >
                       <ActiveIcon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-sm font-bold">{botName || 'Assistant'}</span>
                       <div className="flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Online</span>
                       </div>
                    </div>
                 </div>

                 <div 
                   ref={scrollRef}
                   className="h-[380px] overflow-y-auto p-5 flex flex-col gap-4 scroll-smooth"
                 >
                    {messages.length === 0 && (
                      <div className="flex justify-start">
                         <div className="bg-[#1f2228] rounded-2xl rounded-tl-none px-4 py-3 text-sm text-white/90 max-w-[85%] leading-relaxed">
                            Hi! I'm {botName || 'your assistant'}. Ask me anything about {lastCrawled ? new URL(lastCrawled.url).hostname : 'your website'}.
                         </div>
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                         <div className={cn(
                           "rounded-2xl px-4 py-3 text-sm max-w-[85%] leading-relaxed shadow-sm",
                           m.role === 'user' 
                             ? "rounded-tr-none font-medium" 
                             : "rounded-tl-none bg-[#1f2228] text-white/90"
                         )}
                         style={m.role === 'user' ? { backgroundColor: activeColorValue, color: 'black' } : {}}
                         >
                            {m.content || (
                              <div className="flex gap-1 py-1">
                                 <div className="h-1.5 w-1.5 rounded-full bg-white/20 animate-bounce" />
                                 <div className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce delay-100" />
                                 <div className="h-1.5 w-1.5 rounded-full bg-white/20 animate-bounce delay-200" />
                              </div>
                            )}
                         </div>
                      </div>
                    ))}
                 </div>

                 <form onSubmit={handleSendMessage} className="p-4 border-t border-border flex gap-2">
                    <Input 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a question..." 
                      className="bg-[#1f2228] border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-11 rounded-xl text-sm"
                      disabled={streaming}
                    />
                    <Button 
                      type="submit"
                      disabled={!chatInput.trim() || streaming}
                      className="rounded-xl h-11 w-11 p-0 transition-colors"
                      style={{ backgroundColor: activeColorValue, color: 'black' }}
                    >
                       <Zap className="h-4 w-4" />
                    </Button>
                 </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Embed" className="space-y-6 mt-0 outline-none">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Deploy to Production</CardTitle>
              <CardDescription>Copy this script tag and paste it before the closing &lt;/body&gt; tag on your website.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {!lastCrawled && (
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
                  <p className="text-sm font-medium">⚠ Your chatbot has no knowledge yet. Complete the Crawl tab first so it can answer questions.</p>
                </div>
              )}

              <div className="relative group">
                <div className="absolute right-4 top-4">
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={copyEmbedCode}
                    className="h-8 gap-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-full text-xs font-bold"
                   >
                     {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                     {copied ? 'Copied!' : 'Copy'}
                   </Button>
                </div>
                <div className="p-8 rounded-2xl bg-black border border-border font-mono text-sm leading-relaxed overflow-x-auto text-primary shadow-inner">
                  <pre>{`<script
  src="https://nocta.ai/v1.js"
  data-id="${userId || 'YOUR_USER_ID'}"
  defer>
</script>`}</pre>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                 <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">How to install</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <InstallStep 
                      num="1" 
                      title="Copy tag" 
                      desc="Copy the unique script tag generated for your account." 
                    />
                    <InstallStep 
                      num="2" 
                      title="Paste in HTML" 
                      desc="Place it before the closing </body> tag on your website." 
                    />
                    <InstallStep 
                      num="3" 
                      title="Go Live" 
                      desc="Your AI agent is now active and ready to help users." 
                    />
                 </div>
              </div>

              <div className="pt-6 border-t border-border">
                 <p className="text-xs text-muted-foreground text-center">
                    Compatibility: <span className="text-foreground font-medium">Next.js · React · WordPress · Webflow · Framer · Wix · HTML</span>
                 </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstallStep({ num, title, desc }: { num: string, title: string, desc: string }) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-accent/30 border border-border hover:bg-accent/50 transition-colors">
       <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
          {num}
       </div>
       <h5 className="font-bold text-sm">{title}</h5>
       <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
