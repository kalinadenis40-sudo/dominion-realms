'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  tutorial:  { label: 'ОБУЧЕНИЕ',   color: 'var(--navy)' },
  daily:     { label: 'ЕЖЕДНЕВНЫЕ', color: 'var(--teal-game)' },
  long_term: { label: 'ДОЛГОСРОЧНЫЕ', color: 'var(--gold)' },
};

export default function QuestsPage() {
  const [quests, setQuests] = useState<any[]>([]);
  const [worldId, setWorldId] = useState('');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string|null>(null);
  const [filter, setFilter] = useState<string>('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadWorldId(); }, []);
  useEffect(() => { if (worldId) loadQuests(); }, [worldId]);

  const loadWorldId = async () => {
    try {
      const worlds: any = await apiClient.get('/worlds');
      if (worlds[0]) setWorldId(worlds[0].id);
    } catch (_) {}
  };

  const loadQuests = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get(`/quests?worldId=${worldId}`);
      setQuests(res || []);
    } catch (_) {}
    setLoading(false);
  };

  const handleClaim = async (questType: string) => {
    setClaiming(questType);
    try {
      const res: any = await apiClient.post('/quests/claim', { worldId, questType });
      setSuccess(`✅ Награда получена!`);
      await loadQuests();
    } catch (err: any) {
      setSuccess('');
    } finally { setClaiming(null); }
  };

  const types = ['tutorial', 'daily', 'long_term'];
  const filtered = filter ? quests.filter(q => q.definition?.type === filter) : quests;

  const byType: Record<string, any[]> = {};
  for (const q of filtered) {
    const t = q.definition?.type || 'other';
    if (!byType[t]) byType[t] = [];
    byType[t].push(q);
  }

  // Stats
  const total = quests.length;
  const completed = quests.filter(q => q.is_completed).length;
  const claimable = quests.filter(q => q.is_completed && !q.is_claimed).length;

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
        <h1 style={{ fontFamily:'Cinzel,serif', fontSize:'18px', color:'var(--ink)' }}>Квесты</h1>
        <div style={{ display:'flex', gap:'10px' }}>
          <span style={{ fontFamily:'Cinzel,serif', fontSize:'11px', color:'var(--ink-muted)' }}>{completed}/{total} выполнено</span>
          {claimable > 0 && (
            <span style={{ fontFamily:'Cinzel,serif', fontSize:'11px', background:'var(--gold-pale)', color:'var(--gold)', border:'1px solid rgba(184,146,42,0.3)', padding:'2px 8px', borderRadius:'2px' }}>
              {claimable} к получению
            </span>
          )}
        </div>
      </div>

      {success && <div style={{ background:'var(--teal-light)', border:'1px solid var(--teal-game)', borderRadius:'3px', padding:'10px 14px', marginBottom:'14px', color:'var(--teal-game)', fontSize:'13px' }}>{success}</div>}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px' }}>
        <button onClick={() => setFilter('')} style={{
          padding:'7px 14px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px',
          background: !filter ? 'var(--ink)' : 'transparent',
          color: !filter ? 'var(--gold-light)' : 'var(--ink-muted)',
          border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer',
        }}>Все</button>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            padding:'7px 14px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px',
            background: filter===t ? 'var(--ink)' : 'transparent',
            color: filter===t ? 'var(--gold-light)' : 'var(--ink-muted)',
            border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer',
          }}>{TYPE_LABELS[t]?.label || t}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign:'center', padding:'40px', color:'var(--ink-muted)', fontFamily:'Cinzel,serif', letterSpacing:'2px' }}>ЗАГРУЗКА...</div>}

      {!loading && types.map(type => {
        const typeQuests = byType[type];
        if (!typeQuests?.length) return null;
        const tInfo = TYPE_LABELS[type] || { label: type, color: 'var(--ink-muted)' };

        return (
          <div key={type} style={{ marginBottom:'28px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
              <span style={{ fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'2px', color: tInfo.color }}>{tInfo.label}</span>
              <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
              <span style={{ fontSize:'11px', color:'var(--ink-muted)' }}>
                {typeQuests.filter(q=>q.is_completed).length}/{typeQuests.length}
              </span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {typeQuests.map((q: any) => {
                const def = q.definition;
                if (!def) return null;
                const progress = q.progress?.current || 0;
                const target = def.condition ? Object.values(def.condition)[0] as number : 1;
                const pct = Math.min(100, Math.round((progress / target) * 100));
                const isClaimable = q.is_completed && !q.is_claimed;

                return (
                  <div key={q.quest_type} className="card-base" style={{
                    padding:'14px 16px',
                    opacity: q.is_claimed ? 0.5 : 1,
                    borderLeft: `3px solid ${isClaimable ? 'var(--gold)' : q.is_completed ? 'var(--teal-game)' : 'transparent'}`,
                  }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
                      <div style={{ fontSize:'24px', flexShrink:0 }}>{def.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                          <span style={{ fontFamily:'Cinzel,serif', fontSize:'13px', color:'var(--ink)' }}>{def.title}</span>
                          {q.is_claimed && <span style={{ fontSize:'11px', color:'var(--ink-muted)' }}>✓ Получено</span>}
                        </div>
                        <div style={{ fontSize:'12px', color:'var(--ink-muted)', marginBottom:'8px' }}>{def.description}</div>

                        {/* Progress bar */}
                        {!q.is_completed && (
                          <div style={{ marginBottom:'6px' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                              <span style={{ fontSize:'11px', color:'var(--ink-muted)' }}>{progress} / {target}</span>
                              <span style={{ fontSize:'11px', color:'var(--ink-muted)' }}>{pct}%</span>
                            </div>
                            <div style={{ height:'4px', background:'var(--sand-3)', borderRadius:'2px', overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${pct}%`, background:'var(--gold)', borderRadius:'2px', transition:'width 0.5s' }} />
                            </div>
                          </div>
                        )}

                        {/* Reward */}
                        {def.reward && (
                          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                            {Object.entries(def.reward).map(([res, qty]: any) => (
                              <span key={res} style={{ fontSize:'11px', color:'var(--ink-muted)', background:'var(--sand)', padding:'2px 7px', borderRadius:'2px' }}>
                                +{qty} {res === 'wood' ? '🪵' : res === 'stone' ? '🪨' : res === 'iron' ? '⚙️' : res === 'food' ? '🌾' : '🪙'}
                              </span>
                            ))}
                            {def.xp && <span style={{ fontSize:'11px', color:'var(--navy)', background:'var(--navy-light)', padding:'2px 7px', borderRadius:'2px' }}>+{def.xp} XP</span>}
                          </div>
                        )}
                      </div>

                      {isClaimable && (
                        <button onClick={() => handleClaim(q.quest_type)} disabled={claiming === q.quest_type} style={{
                          padding:'8px 16px', background:'var(--gold)', color:'var(--ink)',
                          border:'none', borderRadius:'3px', fontFamily:'Cinzel,serif', fontSize:'10px',
                          letterSpacing:'1px', cursor:'pointer', flexShrink:0, fontWeight:600,
                          animation: 'pulse-gold 2s infinite',
                        }}>{claiming===q.quest_type ? '...' : 'ПОЛУЧИТЬ'}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
