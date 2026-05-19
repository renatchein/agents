'use client';

import { useState, useEffect, useCallback } from 'react';
import AnoAI from '@/components/ui/animated-shader-background';
import {
  Mail,
  Play,
  Square,
  RefreshCw,
  Inbox,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  X,
  Sparkles,
  ExternalLink,
  Undo2,
} from 'lucide-react';

interface Email {
  id: string;
  assunto: string;
  remetente: string;
  timestamp: string;
  prioridade: 'alta' | 'média' | 'baixa';
  internalDate: number;
  categoria: string;
  acao_sugerida: string;
  resposta_sugerida: string | null;
  trecho: string;
}

const PRIORITY_BADGE: Record<string, string> = {
  alta: 'text-red-200 border-red-400/50 bg-red-400/15',
  média: 'text-amber-200 border-amber-400/50 bg-amber-400/15',
  baixa: 'text-emerald-200 border-emerald-400/50 bg-emerald-400/15',
};

const PRIORITY_DOT: Record<string, string> = {
  alta: 'bg-red-400 shadow-[0_0_7px_rgba(248,113,113,0.9)]',
  média: 'bg-amber-400 shadow-[0_0_7px_rgba(251,191,36,0.9)]',
  baixa: 'bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.9)]',
};

const CATEGORY_ICON: Record<string, string> = {
  trabalho: '💼',
  financeiro: '💰',
  pessoal: '👤',
  spam: '🗑️',
  outro: '⚪',
};

const API = 'http://localhost:8000';

// Liquid glass: higher fill + stronger blur = more opaque, readable, blurs shader behind
const glass =
  'bg-white/[0.13] backdrop-blur-[44px] shadow-[0_8px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]';

const glassSelect =
  'bg-white/[0.12] backdrop-blur-sm text-white/85 rounded-xl px-3 py-1.5 text-xs focus:outline-none cursor-pointer transition-colors hover:bg-white/[0.18] disabled:opacity-40 disabled:cursor-not-allowed';

export default function Home() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshSecs, setRefreshSecs] = useState(0);
  const [escopo, setEscopo] = useState<'hora' | 'dia' | 'semana' | ''>('');
  const [startError, setStartError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [dispensadasOpen, setDispensadasOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'data' | 'prioridade'>('data');
  const [generatingReply, setGeneratingReply] = useState<Set<string>>(new Set());
  const [localReplies, setLocalReplies] = useState<Record<string, string>>({});
  const [awaitingReply, setAwaitingReply] = useState<Set<string>>(new Set());

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDismiss = (id: string) => {
    setDismissing(prev => new Set(prev).add(id));
    setTimeout(() => {
      setDismissed(prev => new Set(prev).add(id));
      setDismissing(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 400);
  };

  const handleReturn = (id: string) => {
    setDismissed(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const extractEmail = (from: string) => {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1] : from.trim();
  };

  const openInGmail = (email: Email, reply: string) => {
    const to = extractEmail(email.remetente);
    const su = encodeURIComponent(`Re: ${email.assunto}`);
    const body = encodeURIComponent(reply);
    window.open(
      `https://mail.google.com/mail/?view=cm&to=${to}&su=${su}&body=${body}`,
      '_blank'
    );
    setAwaitingReply(prev => new Set(prev).add(email.id));
  };

  useEffect(() => {
    if (awaitingReply.size === 0) return;
    const check = async () => {
      for (const emailId of [...awaitingReply]) {
        try {
          const res = await fetch(`${API}/api/emails/${emailId}/respondido`);
          if (!res.ok) continue;
          const { respondido } = await res.json();
          if (respondido) {
            setAwaitingReply(prev => { const s = new Set(prev); s.delete(emailId); return s; });
            setDismissing(prev => new Set(prev).add(emailId));
            setTimeout(() => {
              setDismissed(prev => new Set(prev).add(emailId));
              setDismissing(prev => { const s = new Set(prev); s.delete(emailId); return s; });
            }, 400);
          }
        } catch {}
      }
    };
    const id = window.setInterval(check, refreshSecs * 1000);
    return () => window.clearInterval(id);
  }, [awaitingReply, refreshSecs]);

  const isNoReply = (from: string) =>
    /no.?reply|noreply|donotreply|do.not.reply/i.test(from);

  const handleGenerateReply = async (id: string) => {
    setGeneratingReply(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`${API}/api/emails/${id}/resposta`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLocalReplies(prev => ({ ...prev, [id]: data.resposta }));
    } finally {
      setGeneratingReply(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/emails`);
      if (!res.ok) throw new Error();
      setEmails(await res.json());
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/status`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRunning(data.running);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchEmails();
  }, [fetchStatus, fetchEmails]);

  const handleStart = async () => {
    const missing = [];
    if (!escopo) missing.push('Período');
    if (!refreshSecs) missing.push('Atualização');
    if (missing.length) {
      setStartError(`Selecione: ${missing.join(' e ')}`);
      return;
    }
    setStartError('');
    setLoading(true);
    try {
      await fetch(`${API}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: 5, intervalo: refreshSecs, escopo }),
      });
      setRunning(true);
      await fetchEmails();
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    await fetch(`${API}/api/stop`, { method: 'POST' });
    setRunning(false);
  };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(fetchEmails, refreshSecs * 1000);
    return () => window.clearInterval(id);
  }, [running, refreshSecs, fetchEmails]);

  const sorted = [...emails]
    .filter(e => !dismissed.has(e.id))
    .sort((a, b) =>
      sortBy === 'data'
        ? b.internalDate - a.internalDate
        : ['alta', 'média', 'baixa'].indexOf(a.prioridade) - ['alta', 'média', 'baixa'].indexOf(b.prioridade)
    );

  const dispensadas = emails.filter(e => dismissed.has(e.id));

  const renderCard = (email: Email, isDispensada = false) => {
    const isOpen = expanded === email.id;
    const reply = localReplies[email.id] ?? null;
    const isGenerating = generatingReply.has(email.id);
    const canReply = !isDispensada && email.categoria !== 'spam' && !isNoReply(email.remetente);
    return (
      <div
        key={email.id}
        className={`rounded-2xl overflow-hidden ${glass} ${dismissing.has(email.id) ? 'dismissing' : ''} ${isDispensada ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center gap-3 p-4">
          <button
            className="flex-1 flex items-center gap-3 text-left min-w-0"
            onClick={() => setExpanded(isOpen ? null : email.id)}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[email.prioridade] ?? 'bg-white/50'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{email.assunto}</p>
              <p className="text-white/60 text-xs truncate">{email.remetente}</p>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold backdrop-blur-sm ${PRIORITY_BADGE[email.prioridade] ?? ''}`}>
              {email.prioridade}
            </span>
            <span className="text-white/50 text-xs hidden sm:block">{email.timestamp}</span>
            <button onClick={() => setExpanded(isOpen ? null : email.id)} className="text-white/40 hover:text-white/70 transition-colors">
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isDispensada ? (
              <button
                onClick={() => handleReturn(email.id)}
                className="text-white/30 hover:text-white/70 transition-colors ml-1"
                title="Retornar"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => handleDismiss(email.id)}
                className="text-white/30 hover:text-white/60 transition-colors ml-1"
                title="Dispensar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="bg-white/[0.05] p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mb-0.5">Categoria</p>
                <p className="text-sm text-white/80">{CATEGORY_ICON[email.categoria] ?? '⚪'} {email.categoria}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mb-0.5">Ação sugerida</p>
                <p className="text-sm text-white/80">{email.acao_sugerida || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mb-0.5">Trecho</p>
                <p className="text-xs text-white/60 italic leading-relaxed line-clamp-3">{email.trecho}</p>
              </div>
            </div>
            <div>
              {reply ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-white/50 uppercase tracking-widest">Rascunho de resposta</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(email.id, reply)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.07] text-white/50 hover:text-white/80 hover:bg-white/[0.12] transition-all text-[10px]"
                      >
                        {copied === email.id ? <><Check className="w-3 h-3 text-emerald-400" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                      </button>
                      <button
                        onClick={() => openInGmail(email, reply)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-400/[0.10] text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-400/[0.18] transition-all text-[10px]"
                        title="Abrir rascunho no Gmail"
                      >
                        <ExternalLink className="w-3 h-3" /> Gmail
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={reply}
                    rows={5}
                    className="w-full bg-white/[0.07] rounded-xl p-3 text-white/75 text-xs resize-none focus:outline-none backdrop-blur-sm"
                  />
                </>
              ) : canReply ? (
                <div className="flex items-center justify-center h-full min-h-[80px]">
                  <button
                    onClick={() => handleGenerateReply(email.id)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] text-white/65 hover:bg-white/[0.14] hover:text-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-medium backdrop-blur-sm"
                  >
                    {isGenerating
                      ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                      : <><Sparkles className="w-3.5 h-3.5" /> Gerar resposta</>}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="relative min-h-screen bg-black overflow-hidden">
      <div className="fixed inset-0 z-0">
        <AnoAI />
      </div>

      {/* Centered vertically and horizontally */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="max-w-4xl w-full space-y-3">

          {/* Header */}
          <div className={`rounded-2xl p-5 ${glass}`}>
            <div className="flex flex-col gap-4">
              {/* Title row */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-cyan-400/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                  <Mail className="w-5 h-5 text-cyan-200" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-white tracking-tight truncate">
                    Quick Mail
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${running ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]' : 'bg-red-400'}`}
                    />
                    <span className="text-xs text-white/65">
                      {running ? 'Rodando' : 'Parado'} —{' '}
                      {emails.length} email{emails.length !== 1 ? 's' : ''}{' '}
                      processado{emails.length !== 1 ? 's' : ''}
                    </span>
                    {!connected && (
                      <span className="text-xs text-red-300 font-medium shrink-0">
                        ⚠ API offline
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls row — wraps on small screens */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={escopo}
                  onChange={(e) => { setEscopo(e.target.value as 'hora' | 'dia' | 'semana' | ''); setStartError(''); }}
                  disabled={running}
                  className={`${glassSelect} min-w-0`}
                >
                  <option value="">Período</option>
                  <option value="hora">Última hora</option>
                  <option value="dia">Último dia</option>
                  <option value="semana">Última semana</option>
                </select>
                <select
                  value={refreshSecs}
                  onChange={(e) => { setRefreshSecs(Number(e.target.value)); setStartError(''); }}
                  className={`${glassSelect} min-w-0`}
                >
                  <option value={0}>Atualização</option>
                  <option value={30}>30s</option>
                  <option value={60}>1min</option>
                  <option value={120}>2min</option>
                  <option value={300}>5min</option>
                </select>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={handleStart}
                    disabled={running || loading}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-400/20 text-cyan-200 hover:bg-cyan-400/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] whitespace-nowrap"
                  >
                    {loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    Iniciar
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={!running}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-400/20 text-red-200 hover:bg-red-400/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] whitespace-nowrap"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Parar
                  </button>
                </div>
              </div>
              {startError && (
                <p className="text-xs text-red-300/80 mt-1">{startError}</p>
              )}
            </div>
          </div>

          {/* Novidades */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Novidades</p>
            <button
              onClick={() => setSortBy(s => s === 'data' ? 'prioridade' : 'data')}
              className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors"
            >
              {sortBy === 'data' ? '↓ Data' : '↓ Prioridade'}
            </button>
          </div>
          {sorted.length === 0 ? (
            <div className={`rounded-2xl p-16 flex flex-col items-center ${glass}`}>
              <Inbox className="w-12 h-12 mb-3 text-white/50" />
              <p className="text-sm text-white/70">Nenhum email processado ainda</p>
              <p className="text-xs mt-1 text-white/45">Clique em Iniciar para começar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map(e => renderCard(e, false))}
            </div>
          )}

          {/* Dispensadas */}
          {dispensadas.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setDispensadasOpen(o => !o)}
                className="flex items-center gap-2 w-full text-left px-1"
              >
                <p className="text-xs font-semibold text-white/35 uppercase tracking-widest">
                  Dispensadas ({dispensadas.length})
                </p>
                {dispensadasOpen
                  ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
                  : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
              </button>
              {dispensadasOpen && (
                <div className="space-y-2">
                  {dispensadas.map(e => renderCard(e, true))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="fixed bottom-0 inset-x-0 z-10 text-center pb-3 pointer-events-none">
        <p className="text-xs text-white/30 pointer-events-auto">
          <a
            href="https://github.com/renatchein/agents"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/55 transition-colors"
          >
            Renato Mesquita
          </a>
          {' '}🤝 Claude
        </p>
      </footer>
    </main>
  );
}
