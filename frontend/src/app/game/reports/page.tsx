'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

const TYPE_ICONS: Record<string, string> = {
  attack: '⚔️', defense: '🛡', scout: '🔍',
  transport: '📦', trade: '💰', system: '⚙️',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReports(); }, [page, filter]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filter) params.set('type', filter);
      const res: any = await apiClient.get(`/reports?${params}`);
      setReports(res.reports || []);
      setTotal(res.total || 0);
    } catch (_) {}
    setLoading(false);
  };

  const deleteReport = async (id: string) => {
    await apiClient.delete(`/reports/${id}`);
    setReports(r => r.filter((x: any) => x.id !== id));
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: '18px', color: 'var(--ink)' }}>Отчёты</h1>
        <span style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>Всего: {total}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {[{ key: '', label: 'Все' },{ key: 'attack', label: '⚔ Атаки' },{ key: 'defense', label: '🛡 Защита' },{ key: 'scout', label: '🔍 Разведка' }].map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }} style={{
              padding: '5px 12px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
              background: filter === f.key ? 'var(--ink)' : 'transparent',
              color: filter === f.key ? 'var(--gold-light)' : 'var(--ink-muted)',
              border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '40px' }}>Загрузка...</div>}
      {!loading && reports.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-muted)', fontSize: '14px' }}>Нет отчётов</div>
      )}

      {reports.map((r: any) => (
        <div key={r.id} className="card-base" style={{
          marginBottom: '8px', overflow: 'hidden', opacity: r.is_read ? 0.75 : 1,
          borderLeft: r.is_read ? '3px solid transparent' : `3px solid ${
            r.attacker_won ? 'var(--gold)' : r.type === 'scout' ? 'var(--navy)' : 'var(--crimson)'}`,
        }}>
          <div onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <span style={{ fontSize: '18px' }}>{TYPE_ICONS[r.type] || '📋'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: r.is_read ? 400 : 500 }}>{r.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '1px' }}>
                {new Date(r.created_at).toLocaleString('ru')}
              </div>
            </div>
            {r.attacker_won !== undefined && r.attacker_won !== null && (
              <span className={`tag ${r.attacker_won ? 'tag-gold' : 'tag-danger'}`}>
                {r.attacker_won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}
              </span>
            )}
            {r.capture_success && <span className="tag tag-gold">ЗАХВАТ</span>}
            <span style={{ color: 'var(--ink-muted)', fontSize: '12px' }}>{expanded === r.id ? '▲' : '▼'}</span>
            <button onClick={e => { e.stopPropagation(); deleteReport(r.id); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', fontSize: '14px',
            }}>✕</button>
          </div>

          {expanded === r.id && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '14px', background: 'var(--sand)' }}>
              {r.attacker_won !== undefined && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  {[{ label: 'ПОТЕРИ АТАКУЮЩЕГО', data: r.attacker_losses },{ label: 'ПОТЕРИ ЗАЩИТНИКА', data: r.defender_losses }].map(col => (
                    <div key={col.label} style={{ background: '#fff', borderRadius: '3px', padding: '10px 12px' }}>
                      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--ink-muted)', letterSpacing: '1px', marginBottom: '6px' }}>{col.label}</div>
                      {col.data && Object.entries(col.data).filter(([,v]: any) => v > 0).map(([type, qty]: any) => (
                        <div key={type} style={{ fontSize: '12px', color: 'var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{type.replace(/_/g, ' ')}</span>
                          <span style={{ fontFamily: 'Cinzel,serif', color: 'var(--crimson)' }}>−{qty}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {r.resources_looted && Object.values(r.resources_looted).some((v: any) => v > 0) && (
                <div style={{ background: 'var(--gold-pale)', border: '1px solid rgba(184,146,42,0.3)', borderRadius: '3px', padding: '8px 12px', marginBottom: '10px' }}>
                  <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--gold)', letterSpacing: '1px', marginBottom: '4px' }}>ДОБЫЧА</div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {Object.entries(r.resources_looted).filter(([,v]: any) => v > 0).map(([res, qty]: any) => (
                      <span key={res} style={{ fontSize: '12px' }}>
                        {res === 'wood' ? '🪵' : res === 'stone' ? '🪨' : res === 'iron' ? '⚙️' : res === 'food' ? '🌾' : '🪙'} {qty}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {r.battle_log && r.battle_log.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'var(--ink-muted)', letterSpacing: '1px', marginBottom: '6px' }}>ЛОГ БОЯ</div>
                  {r.battle_log.map((line: string, i: number) => (
                    <div key={i} style={{ fontSize: '12px', color: 'var(--ink)', padding: '2px 0', borderBottom: '1px solid var(--border)' }}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ink-muted)' }}>← НАЗАД</button>
          <span style={{ padding: '6px 14px', fontFamily: 'Cinzel,serif', fontSize: '11px' }}>{page} / {Math.ceil(total/20)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page>=Math.ceil(total/20)} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '3px', background: '#fff', cursor: 'pointer', fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ink-muted)' }}>ДАЛЕЕ →</button>
        </div>
      )}
    </div>
  );
}
