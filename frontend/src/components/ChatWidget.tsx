'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function ChatWidget() {
  const { profile } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (activeRoom) loadMessages(activeRoom.id);
  }, [activeRoom]);

  useEffect(() => {
    if (open && !activeRoom && rooms.length > 0) setActiveRoom(rooms[0]);
  }, [open, rooms]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadRooms = async () => {
    try {
      const res: any = await apiClient.get('/chat/rooms');
      setRooms(res || []);
    } catch (_) {}
  };

  const loadMessages = async (roomId: string) => {
    try {
      const res: any = await apiClient.get(`/chat/rooms/${roomId}/messages?limit=40`);
      setMessages(res || []);
    } catch (_) {}
  };

  const handleSend = async () => {
    if (!input.trim() || !activeRoom || sending) return;
    setSending(true);
    try {
      const msg: any = await apiClient.post(`/chat/rooms/${activeRoom.id}/send`, { content: input.trim() });
      setMessages(prev => [...prev, msg]);
      setInput('');
    } catch (_) {}
    setSending(false);
  };

  // Auto-refresh messages every 10s
  useEffect(() => {
    if (!open || !activeRoom) return;
    const interval = setInterval(() => loadMessages(activeRoom.id), 10000);
    return () => clearInterval(interval);
  }, [open, activeRoom]);

  const roomLabel = (type: string) => type === 'global' ? '🌐 Глобальный' : '🛡 Альянс';

  return (
    <div style={{ position: 'fixed', bottom: '12px', right: '12px', zIndex: 500 }}>
      {/* Chat window */}
      {open && (
        <div style={{
          width: '300px', height: '360px', background: '#fff',
          border: '1px solid var(--border)', borderRadius: '4px',
          boxShadow: '0 4px 20px rgba(28,23,18,0.15)',
          display: 'flex', flexDirection: 'column', marginBottom: '8px',
        }}>
          {/* Header */}
          <div style={{
            background: 'var(--ink)', padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: '8px',
            borderRadius: '4px 4px 0 0',
          }}>
            {rooms.map(r => (
              <button key={r.id} onClick={() => setActiveRoom(r)} style={{
                padding: '3px 8px', background: activeRoom?.id === r.id ? 'rgba(184,146,42,0.3)' : 'transparent',
                border: activeRoom?.id === r.id ? '1px solid rgba(184,146,42,0.5)' : '1px solid transparent',
                borderRadius: '2px', cursor: 'pointer',
                fontFamily: 'Cinzel,serif', fontSize: '9px', color: activeRoom?.id === r.id ? 'var(--gold-light)' : 'rgba(255,255,255,0.5)',
                letterSpacing: '0.5px',
              }}>
                {roomLabel(r.type)}
              </button>
            ))}
            <button onClick={() => setOpen(false)} style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px',
            }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {messages.length === 0 && (
              <div style={{ color: 'var(--ink-muted)', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>Нет сообщений</div>
            )}
            {messages.map((msg: any) => {
              const isMe = msg.sender_id === profile?.id || msg.sender_name === profile?.nickname;
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && (
                    <div style={{ fontSize: '10px', color: 'var(--gold)', fontFamily: 'Cinzel,serif', marginBottom: '1px' }}>
                      {msg.sender_name}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '5px 9px', borderRadius: '3px',
                    background: isMe ? 'var(--ink)' : 'var(--sand-2)',
                    color: isMe ? 'rgba(255,255,255,0.9)' : 'var(--ink)',
                    fontSize: '12px', lineHeight: 1.4,
                  }}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--ink-muted)', marginTop: '1px' }}>
                    {new Date(msg.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', display: 'flex', gap: '6px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Написать..."
              maxLength={500}
              style={{
                flex: 1, padding: '6px 8px', border: '1px solid var(--border)',
                borderRadius: '3px', fontSize: '12px', outline: 'none',
              }}
            />
            <button onClick={handleSend} disabled={sending || !input.trim()} style={{
              padding: '6px 10px', background: 'var(--ink)', color: 'var(--gold-light)',
              border: 'none', borderRadius: '3px', cursor: sending ? 'not-allowed' : 'pointer',
              fontSize: '12px',
            }}>↗</button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button onClick={() => setOpen(!open)} style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: open ? 'var(--ink-light)' : 'var(--ink)',
        border: '2px solid var(--gold)',
        color: 'var(--gold-light)', fontSize: '18px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(28,23,18,0.2)',
        transition: 'all 0.2s',
      }}>
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
