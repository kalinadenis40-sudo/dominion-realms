'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useCountdown } from '@/hooks/useCountdown';

function EventTimer({ seconds }: { seconds: number }) {
  const { formatted } = useCountdown(seconds);
  return <span style={{ fontFamily:'Cinzel,serif', color:'var(--gold)', fontSize:'14px' }}>{formatted}</span>;
}

export default function EventsPage() {
  const [active, setActive] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [season, setSeason] = useState<any>(null);
  const [worldId, setWorldId] = useState('');
  const [tab, setTab] = useState<'events'|'season'>('events');

  useEffect(() => { loadWorldId(); }, []);
  useEffect(() => { if (worldId) loadAll(); }, [worldId]);

  const loadWorldId = async () => {
    try {
      const worlds: any = await apiClient.get('/worlds');
      if (worlds[0]) setWorldId(worlds[0].id);
    } catch (_) {}
  };

  const loadAll = async () => {
    try {
      const [activeRes, histRes, seasonRes]: any[] = await Promise.all([
        apiClient.get(`/events/active?worldId=${worldId}`),
        apiClient.get(`/events/history?worldId=${worldId}`),
        apiClient.get(`/seasons/current?worldId=${worldId}`),
      ]);
      setActive(activeRes || []);
      setHistory(histRes || []);
      setSeason(seasonRes);
    } catch (_) {}
  };

  const effectLabels: Record<string, string> = {
    silver_multiplier: '🪙 Серебро ×',
    food_multiplier: '🌾 Еда ×',
    build_speed_mult: '🏛 Строительство ×',
    train_speed_mult: '⚔️ Обучение ×',
    movement_speed_mult: '🚶 Скорость ×',
    defense_bonus: '🛡 Защита +',
    pve_reward_mult: '💎 PvE награды ×',
    market_fee: '💰 Комиссия =',
    trade_limit_mult: '📦 Лимит торговли ×',
    no_upkeep: '🌾 Нет содержания',
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
        <h1 style={{ fontFamily:'Cinzel,serif', fontSize:'18px', color:'var(--ink)' }}>События и Сезон</h1>
      </div>

      <div style={{ display:'flex', gap:'4px', marginBottom:'20px' }}>
        {[{ key:'events', label:'🌍 События мира' }, { key:'season', label:'🏆 Сезон' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding:'7px 16px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px',
            background: tab===t.key ? 'var(--ink)' : 'transparent',
            color: tab===t.key ? 'var(--gold-light)' : 'var(--ink-muted)',
            border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* EVENTS TAB */}
      {tab === 'events' && (
        <>
          {/* Active events */}
          {active.length > 0 && (
            <div style={{ marginBottom:'28px' }}>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'2px', color:'var(--gold)', marginBottom:'12px' }}>АКТИВНО СЕЙЧАС</div>
              {active.map((e: any) => {
                const cfg = e.config || {};
                return (
                  <div key={e.id} style={{
                    background:'var(--ink)', border:`1px solid ${cfg.color || 'var(--gold)'}40`,
                    borderRadius:'4px', overflow:'hidden', marginBottom:'12px',
                  }}>
                    <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                      <span style={{ fontSize:'32px' }}>{cfg.icon || '⭐'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:'Cinzel,serif', fontSize:'16px', color:'#fff', marginBottom:'4px' }}>{e.name}</div>
                        <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)' }}>{e.description}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', marginBottom:'4px', fontFamily:'Cinzel,serif' }}>ОСТАЛОСЬ</div>
                        <EventTimer seconds={e.seconds_remaining || 0} />
                      </div>
                    </div>

                    {/* Effects */}
                    <div style={{ padding:'12px 20px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                      {Object.entries(e.effects || {}).map(([key, val]: any) => {
                        const label = effectLabels[key] || key;
                        const display = key === 'no_upkeep' ? '✓' : key.includes('fee') ? val : val;
                        return (
                          <div key={key} style={{
                            background:'rgba(255,255,255,0.08)', borderRadius:'3px', padding:'5px 10px',
                            fontSize:'12px', color:'rgba(255,255,255,0.75)',
                          }}>
                            {label}{display}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {active.length === 0 && (
            <div style={{ background:'var(--sand-2)', border:'1px solid var(--border)', borderRadius:'4px', padding:'30px', textAlign:'center', marginBottom:'24px' }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>🌤</div>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:'13px', color:'var(--ink-muted)', letterSpacing:'1px' }}>НЕТ АКТИВНЫХ СОБЫТИЙ</div>
              <div style={{ fontSize:'12px', color:'var(--ink-muted)', marginTop:'6px' }}>События запускаются автоматически каждые несколько часов</div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'2px', color:'var(--ink-muted)', marginBottom:'12px' }}>ИСТОРИЯ СОБЫТИЙ</div>
              {history.filter(e => !e.is_active).slice(0, 10).map((e: any) => {
                const cfg = e.config || {};
                return (
                  <div key={e.id} className="card-base" style={{ padding:'12px 16px', marginBottom:'6px', display:'flex', alignItems:'center', gap:'12px', opacity:0.65 }}>
                    <span style={{ fontSize:'20px' }}>{cfg.icon || '⭐'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', color:'var(--ink)' }}>{e.name}</div>
                      <div style={{ fontSize:'11px', color:'var(--ink-muted)', marginTop:'2px' }}>
                        {new Date(e.started_at).toLocaleDateString('ru')} → {new Date(e.ends_at).toLocaleDateString('ru')}
                      </div>
                    </div>
                    <span style={{ fontSize:'11px', color:'var(--ink-muted)', fontFamily:'Cinzel,serif' }}>ЗАВЕРШЕНО</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* SEASON TAB */}
      {tab === 'season' && season && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'20px' }}>
          <div>
            {/* Season info */}
            <div style={{ background:'var(--ink)', border:'1px solid rgba(184,146,42,0.3)', borderRadius:'4px', padding:'20px', marginBottom:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'16px' }}>
                <span style={{ fontSize:'36px' }}>🏆</span>
                <div>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:'16px', color:'#fff' }}>Сезон {season.season} · {season.name}</div>
                  <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)', marginTop:'3px' }}>
                    {season.playerCount} игроков · {season.daysLeft !== null ? `Осталось ${season.daysLeft} дней` : 'Вечный мир'}
                  </div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                {[
                  { label:'РЕСУРСЫ', val:`×${season.speeds.resources}` },
                  { label:'СТРОИТЕЛЬСТВО', val:`×${season.speeds.building}` },
                  { label:'ОБУЧЕНИЕ', val:`×${season.speeds.training}` },
                ].map(s => (
                  <div key={s.label} style={{ background:'rgba(255,255,255,0.06)', borderRadius:'3px', padding:'10px', textAlign:'center' }}>
                    <div style={{ fontFamily:'Cinzel,serif', fontSize:'9px', color:'rgba(255,255,255,0.4)', letterSpacing:'1.5px', marginBottom:'4px' }}>{s.label}</div>
                    <div style={{ fontFamily:'Cinzel,serif', fontSize:'18px', color:'var(--gold-light)' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Season leaderboard */}
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'2px', color:'var(--ink-muted)', marginBottom:'10px' }}>ЛИДЕРЫ СЕЗОНА</div>
            <div className="card-base" style={{ overflow:'hidden' }}>
              {season.leaders?.map((l: any) => {
                const medals = ['🥇','🥈','🥉'];
                const pos = parseInt(l.position);
                return (
                  <div key={l.nickname} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:'16px', width:'24px', textAlign:'center' }}>{pos <= 3 ? medals[pos-1] : `#${pos}`}</span>
                    <div style={{ flex:1 }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:'13px', color:'var(--ink)' }}>{l.nickname}</span>
                      {l.alliance_tag && <span style={{ fontSize:'11px', color:'var(--ink-muted)', marginLeft:'6px' }}>[{l.alliance_tag}]</span>}
                    </div>
                    <span style={{ fontFamily:'Cinzel,serif', fontSize:'12px', color: pos===1 ? 'var(--gold)' : 'var(--ink-muted)' }}>
                      {l.power_score?.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Season rewards */}
          <div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'2px', color:'var(--ink-muted)', marginBottom:'10px' }}>НАГРАДЫ СЕЗОНА</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {season.seasonRewards?.map((r: any) => (
                <div key={r.rank} className="card-base" style={{ padding:'12px 14px' }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:'12px', color:'var(--ink)', marginBottom:'4px' }}>{r.title}</div>
                  <div style={{ fontSize:'11px', color:'var(--ink-muted)' }}>Место {r.rank}</div>
                  <div style={{ fontSize:'12px', color:'var(--gold)', marginTop:'4px' }}>{r.reward}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
