'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { useDashboardStore } from '@/store/dashboard.store';
import { apiClient } from '@/lib/api';
import ChatWidget from '@/components/ChatWidget';

const NAV = [
  { label: 'Главная',      href: '/game',               icon: '⚜' },
  { label: 'Поселение',    href: '/game/settlement',     icon: '🏰' },
  { label: 'Здания',       href: '/game/buildings',      icon: '🏛' },
  { label: 'Армия',        href: '/game/army',           icon: '⚔️' },
  { label: 'Исследования', href: '/game/research',      icon: '📜' },
  { label: 'Карта',        href: '/game/map',            icon: '🗺' },
  { label: 'Отчёты',       href: '/game/reports',        icon: '📋' },
  { label: 'Рынок',        href: '/game/market',         icon: '💰' },
  { label: 'События',      href: '/game/events',         icon: '🌍' },
  { label: 'Квесты',       href: '/game/quests',         icon: '📜' },
  { label: 'Альянс',       href: '/game/alliance',       icon: '🛡' },
  { label: 'Рейтинг',      href: '/game/ranking',        icon: '👑' },
  { label: 'Сообщения',    href: '/game/messages',       icon: '✉️' },
  { label: 'Профиль',      href: '/game/profile',        icon: '👤' },
];

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, profile, clearAuth } = useAuthStore();
  const { data, fetchDashboard } = useDashboardStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/'); return; }
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const res = data?.resources;
  const incomingCount = data?.incomingAttacks?.length || 0;
  const notifsCount = data?.notifications?.filter((n: any) => !n.is_read).length || 0;
  const [msgUnread, setMsgUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.get('/messages/unread').then((res: any) => setMsgUnread(res?.count || 0)).catch(() => {});
  }, [isAuthenticated]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--sand)' }}>

      {/* TOP BAR */}
      <div style={{
        height: '48px', background: 'var(--ink)', display: 'flex', alignItems: 'center',
        borderBottom: '2px solid var(--gold)', flexShrink: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{
          width: sidebarOpen ? '200px' : '48px', transition: 'width 0.2s',
          display: 'flex', alignItems: 'center', gap: '8px', padding: '0 14px',
          borderRight: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
          cursor: 'pointer',
        }} onClick={() => setSidebarOpen(!sidebarOpen)}>
          <span style={{ fontSize: '16px' }}>⚜</span>
          {sidebarOpen && (
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: '12px', color: 'var(--gold-light)', letterSpacing: '2px' }}>
              DOMINION
            </span>
          )}
        </div>

        {/* Resources */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', overflow: 'hidden' }}>
          {res && [
            { icon: '🪵', val: res.wood,   rate: res.woodPerHour,   label: 'Дерево' },
            { icon: '🪨', val: res.stone,  rate: res.stonePerHour,  label: 'Камень' },
            { icon: '⚙️', val: res.iron,   rate: res.ironPerHour,   label: 'Железо' },
            { icon: '🌾', val: res.food,   rate: res.foodPerHour - res.foodConsumption, label: 'Еда', warn: true },
            { icon: '🪙', val: res.silver, rate: res.silverPerHour, label: 'Серебро' },
          ].map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '0 12px', borderRight: '1px solid rgba(255,255,255,0.07)',
            }}>
              <span style={{ fontSize: '13px' }}>{r.icon}</span>
              <div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: '#fff', lineHeight: 1 }}>
                  {Math.floor(r.val).toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: r.warn && r.rate < 0 ? '#ff8888' : 'var(--gold-shine)', lineHeight: 1, marginTop: '1px' }}>
                  {r.rate >= 0 ? '+' : ''}{Math.round(r.rate)}/h
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px' }}>
          {incomingCount > 0 && (
            <div style={{
              background: 'var(--crimson)', color: '#fff',
              fontFamily: 'Cinzel,serif', fontSize: '10px', padding: '3px 8px',
              borderRadius: '2px', letterSpacing: '1px', animation: 'pulse-gold 1.5s infinite',
            }}>
              ⚠ {incomingCount} АТАК{incomingCount > 1 ? 'И' : 'А'}
            </div>
          )}
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: '11px', color: 'var(--gold-light)' }}>
            {profile?.nickname}
          </div>
          <button onClick={() => { clearAuth(); router.push('/'); }}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '3px 8px',
              borderRadius: '2px', cursor: 'pointer', fontFamily: 'Cinzel,serif',
            }}>
            ВЫХОД
          </button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <div style={{
          width: sidebarOpen ? '200px' : '48px', transition: 'width 0.2s',
          background: 'var(--ink-light)', borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{ overflowY: 'auto', flex: 1, paddingTop: '8px' }}>
            {NAV.map((item) => {
              const active = pathname === item.href;
              const badge = item.href === '/game/reports' ? notifsCount
                          : item.href === '/game/messages' ? msgUnread : 0;
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: sidebarOpen ? '9px 16px' : '9px 14px',
                    borderLeft: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
                    background: active ? 'rgba(184,146,42,0.08)' : 'transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                    {sidebarOpen && (
                      <>
                        <span style={{
                          fontFamily: 'Crimson Pro,serif', fontSize: '13px',
                          color: active ? 'var(--gold-light)' : 'rgba(255,255,255,0.55)',
                          flex: 1, whiteSpace: 'nowrap',
                        }}>
                          {item.label}
                        </span>
                        {badge > 0 && (
                          <span style={{
                            background: 'var(--crimson)', color: '#fff',
                            fontSize: '9px', fontFamily: 'Cinzel,serif',
                            padding: '1px 5px', borderRadius: '2px',
                          }}>{badge}</span>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* World info */}
          {sidebarOpen && (
            <div style={{
              padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
              fontFamily: 'Cinzel,serif', fontSize: '9px', color: 'rgba(255,255,255,0.2)',
              letterSpacing: '1px',
            }}>
              АРКАДИЯ · СЕЗОН 1
            </div>
          )}
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
      <ChatWidget />
    </div>
  );
}
