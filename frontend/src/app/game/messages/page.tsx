'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export default function MessagesPage() {
  const [tab, setTab] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [inbox, setInbox] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [compose, setCompose] = useState({ to: '', subject: '', content: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [inboxRes, sentRes, unreadRes]: any[] = await Promise.all([
        apiClient.get('/messages/inbox'),
        apiClient.get('/messages/sent'),
        apiClient.get('/messages/unread'),
      ]);
      setInbox(inboxRes || []);
      setSent(sentRes || []);
      setUnread(unreadRes?.count || 0);
    } catch (_) {}
  };

  const openMessage = async (msg: any) => {
    try {
      const full: any = await apiClient.get(`/messages/${msg.id}`);
      setSelected(full);
      if (!msg.is_read) {
        setInbox(prev => prev.map((m: any) => m.id === msg.id ? { ...m, is_read: true } : m));
        setUnread(u => Math.max(0, u - 1));
      }
    } catch (_) {}
  };

  const handleSend = async () => {
    if (!compose.to || !compose.subject || !compose.content) { setError('Заполни все поля'); return; }
    setSending(true); setError('');
    try {
      await apiClient.post('/messages/send', {
        recipientNickname: compose.to,
        subject: compose.subject,
        content: compose.content,
      });
      setSuccess(`✓ Сообщение отправлено игроку ${compose.to}`);
      setCompose({ to: '', subject: '', content: '' });
      setTab('sent');
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка отправки');
    } finally { setSending(false); }
  };

  const list = tab === 'inbox' ? inbox : sent;

  return (
    <div style={{ maxWidth: '900px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', height: 'calc(100vh - 140px)' }}>

      {/* LEFT — message list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: '12px', gap: '4px' }}>
          <button onClick={() => { setTab('inbox'); setSelected(null); }} style={{
            flex: 1, padding: '7px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
            background: tab === 'inbox' ? 'var(--ink)' : 'transparent',
            color: tab === 'inbox' ? 'var(--gold-light)' : 'var(--ink-muted)',
            border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer',
          }}>
            📥 ВХОДЯЩИЕ {unread > 0 && <span style={{ background: 'var(--crimson)', color: '#fff', borderRadius: '2px', padding: '0 4px', fontSize: '9px', marginLeft: '4px' }}>{unread}</span>}
          </button>
          <button onClick={() => { setTab('sent'); setSelected(null); }} style={{
            flex: 1, padding: '7px', fontFamily: 'Cinzel,serif', fontSize: '10px', letterSpacing: '1px',
            background: tab === 'sent' ? 'var(--ink)' : 'transparent',
            color: tab === 'sent' ? 'var(--gold-light)' : 'var(--ink-muted)',
            border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer',
          }}>📤 ОТПРАВЛЕНО</button>
        </div>

        {/* Compose button */}
        <button onClick={() => { setTab('compose'); setSelected(null); setError(''); setSuccess(''); }} style={{
          padding: '9px', background: 'var(--gold)', color: 'var(--ink)',
          border: 'none', borderRadius: '3px', fontFamily: 'Cinzel,serif', fontSize: '10px',
          letterSpacing: '2px', cursor: 'pointer', marginBottom: '12px', fontWeight: 600,
        }}>+ НАПИСАТЬ</button>

        {/* Messages list */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px' }}>
          {list.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '13px' }}>
              {tab === 'inbox' ? 'Нет сообщений' : 'Нет отправленных'}
            </div>
          )}
          {list.map((msg: any) => (
            <div key={msg.id} onClick={() => { openMessage(msg); setTab(tab); }}
              style={{
                padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                background: selected?.id === msg.id ? 'var(--sand-2)' : !msg.is_read ? 'var(--gold-pale)' : '#fff',
                transition: 'background 0.1s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                {!msg.is_read && tab === 'inbox' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />
                )}
                <span style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab === 'inbox' ? msg.sender_name : msg.recipient_name}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--ink-muted)', flexShrink: 0 }}>
                  {new Date(msg.created_at).toLocaleDateString('ru')}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.subject}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — content area */}
      <div className="card-base" style={{ padding: '20px', overflowY: 'auto' }}>

        {/* Compose form */}
        {tab === 'compose' && (
          <>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', letterSpacing: '2px', color: 'var(--ink-muted)', marginBottom: '16px' }}>
              НОВОЕ СООБЩЕНИЕ
            </div>
            {error && <div style={{ background: 'var(--crimson-light)', border: '1px solid var(--crimson)', borderRadius: '3px', padding: '8px 12px', marginBottom: '12px', color: 'var(--crimson)', fontSize: '12px' }}>{error}</div>}
            {success && <div style={{ background: 'var(--teal-light)', border: '1px solid var(--teal-game)', borderRadius: '3px', padding: '8px 12px', marginBottom: '12px', color: 'var(--teal-game)', fontSize: '12px' }}>{success}</div>}
            {[
              { label: 'КОМУ (никнейм)', key: 'to', placeholder: 'LordVaron' },
              { label: 'ТЕМА', key: 'subject', placeholder: 'Предложение о союзе' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--ink-muted)', marginBottom: '5px' }}>{f.label}</label>
                <input value={(compose as any)[f.key]} onChange={e => setCompose({ ...compose, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '13px', outline: 'none' }} />
              </div>
            ))}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontFamily: 'Cinzel,serif', fontSize: '9px', letterSpacing: '1px', color: 'var(--ink-muted)', marginBottom: '5px' }}>СООБЩЕНИЕ</label>
              <textarea value={compose.content} onChange={e => setCompose({ ...compose, content: e.target.value })}
                placeholder="Текст сообщения..."
                rows={8}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '13px', resize: 'vertical', outline: 'none', fontFamily: 'Crimson Pro,serif', lineHeight: 1.6 }}
              />
            </div>
            <button onClick={handleSend} disabled={sending} style={{
              padding: '10px 24px', background: 'var(--ink)', color: 'var(--gold-light)',
              border: 'none', borderRadius: '3px', fontFamily: 'Cinzel,serif', fontSize: '11px',
              letterSpacing: '2px', cursor: sending ? 'not-allowed' : 'pointer',
            }}>{sending ? '...' : 'ОТПРАВИТЬ'}</button>
          </>
        )}

        {/* Message detail */}
        {selected && tab !== 'compose' && (
          <>
            <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: '15px', color: 'var(--ink)', marginBottom: '6px' }}>
                {selected.subject}
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--ink-muted)' }}>
                <span>От: <strong style={{ color: 'var(--ink)' }}>{selected.sender_name}</strong></span>
                <span>Кому: <strong style={{ color: 'var(--ink)' }}>{selected.recipient_name}</strong></span>
                <span>{new Date(selected.created_at).toLocaleString('ru')}</span>
              </div>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
              {selected.content}
            </div>
            <button onClick={() => {
              setTab('compose');
              setCompose({ to: selected.sender_name, subject: `Re: ${selected.subject}`, content: '' });
            }} style={{
              padding: '8px 20px', background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--border)', borderRadius: '3px', fontFamily: 'Cinzel,serif',
              fontSize: '10px', letterSpacing: '1px', cursor: 'pointer',
            }}>↩ ОТВЕТИТЬ</button>
          </>
        )}

        {/* Empty state */}
        {!selected && tab !== 'compose' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-muted)', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '32px' }}>✉️</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', letterSpacing: '2px' }}>
              ВЫБЕРИТЕ СООБЩЕНИЕ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
