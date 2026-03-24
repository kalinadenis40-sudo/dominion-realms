'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard.store';

const ROLE_LABELS: Record<string, string> = {
  leader: '👑 Лидер', deputy: '⚔ Заместитель', diplomat: '🤝 Дипломат',
  war_coordinator: '🗺 Координатор', recruiter: '📢 Рекрутер',
  treasurer: '💰 Казначей', member: '👤 Участник',
};
const ROLE_COLORS: Record<string, string> = {
  leader: 'var(--gold)', deputy: '#4A90A4', diplomat: 'var(--teal-game)',
  war_coordinator: 'var(--crimson)', recruiter: '#8B6914', treasurer: 'var(--navy)', member: 'var(--ink-muted)',
};

export default function AlliancePage() {
  const { data: dashData } = useDashboardStore();
  const [alliance, setAlliance] = useState<any>(null);
  const [relations, setRelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'members' | 'diplomacy' | 'create' | 'search'>('overview');
  const [createForm, setCreateForm] = useState({ name: '', tag: '', description: '' });
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [savingAnn, setSavingAnn] = useState(false);

  useEffect(() => { loadAlliance(); }, []);

  const loadAlliance = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/alliances/my');
      setAlliance(res);
      if (res) {
        setAnnouncement(res.announcement || '');
        const rel: any = await apiClient.get('/diplomacy/my');
        setRelations(rel || []);
      }
    } catch (_) {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.tag) { setError('Заполни название и тег'); return; }
    setError('');
    try {
      await apiClient.post('/alliances/create', createForm);
      setSuccess('Альянс создан!');
      await loadAlliance();
      setTab('overview');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    }
  };

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    try {
      const worlds: any = await apiClient.get('/worlds');
      const wId = worlds[0]?.id;
      const res: any = await apiClient.get(`/alliances/search?worldId=${wId}&q=${encodeURIComponent(searchQ)}`);
      setSearchResults(res || []);
    } catch (_) {}
  };

  const handleJoin = async (id: string) => {
    try {
      await apiClient.post(`/alliances/join/${id}`, {});
      setSuccess('Вы вступили в альянс!');
      await loadAlliance();
      setTab('overview');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    }
  };

  const handleLeave = async () => {
    if (!confirm('Покинуть альянс?')) return;
    try {
      await apiClient.post('/alliances/leave', {});
      setAlliance(null);
      setTab('overview');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    }
  };

  const handleKick = async (playerId: string, nickname: string) => {
    if (!confirm(`Исключить ${nickname}?`)) return;
    try {
      await apiClient.post(`/alliances/kick/${playerId}`, {});
      await loadAlliance();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    }
  };

  const handleSaveAnnouncement = async () => {
    setSavingAnn(true);
    try {
      await apiClient.put('/alliances/announcement', { announcement });
      setSuccess('Объявление сохранено');
    } catch (_) {}
    setSavingAnn(false);
  };

  const handleDiplomacy = async (targetId: string, type: string) => {
    try {
      await apiClient.post('/diplomacy/propose', { targetAllianceId: targetId, type });
      setSuccess(`Предложение "${type}" отправлено`);
      const rel: any = await apiClient.get('/diplomacy/my');
      setRelations(rel || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)', letterSpacing: '3px' }}>ЗАГРУЗКА...</div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: '18px', color: 'var(--ink)' }}>
          {alliance ? `[${alliance.tag}] ${alliance.name}` : 'Альянс'}
        </h1>
        {alliance && (
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ink-muted)', letterSpacing: '1px' }}>
            {alliance.member_count}/{alliance.max_members} игроков
          </span>
        )}
      </div>

      {/* Alerts */}
      {error && <div style={{ background: 'var(--crimson-light)', border: '1px solid var(--crimson)', borderRadius: '3px', padding: '10px 14px', marginBottom: '12px', color: 'var(--crimson)', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ background: 'var(--teal-light)', border: '1px solid var(--teal-game)', borderRadius: '3px', padding: '10px 14px', marginBottom: '12px', color: 'var(--teal-game)', fontSize: '13px' }}>{success}</div>}

      {/* No alliance state */}
      {!alliance && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div className="card-base" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚜</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '14px', color: 'var(--ink)', marginBottom: '8px' }}>Создать альянс</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginBottom: '14px' }}>Станьте лидером своего альянса</div>
            <button onClick={() => setTab('create')} style={{
              padding: '8px 20px', background: 'var(--ink)', color: 'var(--gold-light)',
              border: 'none', borderRadius: '3px', fontFamily: 'Cinzel,serif', fontSize: '11px',
              letterSpacing: '1px', cursor: 'pointer',
            }}>СОЗДАТЬ</button>
          </div>
          <div className="card-base" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '14px', color: 'var(--ink)', marginBottom: '8px' }}>Найти альянс</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginBottom: '14px' }}>Присоединитесь к существующему</div>
            <button onClick={() => setTab('search')} style={{
              padding: '8px 20px', background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--border)', borderRadius: '3px', fontFamily: 'Cinzel,serif',
              fontSize: '11px', letterSpacing: '1px', cursor: 'pointer',
            }}>НАЙТИ</button>
          </div>
        </div>
      )}

      {/* Create form */}
      {tab === 'create' && !alliance && (
        <div className="card-base" style={{ padding: '20px', maxWidth: '420px' }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '16px' }}>СОЗДАТЬ АЛЬЯНС</div>
          {[
            { label: 'НАЗВАНИЕ', key: 'name', placeholder: 'Iron Fist' },
            { label: 'ТЕГ (3-8 букв)', key: 'tag', placeholder: 'IRON' },
            { label: 'ОПИСАНИЕ', key: 'description', placeholder: 'Краткое описание...' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--ink-muted)', marginBottom: '5px' }}>{f.label}</label>
              <input
                value={(createForm as any)[f.key]}
                onChange={e => setCreateForm({ ...createForm, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                maxLength={f.key === 'tag' ? 8 : f.key === 'name' ? 64 : 256}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '13px', outline: 'none' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setTab('overview')} style={{ flex: 1, padding: '9px', border: '1px solid var(--border)', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '10px', color: 'var(--ink-muted)' }}>ОТМЕНА</button>
            <button onClick={handleCreate} style={{ flex: 2, padding: '9px', background: 'var(--ink)', color: 'var(--gold-light)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px' }}>ОСНОВАТЬ АЛЬЯНС</button>
          </div>
        </div>
      )}

      {/* Search */}
      {tab === 'search' && !alliance && (
        <div className="card-base" style={{ padding: '20px', maxWidth: '600px' }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '12px' }}>НАЙТИ АЛЬЯНС</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Название или тег"
              style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '13px', outline: 'none' }} />
            <button onClick={handleSearch} style={{ padding: '8px 16px', background: 'var(--ink)', color: 'var(--gold-light)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '10px' }}>ИСКАТЬ</button>
          </div>
          {searchResults.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--ink)' }}>[{a.tag}] {a.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                  Лидер: {a.leader_name} · {a.member_count}/{a.max_members} · Сила: {a.power_rating.toLocaleString()}
                </div>
                {a.description && <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '2px' }}>{a.description}</div>}
              </div>
              <button onClick={() => handleJoin(a.id)} style={{
                padding: '6px 14px', background: 'var(--ink)', color: 'var(--gold-light)',
                border: 'none', borderRadius: '3px', fontFamily: 'Cinzel,serif', fontSize: '9px',
                letterSpacing: '1px', cursor: 'pointer',
              }}>ВСТУПИТЬ</button>
            </div>
          ))}
        </div>
      )}

      {/* Alliance dashboard */}
      {alliance && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
            {[
              { key: 'overview', label: 'Обзор' },
              { key: 'members', label: `Участники (${alliance.member_count})` },
              { key: 'diplomacy', label: 'Дипломатия' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)} style={{
                padding: '7px 16px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
                background: tab === t.key ? 'var(--ink)' : 'transparent',
                color: tab === t.key ? 'var(--gold-light)' : 'var(--ink-muted)',
                border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer',
              }}>{t.label}</button>
            ))}
            <button onClick={handleLeave} style={{
              marginLeft: 'auto', padding: '7px 14px', fontFamily: 'Cinzel,serif', fontSize: '10px',
              background: 'transparent', color: 'var(--crimson)', border: '1px solid var(--crimson-light)',
              borderRadius: '3px', cursor: 'pointer', letterSpacing: '1px',
            }}>ПОКИНУТЬ</button>
          </div>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                  {[
                    { label: 'СИЛА', val: alliance.power_rating?.toLocaleString() || '0' },
                    { label: 'ВОЙНЫ', val: alliance.war_rating?.toLocaleString() || '0' },
                    { label: 'УЧАСТНИКОВ', val: `${alliance.member_count}/${alliance.max_members}` },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--sand-2)', borderRadius: '3px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--ink-muted)', letterSpacing: '1.5px', marginBottom: '4px' }}>{s.label}</div>
                      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '20px', color: 'var(--ink)' }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Announcement */}
                {(alliance.myRole === 'leader' || alliance.myRole === 'deputy') ? (
                  <div className="card-base" style={{ padding: '14px' }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '8px' }}>ОБЪЯВЛЕНИЕ</div>
                    <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)}
                      placeholder="Напишите объявление для участников..."
                      rows={4}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '13px', resize: 'vertical', outline: 'none', fontFamily: 'Crimson Pro,serif' }}
                    />
                    <button onClick={handleSaveAnnouncement} disabled={savingAnn} style={{
                      marginTop: '8px', padding: '7px 16px', background: 'var(--ink)', color: 'var(--gold-light)',
                      border: 'none', borderRadius: '3px', fontFamily: 'Cinzel,serif', fontSize: '10px',
                      letterSpacing: '1px', cursor: 'pointer',
                    }}>{savingAnn ? '...' : 'СОХРАНИТЬ'}</button>
                  </div>
                ) : alliance.announcement ? (
                  <div className="card-base" style={{ padding: '14px' }}>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '8px' }}>ОБЪЯВЛЕНИЕ</div>
                    <div style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.6 }}>{alliance.announcement}</div>
                  </div>
                ) : null}
              </div>

              {/* Top members */}
              <div className="card-base" style={{ padding: '14px' }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '10px' }}>ТОП УЧАСТНИКОВ</div>
                {alliance.members?.slice(0, 8).map((m: any) => (
                  <div key={m.player_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: 'var(--ink)' }}>{m.nickname}</div>
                      <div style={{ fontSize: '10px', color: (ROLE_COLORS as any)[m.role] || 'var(--ink-muted)', marginTop: '1px' }}>
                        {ROLE_LABELS[m.role] || m.role}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ink-muted)' }}>
                      {m.power_rating?.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MEMBERS */}
          {tab === 'members' && (
            <div className="card-base" style={{ padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--sand-2)' }}>
                    {['Игрок', 'Роль', 'Поселений', 'Сила', 'Взнос', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--ink-muted)', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alliance.members?.map((m: any) => (
                    <tr key={m.player_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--ink)' }}>{m.nickname}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: '11px', color: (ROLE_COLORS as any)[m.role] || 'var(--ink-muted)', fontFamily: 'Cinzel,serif' }}>
                          {ROLE_LABELS[m.role] || m.role}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--ink-muted)' }}>{m.settlement_count}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--ink)' }}>{m.power_rating?.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--gold)' }}>{m.contribution_points}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {alliance.myRole === 'leader' && m.role !== 'leader' && (
                          <button onClick={() => handleKick(m.player_id, m.nickname)} style={{
                            padding: '4px 10px', background: 'none', border: '1px solid var(--crimson-light)',
                            borderRadius: '2px', color: 'var(--crimson)', fontSize: '10px',
                            fontFamily: 'Cinzel,serif', cursor: 'pointer',
                          }}>ИСКЛЮЧИТЬ</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DIPLOMACY */}
          {tab === 'diplomacy' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
              <div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '10px' }}>АКТИВНЫЕ ОТНОШЕНИЯ</div>
                {relations.length === 0 && (
                  <div style={{ color: 'var(--ink-muted)', fontSize: '13px', padding: '20px 0' }}>Нет дипломатических отношений</div>
                )}
                {relations.map((r: any) => {
                  const isA = r.alliance_a_id === alliance.id;
                  const other = isA ? { name: r.alliance_b_name, tag: r.alliance_b_tag } : { name: r.alliance_a_name, tag: r.alliance_a_tag };
                  const typeColors: Record<string, string> = { war: 'var(--crimson)', alliance: 'var(--teal-game)', trade_pact: 'var(--gold)', peace: 'var(--ink-muted)', truce: 'var(--navy)' };
                  return (
                    <div key={r.id} className="card-base" style={{ padding: '12px 14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--ink)' }}>[{other.tag}] {other.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                          {r.confirmed ? '✓ Подтверждено' : '⏳ Ожидает подтверждения'}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: typeColors[r.type] || 'var(--ink-muted)', border: `1px solid currentColor`, padding: '3px 8px', borderRadius: '2px' }}>
                        {r.type.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="card-base" style={{ padding: '14px' }}>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '12px' }}>ПРЕДЛОЖИТЬ</div>
                <input placeholder="ID альянса" id="diplo-target"
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '12px', marginBottom: '10px', outline: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { type: 'alliance', label: '🤝 Союз', color: 'var(--teal-game)' },
                    { type: 'trade_pact', label: '💰 Торговый пакт', color: 'var(--gold)' },
                    { type: 'truce', label: '🕊 Перемирие', color: 'var(--navy)' },
                    { type: 'war', label: '⚔ Объявить войну', color: 'var(--crimson)' },
                  ].map(d => (
                    <button key={d.type}
                      onClick={() => {
                        const target = (document.getElementById('diplo-target') as HTMLInputElement)?.value;
                        if (target) handleDiplomacy(target, d.type);
                      }}
                      style={{
                        padding: '8px', border: `1px solid ${d.color}20`,
                        background: `${d.color}10`, color: d.color,
                        borderRadius: '3px', fontFamily: 'Cinzel,serif', fontSize: '10px',
                        letterSpacing: '1px', cursor: 'pointer', textAlign: 'left',
                      }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
