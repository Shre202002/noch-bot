'use client';

import { useState, useEffect } from 'react';
import { FileText, Users, MessageSquare, TrendingUp, ChevronRight, X, Clock, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type Stats = {
  totalSessions: number;
  totalMessages: number;
  uniqueVisitors: number;
  avgMessages: string;
};

type ChartPoint = { date: string; count: number };

type PdfStat = {
  fileId: string;
  label: string;
  sessions: number;
  totalMessages: number;
  lastActive: string;
};

type Session = {
  sessionId: string;
  slug: string;
  fileId: string;
  label: string;
  messageCount: number;
  createdAt: string;
  lastActiveAt: string;
  ip: string;
  userAgent: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tokenEstimate: number;
};

const mdComponents = {
  h2: ({ children }: any) => <h2 style={{ fontSize: 13, fontWeight: 700, color: '#36f4a4', margin: '8px 0 4px' }}>{children}</h2>,
  h3: ({ children }: any) => <h3 style={{ fontSize: 12, fontWeight: 600, color: '#a8f0d0', margin: '6px 0 3px' }}>{children}</h3>,
  p: ({ children }: any) => <p style={{ margin: '3px 0', lineHeight: 1.6 }}>{children}</p>,
  strong: ({ children }: any) => <strong style={{ color: '#fff', fontWeight: 700 }}>{children}</strong>,
  ul: ({ children }: any) => <ul style={{ paddingLeft: 16, margin: '4px 0' }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ paddingLeft: 16, margin: '4px 0' }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ margin: '2px 0', lineHeight: 1.5 }}>{children}</li>,
  table: ({ children }: any) => (
    <div style={{ overflowX: 'auto', margin: '6px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>{children}</table>
    </div>
  ),
  th: ({ children }: any) => <th style={{ border: '1px solid #36f4a440', padding: '4px 8px', color: '#36f4a4', fontWeight: 600, textAlign: 'left' }}>{children}</th>,
  td: ({ children }: any) => <td style={{ border: '1px solid #2a2d35', padding: '4px 8px', color: '#e8eaed' }}>{children}</td>,
  code: ({ children }: any) => <code style={{ background: '#0a0a0a', borderRadius: 3, padding: '1px 4px', fontSize: 11, color: '#36f4a4', fontFamily: 'monospace' }}>{children}</code>,
};

function MiniChart({ data, color }: { data: ChartPoint[]; color: string }) {
  if (!data.length) return <div style={{ color: '#4a4e56', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No data yet</div>;

  const max = Math.max(...data.map(d => d.count), 1);
  const width = 400;
  const height = 80;
  const padX = 4;
  const padY = 8;

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * (width - padX * 2);
    const y = padY + (1 - d.count / max) * (height - padY * 2);
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = `${padX},${height} ${points} ${width - padX},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 80 }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = padX + (i / Math.max(data.length - 1, 1)) * (width - padX * 2);
        const y = padY + (1 - d.count / max) * (height - padY * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PdfAnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessionsOverTime, setSessionsOverTime] = useState<ChartPoint[]>([]);
  const [messagesOverTime, setMessagesOverTime] = useState<ChartPoint[]>([]);
  const [pdfStats, setPdfStats] = useState<PdfStat[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Session viewer
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Filters
  const [filterFileId, setFilterFileId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/pdf-analytics')
      .then(r => r.json())
      .then(data => {
        setStats(data.stats);
        setSessionsOverTime(data.sessionsOverTime || []);
        setMessagesOverTime(data.messagesOverTime || []);
        setPdfStats(data.pdfStats || []);
        setSessions(data.recentSessions || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const openSession = async (session: Session) => {
    setSelectedSession(session);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/pdf-analytics/session/${session.sessionId}`);
      const data = await res.json();
      setSessionMessages(data.messages || []);
    } finally {
      setLoadingMessages(false);
    }
  };

  const filteredSessions = sessions.filter(s => {
    const matchesPdf = filterFileId === 'all' || s.fileId === filterFileId;
    const matchesSearch = !searchQuery || s.label.toLowerCase().includes(searchQuery.toLowerCase()) || s.ip.includes(searchQuery);
    return matchesPdf && matchesSearch;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#36f4a4', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 28, height: 28, border: '2px solid #36f4a4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#7d8187', fontSize: 13 }}>Loading analytics...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px', maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .session-row:hover { background: #0d1a16 !important; border-color: #36f4a440 !important; }
        .pdf-row:hover { background: #0d1a16 !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <TrendingUp size={24} color="#36f4a4" />
          <h1 style={{ fontSize: 28, fontWeight: 400, color: '#fff', letterSpacing: '-0.6px', margin: 0 }}>PDF Chat Analytics</h1>
        </div>
        <p style={{ fontSize: 13, color: '#7d8187', margin: 0 }}>Real conversations from your shared PDF links</p>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Sessions',    value: stats?.totalSessions ?? 0,   icon: Users,          color: '#36f4a4' },
          { label: 'Total Messages',    value: stats?.totalMessages ?? 0,   icon: MessageSquare,  color: '#60a5fa' },
          { label: 'Unique Visitors',   value: stats?.uniqueVisitors ?? 0,  icon: Globe,          color: '#f59e0b' },
          { label: 'Avg Msgs/Session',  value: stats?.avgMessages ?? '0',   icon: TrendingUp,     color: '#a78bfa' },
        ].map(card => (
          <div key={card.label} style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 14, padding: '18px 20px', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#7d8187' }}>{card.label}</span>
              <card.icon size={16} color={card.color} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        {[
          { title: 'Sessions Over Time', data: sessionsOverTime, color: '#36f4a4' },
          { title: 'User Messages Over Time', data: messagesOverTime, color: '#60a5fa' },
        ].map(chart => (
          <div key={chart.title} style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, marginBottom: 14 }}>{chart.title}</div>
            <MiniChart data={chart.data} color={chart.color} />
            {chart.data.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: '#4a4e56' }}>{formatShortDate(chart.data[0].date)}</span>
                <span style={{ fontSize: 10, color: '#4a4e56' }}>{formatShortDate(chart.data[chart.data.length - 1].date)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── PDF Breakdown ── */}
      <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 14, padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={15} color="#36f4a4" /> PDF Performance
        </div>
        {pdfStats.length === 0 ? (
          <div style={{ color: '#4a4e56', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data yet — share a PDF link to start tracking</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2d35' }}>
                {['PDF', 'Sessions', 'Messages', 'Last Active'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#7d8187', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pdfStats.map(pdf => (
                <tr key={pdf.fileId} className="pdf-row" style={{ borderBottom: '1px solid #1a1d24', cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => setFilterFileId(pdf.fileId === filterFileId ? 'all' : pdf.fileId)}>
                  <td style={{ padding: '10px 12px', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={13} color="#36f4a4" />
                      {pdf.label || 'Untitled'}
                      {filterFileId === pdf.fileId && <span style={{ fontSize: 10, background: '#36f4a420', color: '#36f4a4', borderRadius: 4, padding: '1px 6px' }}>filtered</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#60a5fa' }}>{pdf.sessions}</td>
                  <td style={{ padding: '10px 12px', color: '#a78bfa' }}>{pdf.totalMessages}</td>
                  <td style={{ padding: '10px 12px', color: '#7d8187' }}>{pdf.lastActive ? formatDate(pdf.lastActive) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Sessions List ── */}
      <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={15} color="#36f4a4" />
            Chat Sessions
            <span style={{ fontSize: 11, color: '#7d8187', fontWeight: 400 }}>({filteredSessions.length})</span>
            {filterFileId !== 'all' && (
              <button onClick={() => setFilterFileId('all')} style={{ fontSize: 10, background: '#36f4a420', color: '#36f4a4', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                Clear filter ×
              </button>
            )}
          </div>
          <input
            placeholder="Search by label or IP..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 12, outline: 'none', width: 220 }}
          />
        </div>

        {filteredSessions.length === 0 ? (
          <div style={{ color: '#4a4e56', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
            No sessions yet — share a PDF link to start getting conversations
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredSessions.map(session => (
              <div key={session.sessionId} className="session-row"
                onClick={() => openSession(session)}
                style={{ background: '#161a1f', border: '1px solid #2a2d35', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: '#36f4a420', border: '1px solid #36f4a430', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MessageSquare size={15} color="#36f4a4" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {session.label || 'Untitled PDF'}
                    </div>
                    <div style={{ fontSize: 11, color: '#7d8187', marginTop: 2, display: 'flex', gap: 10 }}>
                      <span><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />{formatDate(session.createdAt)}</span>
                      <span><Globe size={10} style={{ display: 'inline', marginRight: 3 }} />{session.ip || 'Unknown IP'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#36f4a4' }}>{session.messageCount}</div>
                    <div style={{ fontSize: 10, color: '#7d8187' }}>messages</div>
                  </div>
                  <ChevronRight size={16} color="#4a4e56" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Session Viewer Modal ── */}
      {selectedSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedSession(null); }}>
          <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease' }}>

            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2d35', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{selectedSession.label || 'Untitled PDF'}</div>
                <div style={{ fontSize: 11, color: '#7d8187', marginTop: 2, display: 'flex', gap: 12 }}>
                  <span>📅 {formatDate(selectedSession.createdAt)}</span>
                  <span>🌐 {selectedSession.ip || 'Unknown'}</span>
                  <span>💬 {selectedSession.messageCount} messages</span>
                </div>
              </div>
              <button onClick={() => setSelectedSession(null)}
                style={{ background: 'transparent', border: 'none', color: '#7d8187', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* User agent */}
            {selectedSession.userAgent && (
              <div style={{ padding: '8px 20px', background: '#161a1f', borderBottom: '1px solid #2a2d35', fontSize: 10, color: '#4a4e56', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🖥 {selectedSession.userAgent}
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadingMessages ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, gap: 10, color: '#7d8187' }}>
                  <div style={{ width: 20, height: 20, border: '2px solid #36f4a4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Loading messages...
                </div>
              ) : sessionMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#4a4e56', fontSize: 13, padding: '30px 0' }}>No messages in this session</div>
              ) : (
                sessionMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
                    <div style={{
                      maxWidth: '80%', padding: '9px 13px',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.role === 'user' ? '#36f4a4' : '#0a0a0a',
                      color: msg.role === 'user' ? '#000' : '#e8eaed',
                      fontSize: 12.5, lineHeight: 1.6,
                      border: msg.role === 'assistant' ? '1px solid #2a2d35' : 'none',
                    }}>
                      {msg.role === 'user'
                        ? msg.content
                        : <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                      }
                      <div style={{ fontSize: 9, color: msg.role === 'user' ? '#00000060' : '#4a4e56', marginTop: 4, textAlign: 'right' }}>
                        {formatDate(msg.createdAt)} · ~{msg.tokenEstimate} tokens
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}