'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function RankingPage() {
  const { profile } = useAuthStore();
  const [tab, setTab] = useState<'players' | 'alliances'>('players');
  const [type, setType] = useState('power');
  const [rankings, setRankings] = useState<any[]>([]);
  const [allianceRankings, setAllianceRankings] = useState<any[]>([]);
  const [myPos, setMyPos] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [worldId, setWorldId] = useState('');

  useEffect(() => {
    loadWorldId();
  }, []);

  useEffect(() => {
    if (worldId) loadRankings();
  }, [worldId, tab, type, page]);

  const loadWorldId = async () => {
    try {
      const worlds: any = await apiClient.get('/worlds');
      if (worlds[0]) setWorldId(worlds[0].id);
    } catch (_) {}
  };

  const loadRankings = async () => {
    setLoading(true);
    try {
      if (tab === 'players') {
        const res: any = await apiClient.get(`/ranking/players?worldId=${worldId}&type=${type}&page=${page}`);
        setRankings(res.rankings || []);
        setTotal(res.total || 0);
        const pos: any = await apiClient.get(`/ranking/me?worldId=${worldId}`);
        setMyPos(pos);
      } else {
        const res: any = await apiClient.get(`/ranking/alliances?worldId=${worldId}&page=${page}`);
        setAllianceRankings(Array.isArray(res) ? res : []);
      }
    } catch (_) {}
    setLoading(false);
  };

  const scoreKey: Record<string, string> = {
    power: 'power_score', economy: 'economy_score', war: 'war_score', dev: 'dev_score',
  };

  const getMedalColor = (pos: number) => {
    if (pos === 1) return '#FFD700';
    if (pos === 2) return '#C0C0C0';
    if (pos === 3) return '#CD7F32';
    return 'var(--ink-muted)';
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: '18px', color: 'var(--ink)' }}>Рейтинг</h1>
        {myPos && (
          <div style={{ background: 'var(--gold-pale)', border: '1px solid rgba(184,146,42,0.3)', borderRadius: '3px', padding: '5px 14px', fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--gold)' }}>
            Ваша позиция: #{myPos.position} · {myPos.power_score?.toLocaleString()} силы
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => { setTab('players'); setPage(1); }} style={{
          padding: '7px 16px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
          background: tab === 'players' ? 'var(--ink)' : 'transparent',
          color: tab === 'players' ? 'var(--gold-light)' : 'var(--ink-muted)',
          border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer',
        }}>👤 ИГРОКИ</button>
        <button onClick={() => { setTab('alliances'); setPage(1); }} style={{
          padding: '7px 16px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
          background: tab === 'alliances' ? 'var(--ink)' : 'transparent',
          color: tab === 'alliances' ? 'var(--gold-light)' : 'var(--ink-muted)',
          border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer',
        }}>🛡 АЛЬЯНСЫ</button>

        {tab === 'players' && (
          <div style={{ marginLeft: '8px', display: 'flex', gap: '4px' }}>
            {[
              { key: 'power', label: '⚡ Сила' },
              { key: 'economy', label: '💰 Экономика' },
              { key: 'war', label: '⚔ Война' },
              { key: 'dev', label: '📜 Развитие' },
            ].map(t => (
              <button key={t.key} onClick={() => { setType(t.key); setPage(1); }} style={{
                padding: '7px 12px', fontFamily: 'Cinzel,serif', fontSize: '10px',
                background: type === t.key ? 'rgba(184,146,42,0.15)' : 'transparent',
                color: type === t.key ? 'var(--gold)' : 'var(--ink-muted)',
                border: `1px solid ${type === t.key ? 'rgba(184,146,42,0.4)' : 'var(--border)'}`,
                borderRadius: '3px', cursor: 'pointer',
              }}>{t.label}</button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-muted)', fontFamily: 'Cinzel,serif', letterSpacing: '2px' }}>ЗАГРУЗКА...</div>
      ) : (
        <>
          {/* Player rankings table */}
          {tab === 'players' && (
            <div className="card-base" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--sand-2)' }}>
                    {['#', 'Игрок', 'Альянс', 'Поселений', type === 'power' ? 'Сила' : type === 'economy' ? 'Экономика' : type === 'war' ? 'Победы' : 'Развитие'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--ink-muted)', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r: any) => {
                    const isMe = r.nickname === profile?.nickname;
                    return (
                      <tr key={r.player_id} style={{
                        borderBottom: '1px solid var(--border)',
                        background: isMe ? 'var(--gold-pale)' : 'transparent',
                      }}>
                        <td style={{ padding: '10px 14px', width: '48px' }}>
                          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: getMedalColor(r.position), fontWeight: r.position <= 3 ? 600 : 400 }}>
                            {r.position <= 3 ? ['🥇', '🥈', '🥉'][r.position - 1] : `#${r.position}`}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: isMe ? 500 : 400 }}>
                            {r.nickname} {isMe && <span style={{ fontSize: '10px', color: 'var(--gold)' }}>← вы</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--ink-muted)' }}>
                          {r.alliance_tag ? `[${r.alliance_tag}] ${r.alliance_name}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--ink-muted)' }}>
                          {r.settlements_count}
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'Cinzel,serif', fontSize: '13px', color: r.position <= 3 ? getMedalColor(r.position) : 'var(--ink)' }}>
                          {(r[scoreKey[type]] || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Alliance rankings table */}
          {tab === 'alliances' && (
            <div className="card-base" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--sand-2)' }}>
                    {['#', 'Альянс', 'Лидер', 'Участников', 'Территорий', 'Сила'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--ink-muted)', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allianceRankings.map((a: any) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', width: '48px' }}>
                        <span style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: getMedalColor(a.position) }}>
                          {a.position <= 3 ? ['🥇', '🥈', '🥉'][a.position - 1] : `#${a.position}`}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--ink)' }}>
                          [{a.tag}] {a.name}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--ink-muted)' }}>{a.leader_name}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--ink-muted)' }}>{a.member_count}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--ink-muted)' }}>{a.territory_count}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'Cinzel,serif', fontSize: '13px', color: a.position <= 3 ? getMedalColor(a.position) : 'var(--ink)' }}>
                        {a.power_score?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {tab === 'players' && total > 50 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ink-muted)' }}>← НАЗАД</button>
              <span style={{ padding: '6px 14px', fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ink)' }}>
                {page} / {Math.ceil(total / 50)}
              </span>
              <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/50)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ink-muted)' }}>ДАЛЕЕ →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
