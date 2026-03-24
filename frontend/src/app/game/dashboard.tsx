'use client';

import { useEffect } from 'react';
import { useDashboardStore } from '@/store/dashboard.store';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api';
import { useCountdown } from '@/hooks/useCountdown';

function Timer({ seconds }: { seconds: number }) {
  const { formatted } = useCountdown(seconds);
  return <span style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '12px' }}>{formatted}</span>;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--ink-muted)' }}>{title}</span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, fetchDashboard } = useDashboardStore();
  const { profile } = useAuthStore();

  useEffect(() => { fetchDashboard(); }, []);

  const ensureSettlement = async () => {
    try { await apiClient.post('/settlements/start', {}); fetchDashboard(); } catch (_) { fetchDashboard(); }
  };

  useEffect(() => {
    if (data && !data.hasSettlement) ensureSettlement();
  }, [data]);

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '14px', letterSpacing: '3px' }}>ЗАГРУЗКА...</div>
      </div>
    );
  }

  if (!data?.hasSettlement) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', fontSize: '18px' }}>⚜ Основать владение</div>
        <div style={{ color: 'var(--ink-muted)' }}>Создаём ваше первое поселение...</div>
      </div>
    );
  }

  const { settlement, resources, buildings, buildQueue, units, trainQueue,
          notifications, ranking, topRanking, incomingAttacks, worldEvents } = data;

  const wall = buildings?.find((b: any) => b.building_type === 'wall');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px', maxWidth: '1300px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Settlement hero card */}
        <SectionTitle title="МОЁ ПОСЕЛЕНИЕ" />
        <div style={{ background: 'var(--ink)', border: '1px solid rgba(184,146,42,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: '28px' }}>🏰</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Cinzel,serif', color: '#fff', fontSize: '15px' }}>{settlement.name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                Уровень {settlement.level} · {settlement.biome} · {settlement.x}|{settlement.y}
              </div>
            </div>
            {settlement.has_newbie_shield && (
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', padding: '3px 8px', background: 'rgba(26,92,74,0.4)', border: '1px solid #1A5C4A', borderRadius: '2px', color: '#4CAF7D', letterSpacing: '1px' }}>
                🛡 ЩИТ
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
            {[
              { label: 'СТЕНЫ', val: `Ур.${wall?.level || 0}` },
              { label: 'ЛОЯЛЬНОСТЬ', val: `${settlement.loyalty}%`, color: '#4CAF7D' },
              { label: 'МОРАЛЬ', val: `${settlement.morale}%`, color: 'var(--gold)' },
              { label: 'НАСЕЛЕНИЕ', val: `${settlement.population}/${settlement.population_limit}` },
            ].map((s, i) => (
              <div key={i} style={{ padding: '10px 14px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', marginBottom: '3px' }}>{s.label}</div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '16px', color: (s as any).color || '#fff' }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Queues */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            { title: 'СТРОИТЕЛЬСТВО', queue: buildQueue, color: 'var(--gold)' },
            { title: 'ОБУЧЕНИЕ', queue: trainQueue, color: '#4A90A4' },
          ].map(({ title, queue, color }) => (
            <div key={title}>
              <SectionTitle title={title} />
              <div className="card-base" style={{ padding: '12px 14px', minHeight: '80px' }}>
                {!queue?.length
                  ? <div style={{ color: 'var(--ink-muted)', fontSize: '13px', textAlign: 'center', paddingTop: '16px' }}>Очередь пуста</div>
                  : queue.map((q: any) => (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: 'var(--ink)' }}>
                          {(q.building_type || q.unit_type || '').replace(/_/g, ' ')}
                          {q.to_level ? ` → Ур.${q.to_level}` : q.quantity ? ` × ${q.quantity}` : ''}
                        </div>
                        <div style={{ height: '2px', background: 'var(--sand-3)', borderRadius: '1px', marginTop: '4px' }}>
                          <div style={{ height: '100%', background: color, borderRadius: '1px', width: q.status === 'in_progress' ? `${Math.max(0, 100 - (q.seconds_remaining / q.duration_seconds) * 100)}%` : '0%' }} />
                        </div>
                      </div>
                      {q.status === 'in_progress' && q.seconds_remaining > 0
                        ? <Timer seconds={q.seconds_remaining} />
                        : <span style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>очередь</span>
                      }
                    </div>
                  ))
                }
              </div>
            </div>
          ))}
        </div>

        {/* Army + Threats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <SectionTitle title="АРМИЯ ДОМА" />
            <div className="card-base" style={{ padding: '12px 14px', minHeight: '80px' }}>
              {!units?.filter((u: any) => u.quantity > 0).length
                ? <div style={{ color: 'var(--ink-muted)', fontSize: '13px', textAlign: 'center', paddingTop: '16px' }}>Нет войск</div>
                : units.filter((u: any) => u.quantity > 0).map((u: any) => (
                  <div key={u.unit_type} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>⚔️</span>
                    <span style={{ flex: 1, fontSize: '12px', color: 'var(--ink)' }}>{u.unit_type.replace(/_/g, ' ')}</span>
                    <span style={{ fontFamily: 'Cinzel,serif', fontSize: '12px' }}>{u.quantity.toLocaleString()}</span>
                  </div>
                ))
              }
            </div>
          </div>
          <div>
            <SectionTitle title="УГРОЗЫ" />
            <div className="card-base" style={{ padding: '12px 14px', minHeight: '80px' }}>
              {!incomingAttacks?.length
                ? <div style={{ color: 'var(--ink-muted)', fontSize: '13px', textAlign: 'center', paddingTop: '16px' }}>✓ Атак нет</div>
                : incomingAttacks.map((a: any) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="tag tag-danger" style={{ fontSize: '9px' }}>АТАКА</span>
                    <span style={{ flex: 1, fontSize: '12px' }}>{a.attacker_name}</span>
                    <Timer seconds={a.seconds_until_arrival} />
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <SectionTitle title="ДЕЙСТВИЯ" />
        {[
          { label: '⚔ Отправить атаку', href: '/game/army' },
          { label: '🔍 Разведка',        href: '/game/army' },
          { label: '🏛 Строить',         href: '/game/buildings' },
          { label: '🗺 Карта мира',      href: '/game/map' },
        ].map((btn) => (
          <a key={btn.href} href={btn.href} style={{
            display: 'block', padding: '9px 14px', background: 'var(--ink)', color: 'var(--gold-light)',
            border: '1px solid rgba(184,146,42,0.25)', borderRadius: '3px',
            fontFamily: 'Cinzel,serif', fontSize: '11px', letterSpacing: '1px', textDecoration: 'none',
          }}>{btn.label}</a>
        ))}

        {worldEvents?.length > 0 && (
          <>
            <SectionTitle title="СОБЫТИЯ" />
            {worldEvents.map((e: any) => (
              <div key={e.id} className="card-base" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: '12px', color: 'var(--ink)', fontWeight: 500 }}>{e.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '3px' }}>{e.description}</div>
              </div>
            ))}
          </>
        )}

        {notifications?.length > 0 && (
          <>
            <SectionTitle title="УВЕДОМЛЕНИЯ" />
            <div className="card-base" style={{ padding: '10px 12px' }}>
              {notifications.slice(0, 5).map((n: any) => (
                <div key={n.id} style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: n.type.includes('attack') ? 'var(--crimson)' : 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--ink)' }}>{n.title}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                      {new Date(n.created_at).toLocaleTimeString('ru')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {ranking && (
          <>
            <SectionTitle title="РЕЙТИНГ" />
            <div className="card-base" style={{ padding: '10px 12px' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '24px', color: 'var(--gold)' }}>#{ranking.rank_position}</div>
                <div style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>{ranking.power_score?.toLocaleString()} силы</div>
              </div>
              {topRanking?.slice(0, 5).map((r: any) => (
                <div key={r.position} style={{
                  display: 'flex', gap: '6px', padding: '4px 6px', borderRadius: '2px',
                  background: r.nickname === profile?.nickname ? 'var(--gold-pale)' : 'transparent',
                }}>
                  <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--gold)', width: '16px' }}>{r.position}</span>
                  <span style={{ fontSize: '12px', flex: 1, color: 'var(--ink)' }}>{r.nickname}</span>
                  <span style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--ink-muted)' }}>{r.power_score?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
