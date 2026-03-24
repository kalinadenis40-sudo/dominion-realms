'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard.store';

const BUILDING_ICONS: Record<string, string> = {
  main_building: '🏰', sawmill: '🪵', quarry: '🪨', iron_mine: '⚙️',
  farm: '🌾', warehouse: '📦', wall: '🧱', barracks: '⚔️',
  stable: '🐴', workshop: '🔧', academy: '📜', market: '💰',
  watchtower: '🗼', palace: '👑',
};

const BUILDING_NAMES: Record<string, string> = {
  main_building: 'Главное здание', sawmill: 'Лесопилка', quarry: 'Каменоломня',
  iron_mine: 'Железная шахта', farm: 'Ферма', warehouse: 'Склад',
  wall: 'Стена', barracks: 'Казарма', stable: 'Конюшня',
  workshop: 'Мастерская', academy: 'Академия', market: 'Рынок',
  watchtower: 'Башня дозора', palace: 'Дворец',
};

export default function BuildingsPage() {
  const { data, fetchDashboard } = useDashboardStore();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const settlementId = data?.settlement?.id;

  useEffect(() => {
    if (!settlementId) return;
    loadBuildings();
  }, [settlementId]);

  const loadBuildings = async () => {
    if (!settlementId) return;
    try {
      const res: any = await apiClient.get(`/settlements/${settlementId}/buildings`);
      setBuildings(res.buildings || []);
      setQueue(res.queue || []);
    } catch (_) {}
  };

  const handleUpgrade = async (buildingType: string) => {
    if (!settlementId) return;
    setUpgrading(buildingType);
    setError('');
    try {
      await apiClient.post(`/settlements/${settlementId}/buildings/upgrade`, { buildingType });
      await loadBuildings();
      fetchDashboard();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    } finally {
      setUpgrading(null);
    }
  };

  const inQueue = (type: string) => queue.some((q) => q.building_type === type);

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: '18px', color: 'var(--ink)' }}>Здания</h1>
        <span style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>
          Очередь: {queue.length}/2
        </span>
      </div>

      {error && (
        <div style={{
          background: 'var(--crimson-light)', border: '1px solid var(--crimson)', borderRadius: '3px',
          padding: '10px 14px', marginBottom: '16px', color: 'var(--crimson)', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      {/* Active queue */}
      {queue.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '8px' }}>
            В ОЧЕРЕДИ
          </div>
          {queue.map((q: any) => (
            <div key={q.id} className="card-base" style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px',
              marginBottom: '6px', background: q.status === 'in_progress' ? 'var(--gold-pale)' : '#fff',
            }}>
              <span style={{ fontSize: '20px' }}>{BUILDING_ICONS[q.building_type] || '🏛'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: 'var(--ink)' }}>
                  {BUILDING_NAMES[q.building_type]} → Ур.{q.to_level}
                </div>
                <div style={{ height: '3px', background: 'var(--sand-3)', borderRadius: '2px', marginTop: '5px' }}>
                  <div style={{
                    height: '100%', background: 'var(--gold)', borderRadius: '2px',
                    width: q.status === 'in_progress'
                      ? `${Math.max(0, 100 - (q.seconds_remaining / q.duration_seconds) * 100)}%`
                      : '0%',
                    transition: 'width 2s',
                  }} />
                </div>
              </div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--gold)' }}>
                {q.status === 'in_progress' && q.seconds_remaining > 0
                  ? `${Math.floor(q.seconds_remaining / 60)}м ${q.seconds_remaining % 60}с`
                  : 'В очереди'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buildings grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
        {Object.keys(BUILDING_NAMES).map((type) => {
          const building = buildings.find((b) => b.building_type === type);
          const level = building?.level || 0;
          const queued = inQueue(type);

          return (
            <div key={type} className="card-base" style={{
              padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{BUILDING_ICONS[type] || '🏛'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--ink)' }}>
                    {BUILDING_NAMES[type]}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '1px' }}>
                    {level === 0 ? 'Не построено' : `Уровень ${level}`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: Math.min(level, 10) }).map((_, i) => (
                  <div key={i} style={{ height: '4px', flex: 1, background: 'var(--gold)', borderRadius: '2px' }} />
                ))}
                {Array.from({ length: Math.max(0, 10 - level) }).map((_, i) => (
                  <div key={i} style={{ height: '4px', flex: 1, background: 'var(--sand-3)', borderRadius: '2px' }} />
                ))}
              </div>

              <button
                onClick={() => handleUpgrade(type)}
                disabled={upgrading === type || queued || queue.length >= 2}
                style={{
                  padding: '7px', background: queued ? 'var(--sand-2)' : 'var(--ink)',
                  color: queued ? 'var(--ink-muted)' : 'var(--gold-light)',
                  border: '1px solid rgba(184,146,42,0.25)', borderRadius: '3px',
                  fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
                  cursor: (upgrading === type || queued || queue.length >= 2) ? 'not-allowed' : 'pointer',
                  opacity: queue.length >= 2 && !queued ? 0.5 : 1,
                }}
              >
                {upgrading === type ? '...' : queued ? '✓ В ОЧЕРЕДИ' : `УЛУЧШИТЬ → УР.${level + 1}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
