'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const RARITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  common:    { bg:'var(--sand-2)',     text:'var(--ink-muted)', label:'Обычное' },
  rare:      { bg:'var(--blue-light)', text:'var(--navy)',      label:'Редкое' },
  epic:      { bg:'#EDE5F8',          text:'#6B3FA0',          label:'Эпическое' },
  legendary: { bg:'var(--gold-pale)', text:'var(--gold)',       label:'Легендарное' },
};

export default function ProfilePage() {
  const { profile } = useAuthStore();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<'stats'|'achievements'>('stats');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.get('/achievements').then((r: any) => setAchievements(r || [])).catch(()=>{}),
      apiClient.get('/auth/me').then((r: any) => setStats(r)).catch(()=>{}),
    ]);
  }, []);

  const unlocked = achievements.filter(a => a.unlocked);
  const filtered = filter ? achievements.filter(a => a.rarity === filter) : achievements;

  return (
    <div style={{ maxWidth:'900px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
        <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cinzel,serif', fontSize:'20px', color:'var(--ink)', border:'2px solid var(--gold-light)' }}>
          {profile?.nickname?.slice(0,2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontFamily:'Cinzel,serif', fontSize:'18px', color:'var(--ink)' }}>{profile?.nickname}</div>
          <div style={{ fontSize:'12px', color:'var(--ink-muted)', marginTop:'2px' }}>{unlocked.length}/{achievements.length} достижений</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:'4px', marginBottom:'20px' }}>
        {[{ key:'stats', label:'📊 Статистика' }, { key:'achievements', label:`🏆 Достижения (${unlocked.length})` }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding:'7px 16px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px',
            background: tab===t.key ? 'var(--ink)' : 'transparent',
            color: tab===t.key ? 'var(--gold-light)' : 'var(--ink-muted)',
            border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
          {[
            { label:'ПОСЕЛЕНИЙ', val:stats.total_settlements||1, icon:'🏰' },
            { label:'ПОБЕДЫ',    val:stats.total_victories||0,  icon:'⚔️' },
            { label:'ПОРАЖЕНИЯ', val:stats.total_defeats||0,    icon:'🛡' },
            { label:'ЗАХВАТОВ',  val:stats.total_captures||0,   icon:'🚩' },
            { label:'РЕЙТИНГ',   val:(stats.power_rating||0).toLocaleString(), icon:'⚡' },
            { label:'ВОЙНА',     val:(stats.war_rating||0).toLocaleString(),   icon:'💀' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--sand-2)', borderRadius:'4px', padding:'16px', textAlign:'center' }}>
              <div style={{ fontSize:'28px', marginBottom:'6px' }}>{s.icon}</div>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:'22px', color:'var(--ink)', marginBottom:'4px' }}>{s.val}</div>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'1.5px', color:'var(--ink-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'achievements' && (
        <>
          <div style={{ display:'flex', gap:'6px', marginBottom:'16px', flexWrap:'wrap' }}>
            <button onClick={() => setFilter('')} style={{ padding:'5px 12px', fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'1px', background:!filter?'var(--ink)':'transparent', color:!filter?'var(--gold-light)':'var(--ink-muted)', border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer' }}>Все</button>
            {Object.entries(RARITY_COLORS).map(([rarity, cfg]) => (
              <button key={rarity} onClick={() => setFilter(rarity)} style={{ padding:'5px 12px', fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'1px', background:filter===rarity?cfg.bg:'transparent', color:filter===rarity?cfg.text:'var(--ink-muted)', border:`1px solid ${filter===rarity?cfg.text+'40':'var(--border)'}`, borderRadius:'3px', cursor:'pointer' }}>{cfg.label}</button>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:'10px' }}>
            {filtered.filter(a=>a.unlocked).map((a: any) => {
              const rc = RARITY_COLORS[a.rarity]||RARITY_COLORS.common;
              return (
                <div key={a.key} style={{ background:rc.bg, border:`1px solid ${rc.text}30`, borderRadius:'4px', padding:'14px', position:'relative' }}>
                  <div style={{ fontSize:'28px', marginBottom:'6px' }}>{a.icon}</div>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:'12px', color:rc.text, marginBottom:'3px' }}>{a.title}</div>
                  <div style={{ fontSize:'11px', color:'var(--ink-muted)', marginBottom:'6px' }}>{a.description}</div>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:'9px', color:rc.text, letterSpacing:'1px' }}>{rc.label.toUpperCase()}</div>
                  <div style={{ position:'absolute', top:'10px', right:'10px', fontSize:'16px' }}>✅</div>
                </div>
              );
            })}
            {filtered.filter(a=>!a.unlocked).map((a: any) => (
              <div key={a.key} style={{ background:'var(--sand-2)', border:'1px solid var(--border)', borderRadius:'4px', padding:'14px', opacity:0.5 }}>
                <div style={{ fontSize:'28px', marginBottom:'6px', filter:'grayscale(1)' }}>{a.icon}</div>
                <div style={{ fontFamily:'Cinzel,serif', fontSize:'12px', color:'var(--ink-muted)', marginBottom:'3px' }}>{a.title}</div>
                <div style={{ fontSize:'11px', color:'var(--ink-muted)' }}>{a.description}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
