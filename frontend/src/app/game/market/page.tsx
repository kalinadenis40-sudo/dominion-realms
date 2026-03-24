'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard.store';

const RES_ICONS: Record<string, string> = { wood:'🪵', stone:'🪨', iron:'⚙️', food:'🌾', silver:'🪙' };
const RES_NAMES: Record<string, string> = { wood:'Дерево', stone:'Камень', iron:'Железо', food:'Еда', silver:'Серебро' };

export default function MarketPage() {
  const { data: dashData } = useDashboardStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [worldId, setWorldId] = useState('');
  const [tab, setTab] = useState<'browse'|'create'|'my'>('browse');
  const [filterRes, setFilterRes] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({ offerResource:'wood', offerAmount:'', wantResource:'silver', wantAmount:'' });
  const [creating, setCreating] = useState(false);
  const [fulfilling, setFulfilling] = useState<string|null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const resources = ['wood','stone','iron','food','silver'];

  useEffect(() => { loadWorldId(); }, []);
  useEffect(() => { if (worldId) loadOrders(); }, [worldId, filterRes, page]);

  const loadWorldId = async () => {
    try {
      const worlds: any = await apiClient.get('/worlds');
      if (worlds[0]) setWorldId(worlds[0].id);
    } catch (_) {}
  };

  const loadOrders = async () => {
    try {
      const params: any = { worldId, page };
      if (filterRes) params.resource = filterRes;
      const res: any = await apiClient.get(`/market?${new URLSearchParams(params)}`);
      setOrders(res.orders || []);
      setTotal(res.total || 0);
    } catch (_) {}
  };

  const loadMyOrders = async () => {
    try {
      const res: any = await apiClient.get('/market/my');
      setMyOrders(res || []);
    } catch (_) {}
  };

  const handleCreate = async () => {
    if (!form.offerAmount || !form.wantAmount) { setError('Заполни все поля'); return; }
    if (form.offerResource === form.wantResource) { setError('Нельзя обменять на тот же ресурс'); return; }
    setCreating(true); setError('');
    try {
      const settlement = dashData?.settlement?.id;
      if (!settlement) throw new Error('Нет поселения');
      await apiClient.post('/market/create', {
        settlementId: settlement,
        offerResource: form.offerResource, offerAmount: parseInt(form.offerAmount),
        wantResource: form.wantResource,   wantAmount:  parseInt(form.wantAmount),
      });
      setSuccess('Ордер выставлен!');
      setForm({ offerResource:'wood', offerAmount:'', wantResource:'silver', wantAmount:'' });
      await loadOrders();
      await loadMyOrders();
      setTab('my');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    } finally { setCreating(false); }
  };

  const handleFulfill = async (orderId: string) => {
    setFulfilling(orderId); setError('');
    try {
      const settlement = dashData?.settlement?.id;
      if (!settlement) throw new Error('Нет поселения');
      await apiClient.post(`/market/${orderId}/fulfill`, { settlementId: settlement });
      setSuccess('Сделка совершена!');
      await loadOrders();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    } finally { setFulfilling(null); }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await apiClient.delete(`/market/${orderId}`);
      await loadMyOrders();
      setSuccess('Ордер отменён, ресурсы возвращены');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    }
  };

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Cinzel,serif', fontSize: '18px', color: 'var(--ink)' }}>Рынок</h1>
        <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Комиссия 5% · Ордер действует 48ч</span>
      </div>

      {error   && <div style={{ background:'var(--crimson-light)', border:'1px solid var(--crimson)', borderRadius:'3px', padding:'10px 14px', marginBottom:'12px', color:'var(--crimson)', fontSize:'13px' }}>{error}</div>}
      {success && <div style={{ background:'var(--teal-light)', border:'1px solid var(--teal-game)', borderRadius:'3px', padding:'10px 14px', marginBottom:'12px', color:'var(--teal-game)', fontSize:'13px' }}>{success}</div>}

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'16px' }}>
        {[
          { key:'browse', label:'🔍 Все ордера' },
          { key:'create', label:'+ Создать ордер' },
          { key:'my',     label:'📋 Мои ордера' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); if (t.key==='my') loadMyOrders(); }} style={{
            padding:'7px 16px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px',
            background: tab===t.key ? 'var(--ink)' : 'transparent',
            color: tab===t.key ? 'var(--gold-light)' : 'var(--ink-muted)',
            border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* BROWSE */}
      {tab === 'browse' && (
        <>
          {/* Filter bar */}
          <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
            <button onClick={() => { setFilterRes(''); setPage(1); }} style={{
              padding:'5px 12px', fontFamily:'Cinzel,serif', fontSize:'10px',
              background: !filterRes ? 'var(--ink)' : 'transparent',
              color: !filterRes ? 'var(--gold-light)' : 'var(--ink-muted)',
              border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer',
            }}>Все</button>
            {resources.map(r => (
              <button key={r} onClick={() => { setFilterRes(r); setPage(1); }} style={{
                padding:'5px 12px', fontFamily:'Cinzel,serif', fontSize:'10px',
                background: filterRes===r ? 'var(--ink)' : 'transparent',
                color: filterRes===r ? 'var(--gold-light)' : 'var(--ink-muted)',
                border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer',
              }}>{RES_ICONS[r]} {RES_NAMES[r]}</button>
            ))}
          </div>

          {/* Orders table */}
          <div className="card-base" style={{ overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--sand-2)' }}>
                  {['Продавец','Предлагает','Хочет','Курс',''].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'1.5px', color:'var(--ink-muted)', fontWeight:400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={5} style={{ padding:'30px', textAlign:'center', color:'var(--ink-muted)', fontSize:'13px' }}>Нет активных ордеров</td></tr>
                )}
                {orders.map((o: any) => {
                  const rate = (o.want_amount / o.offer_amount).toFixed(2);
                  return (
                    <tr key={o.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'10px 14px', fontSize:'13px', color:'var(--ink)' }}>{o.seller_name}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontFamily:'Cinzel,serif', fontSize:'13px', color:'var(--ink)' }}>
                          {RES_ICONS[o.offer_resource]} {o.offer_amount.toLocaleString()} {RES_NAMES[o.offer_resource]}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontFamily:'Cinzel,serif', fontSize:'13px', color:'var(--gold)' }}>
                          {RES_ICONS[o.want_resource]} {o.want_amount.toLocaleString()} {RES_NAMES[o.want_resource]}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:'11px', color:'var(--ink-muted)' }}>
                        1:{rate}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <button onClick={() => handleFulfill(o.id)} disabled={fulfilling === o.id} style={{
                          padding:'5px 12px', background:'var(--teal-game)', color:'#fff',
                          border:'none', borderRadius:'3px', fontFamily:'Cinzel,serif', fontSize:'9px',
                          letterSpacing:'1px', cursor: fulfilling===o.id ? 'not-allowed' : 'pointer',
                        }}>{fulfilling===o.id ? '...' : 'КУПИТЬ'}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > 30 && (
            <div style={{ display:'flex', justifyContent:'center', gap:'8px', marginTop:'14px' }}>
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'6px 14px', border:'1px solid var(--border)', borderRadius:'3px', background:'#fff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:'11px', color:'var(--ink-muted)' }}>← НАЗАД</button>
              <span style={{ padding:'6px 14px', fontFamily:'Cinzel,serif', fontSize:'11px' }}>{page}/{Math.ceil(total/30)}</span>
              <button onClick={() => setPage(p=>p+1)} disabled={page>=Math.ceil(total/30)} style={{ padding:'6px 14px', border:'1px solid var(--border)', borderRadius:'3px', background:'#fff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:'11px', color:'var(--ink-muted)' }}>ДАЛЕЕ →</button>
            </div>
          )}
        </>
      )}

      {/* CREATE */}
      {tab === 'create' && (
        <div className="card-base" style={{ padding:'24px', maxWidth:'480px' }}>
          <div style={{ fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'2px', color:'var(--ink-muted)', marginBottom:'20px' }}>НОВЫЙ ОРДЕР</div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
            <div>
              <label style={{ display:'block', fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'1px', color:'var(--ink-muted)', marginBottom:'6px' }}>ПРЕДЛАГАЮ</label>
              <select value={form.offerResource} onChange={e => setForm({...form, offerResource:e.target.value})}
                style={{ width:'100%', padding:'8px', border:'1px solid var(--border)', borderRadius:'3px', fontSize:'13px', marginBottom:'8px', outline:'none' }}>
                {resources.map(r => <option key={r} value={r}>{RES_ICONS[r]} {RES_NAMES[r]}</option>)}
              </select>
              <input type="number" placeholder="Количество" value={form.offerAmount} onChange={e => setForm({...form, offerAmount:e.target.value})}
                style={{ width:'100%', padding:'8px', border:'1px solid var(--border)', borderRadius:'3px', fontSize:'13px', outline:'none' }} />
            </div>
            <div>
              <label style={{ display:'block', fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'1px', color:'var(--ink-muted)', marginBottom:'6px' }}>ХОЧУ ПОЛУЧИТЬ</label>
              <select value={form.wantResource} onChange={e => setForm({...form, wantResource:e.target.value})}
                style={{ width:'100%', padding:'8px', border:'1px solid var(--border)', borderRadius:'3px', fontSize:'13px', marginBottom:'8px', outline:'none' }}>
                {resources.map(r => <option key={r} value={r}>{RES_ICONS[r]} {RES_NAMES[r]}</option>)}
              </select>
              <input type="number" placeholder="Количество" value={form.wantAmount} onChange={e => setForm({...form, wantAmount:e.target.value})}
                style={{ width:'100%', padding:'8px', border:'1px solid var(--border)', borderRadius:'3px', fontSize:'13px', outline:'none' }} />
            </div>
          </div>

          {form.offerAmount && form.wantAmount && (
            <div style={{ background:'var(--gold-pale)', borderRadius:'3px', padding:'10px 14px', marginBottom:'16px', fontSize:'13px', color:'var(--ink)' }}>
              Курс: 1 {RES_NAMES[form.offerResource]} = {(parseInt(form.wantAmount)/parseInt(form.offerAmount)).toFixed(2)} {RES_NAMES[form.wantResource]}
              <div style={{ fontSize:'11px', color:'var(--ink-muted)', marginTop:'3px' }}>Комиссия с покупателя: {Math.ceil(parseInt(form.wantAmount)*0.05)} {RES_NAMES[form.wantResource]}</div>
            </div>
          )}

          <button onClick={handleCreate} disabled={creating} style={{
            width:'100%', padding:'11px', background:'var(--ink)', color:'var(--gold-light)',
            border:'none', borderRadius:'3px', fontFamily:'Cinzel,serif', fontSize:'11px',
            letterSpacing:'2px', cursor:creating ? 'not-allowed' : 'pointer',
          }}>{creating ? '...' : 'ВЫСТАВИТЬ НА РЫНОК'}</button>
        </div>
      )}

      {/* MY ORDERS */}
      {tab === 'my' && (
        <div>
          {myOrders.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px', color:'var(--ink-muted)', fontSize:'13px' }}>У вас нет активных ордеров</div>
          )}
          {myOrders.map((o: any) => (
            <div key={o.id} className="card-base" style={{ padding:'14px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'14px' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', color:'var(--ink)', marginBottom:'4px' }}>
                  {RES_ICONS[o.offer_resource]} {o.offer_amount.toLocaleString()} {RES_NAMES[o.offer_resource]}
                  <span style={{ color:'var(--ink-muted)', margin:'0 8px' }}>→</span>
                  {RES_ICONS[o.want_resource]} {o.want_amount.toLocaleString()} {RES_NAMES[o.want_resource]}
                </div>
                <div style={{ fontSize:'11px', color:'var(--ink-muted)' }}>
                  {o.is_fulfilled ? '✅ Выполнен' : o.is_active ? '⏳ Активен' : '❌ Отменён'}
                  {o.expires_at && !o.is_fulfilled && ` · Истекает ${new Date(o.expires_at).toLocaleDateString('ru')}`}
                </div>
              </div>
              {o.is_active && !o.is_fulfilled && (
                <button onClick={() => handleCancel(o.id)} style={{
                  padding:'6px 14px', background:'transparent', color:'var(--crimson)',
                  border:'1px solid var(--crimson-light)', borderRadius:'3px',
                  fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'1px', cursor:'pointer',
                }}>ОТМЕНИТЬ</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
