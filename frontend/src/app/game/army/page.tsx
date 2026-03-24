'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard.store';

const UNIT_ICONS: Record<string, string> = {
  spearman: '🗡️', swordsman: '⚔️', axeman: '🪓', archer: '🏹',
  crossbowman: '🎯', scout: '🔍', light_cavalry: '🐴', heavy_cavalry: '🦄',
  catapult: '💣', ram: '🪵', lord: '👑',
};
const UNIT_NAMES: Record<string, string> = {
  spearman: 'Копейщик', swordsman: 'Мечник', axeman: 'Топорщик',
  archer: 'Лучник', crossbowman: 'Арбалетчик', scout: 'Разведчик',
  light_cavalry: 'Лёгкая кавалерия', heavy_cavalry: 'Тяжёлая кавалерия',
  catapult: 'Катапульта', ram: 'Таран', lord: 'Наместник',
};

export default function ArmyPage() {
  const { data, fetchDashboard } = useDashboardStore();
  const [unitInfo, setUnitInfo] = useState<any[]>([]);
  const [myUnits, setMyUnits] = useState<any[]>([]);
  const [trainQueue, setTrainQueue] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [training, setTraining] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'train' | 'garrison'>('train');

  const settlementId = data?.settlement?.id;

  useEffect(() => {
    if (!settlementId) return;
    loadUnits();
    loadUnitInfo();
  }, [settlementId]);

  const loadUnits = async () => {
    if (!settlementId) return;
    const res: any = await apiClient.get(`/settlements/${settlementId}/units`);
    setMyUnits(res.units || []);
    setTrainQueue(res.queue || []);
  };

  const loadUnitInfo = async () => {
    if (!settlementId) return;
    const res: any = await apiClient.get(`/settlements/${settlementId}/units/info`);
    setUnitInfo(Array.isArray(res) ? res : []);
  };

  const handleTrain = async (unitType: string) => {
    const qty = parseInt(quantities[unitType] || '0');
    if (!qty || qty < 1) { setError('Введи количество'); return; }
    setTraining(unitType);
    setError('');
    try {
      await apiClient.post(`/settlements/${settlementId}/units/train`, { unitType, quantity: qty });
      await loadUnits();
      fetchDashboard();
      setQuantities({ ...quantities, [unitType]: '' });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    } finally {
      setTraining(null);
    }
  };

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: '18px', color: 'var(--ink)' }}>Армия</h1>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['train', 'garrison'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '5px 14px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
              background: tab === t ? 'var(--ink)' : 'transparent',
              color: tab === t ? 'var(--gold-light)' : 'var(--ink-muted)',
              border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer',
            }}>
              {t === 'train' ? 'ОБУЧЕНИЕ' : 'ГАРНИЗОН'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'var(--crimson-light)', border: '1px solid var(--crimson)',
          borderRadius: '3px', padding: '10px 14px', marginBottom: '16px',
          color: 'var(--crimson)', fontSize: '13px',
        }}>{error}</div>
      )}

      {/* Training queue */}
      {trainQueue.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '8px' }}>
            В ОБУЧЕНИИ
          </div>
          {trainQueue.map((q: any) => (
            <div key={q.id} className="card-base" style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px',
              background: q.status === 'in_progress' ? 'var(--gold-pale)' : '#fff',
            }}>
              <span style={{ fontSize: '20px' }}>{UNIT_ICONS[q.unit_type] || '⚔️'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: 'var(--ink)' }}>
                  {UNIT_NAMES[q.unit_type] || q.unit_type} × {q.quantity}
                </div>
                <div style={{ height: '3px', background: 'var(--sand-3)', borderRadius: '2px', marginTop: '5px' }}>
                  <div style={{
                    height: '100%', background: '#4A90A4', borderRadius: '2px',
                    width: q.status === 'in_progress'
                      ? `${Math.max(0, 100 - (q.seconds_remaining / q.duration_seconds) * 100)}%`
                      : '0%',
                  }} />
                </div>
              </div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: '#4A90A4' }}>
                {q.status === 'in_progress' && q.seconds_remaining > 0
                  ? `${Math.floor(q.seconds_remaining / 60)}м ${q.seconds_remaining % 60}с`
                  : 'В очереди'}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'train' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {unitInfo.map((u: any) => {
            const myUnit = myUnits.find((m) => m.unit_type === u.unitType);
            return (
              <div key={u.unitType} className="card-base" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '26px' }}>{UNIT_ICONS[u.unitType] || '⚔️'}</span>
                  <div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--ink)' }}>
                      {UNIT_NAMES[u.unitType] || u.unitType}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
                      В армии: {myUnit?.quantity || 0}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                  {[
                    { label: 'Атака', val: u.attack },
                    { label: 'Защита пех.', val: u.defense_infantry },
                    { label: 'Скорость', val: `${u.speed}мин` },
                    { label: 'Снабжение', val: `${u.upkeep_food}/h` },
                  ].map((s) => (
                    <div key={s.label} style={{
                      background: 'var(--sand)', borderRadius: '2px', padding: '4px 7px',
                    }}>
                      <div style={{ fontSize: '9px', color: 'var(--ink-muted)', fontFamily: 'Cinzel,serif', letterSpacing: '0.5px' }}>{s.label}</div>
                      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--ink)' }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Cost */}
                <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginBottom: '8px' }}>
                  {u.cost.wood > 0 && `🪵${u.cost.wood} `}
                  {u.cost.iron > 0 && `⚙️${u.cost.iron} `}
                  {u.cost.food > 0 && `🌾${u.cost.food} `}
                  {u.cost.silver > 0 && `🪙${u.cost.silver}`}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number" min="1" max="5000"
                    placeholder="Кол-во"
                    value={quantities[u.unitType] || ''}
                    onChange={(e) => setQuantities({ ...quantities, [u.unitType]: e.target.value })}
                    style={{
                      flex: 1, padding: '7px 10px', border: '1px solid var(--border)',
                      borderRadius: '3px', fontFamily: 'Cinzel,serif', fontSize: '12px',
                      color: 'var(--ink)', background: '#fff', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => handleTrain(u.unitType)}
                    disabled={training === u.unitType}
                    style={{
                      padding: '7px 14px', background: 'var(--ink)', color: 'var(--gold-light)',
                      border: '1px solid rgba(184,146,42,0.25)', borderRadius: '3px',
                      fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
                      cursor: training === u.unitType ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {training === u.unitType ? '...' : 'НАНЯТЬ'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'garrison' && (
        <div className="card-base" style={{ padding: '16px' }}>
          {myUnits.filter((u) => u.quantity > 0).length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--ink-muted)', padding: '20px', fontSize: '14px' }}>
              Нет войск — обучи армию во вкладке "Обучение"
            </div>
          ) : (
            myUnits.filter((u) => u.quantity > 0).map((u) => (
              <div key={u.unit_type} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '22px' }}>{UNIT_ICONS[u.unit_type] || '⚔️'}</span>
                <span style={{ flex: 1, fontFamily: 'Cinzel,serif', fontSize: '13px', color: 'var(--ink)' }}>
                  {UNIT_NAMES[u.unit_type] || u.unit_type}
                </span>
                <span className="tag tag-success">дома: {u.in_garrison}</span>
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '14px', color: 'var(--ink)' }}>
                  {u.quantity} всего
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
