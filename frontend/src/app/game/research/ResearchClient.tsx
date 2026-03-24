'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard.store';
import { useCountdown } from '@/hooks/useCountdown';

const CATEGORY_COLORS: Record<string,string> = {
  economy:'#B8922A', military:'#8B2020', scouting:'#1E3A5F',
  construction:'#1A5C4A', diplomacy:'#6B3FA0', logistics:'#5A6A4A',
  siege:'#8B4A00', defense:'#4A6B8A',
};
const CATEGORY_LABELS: Record<string,string> = {
  economy:'Экономика', military:'Военное', scouting:'Разведка',
  construction:'Строительство', diplomacy:'Дипломатия', logistics:'Логистика',
  siege:'Осада', defense:'Оборона',
};

function ResearchTimer({ seconds }: { seconds: number }) {
  const { formatted } = useCountdown(seconds);
  return <span style={{ fontFamily:'Cinzel,serif', color:'var(--gold)', fontSize:'12px' }}>{formatted}</span>;
}

export default function ResearchClient() {
  const { data: dashData } = useDashboardStore();
  const [tree, setTree]   = useState<any[]>([]);
  const [worldId, setWorldId] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [researching, setResearching] = useState<string|null>(null);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [inProgress, setInProgress] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/worlds').then((w: any) => { if (w[0]) setWorldId(w[0].id); }).catch(()=>{});
  }, []);

  useEffect(() => { if (worldId) loadTree(); }, [worldId]);

  const loadTree = async () => {
    try {
      await apiClient.post('/research/check?worldId='+worldId, {}).catch(()=>{});
      const res: any = await apiClient.get('/research?worldId='+worldId);
      const treeData = res || [];
      setTree(treeData);
      setInProgress(treeData.find((t: any) => t.isResearching) || null);
    } catch (_) {}
  };

  const handleResearch = async (researchType: string) => {
    const settlementId = dashData?.settlement?.id;
    if (!settlementId) { setError('Нет поселения'); return; }
    setResearching(researchType); setError(''); setSuccess('');
    try {
      await apiClient.post('/research/start', { worldId, researchType, settlementId });
      setSuccess('Исследование начато!');
      await loadTree();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка');
    } finally { setResearching(null); }
  };

  const categories = [...new Set(tree.map((t:any) => t.category))].filter(Boolean) as string[];
  const filtered   = activeCategory ? tree.filter((t:any) => t.category === activeCategory) : tree;

  return (
    <div style={{ maxWidth:'1000px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'20px' }}>
        <h1 style={{ fontFamily:'Cinzel,serif', fontSize:'18px', color:'var(--ink)' }}>Исследования</h1>
        <span style={{ fontSize:'12px', color:'var(--ink-muted)' }}>
          {tree.filter((t:any)=>t.currentLevel>0).length}/{tree.length} изучено
        </span>
      </div>

      {error   && <div style={{ background:'var(--crimson-light)', border:'1px solid var(--crimson)', borderRadius:'3px', padding:'10px 14px', marginBottom:'12px', color:'var(--crimson)', fontSize:'13px' }}>{error}</div>}
      {success && <div style={{ background:'var(--teal-light)', border:'1px solid #1A5C4A', borderRadius:'3px', padding:'10px 14px', marginBottom:'12px', color:'#1A5C4A', fontSize:'13px' }}>{success}</div>}

      {inProgress && (
        <div style={{ background:'var(--ink)', border:'1px solid rgba(184,146,42,0.3)', borderRadius:'4px', padding:'14px 18px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'14px' }}>
          <span style={{ fontSize:'24px' }}>⚗️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'13px', color:'#fff', marginBottom:'4px' }}>
              Изучается: {inProgress.key?.replace(/_/g,' ')} → Ур.{(inProgress.currentLevel||0)+1}
            </div>
            <div style={{ height:'3px', background:'rgba(255,255,255,0.1)', borderRadius:'2px', overflow:'hidden' }}>
              <div style={{ height:'100%', background:'var(--gold)', width:`${Math.max(0,100-(inProgress.secondsRemaining/(inProgress.duration||1))*100)}%`, transition:'width 1s' }} />
            </div>
          </div>
          <ResearchTimer seconds={inProgress.secondsRemaining||0} />
        </div>
      )}

      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap' }}>
        <button onClick={()=>setActiveCategory('')} style={{ padding:'6px 14px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px', background:!activeCategory?'var(--ink)':'transparent', color:!activeCategory?'var(--gold-light)':'var(--ink-muted)', border:'1px solid var(--border)', borderRadius:'3px', cursor:'pointer' }}>Все</button>
        {categories.map(cat => (
          <button key={cat} onClick={()=>setActiveCategory(cat===activeCategory?'':cat)} style={{ padding:'6px 14px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px', background:activeCategory===cat?(CATEGORY_COLORS[cat]||'var(--ink)'):'transparent', color:activeCategory===cat?'#fff':'var(--ink-muted)', border:`1px solid ${activeCategory===cat?(CATEGORY_COLORS[cat]||'var(--ink)')+'60':'var(--border)'}`, borderRadius:'3px', cursor:'pointer' }}>
            {CATEGORY_LABELS[cat]||cat}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(270px,1fr))', gap:'12px' }}>
        {filtered.map((tech: any) => {
          const catColor = CATEGORY_COLORS[tech.category] || '#888';
          const canStart = tech.canResearch && !inProgress;
          return (
            <div key={tech.key} className="card-base" style={{ padding:'14px', borderTop:`3px solid ${tech.currentLevel>0?catColor:'transparent'}`, opacity:tech.maxed?0.7:1 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <div>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:'12px', color:'var(--ink)' }}>
                    {tech.key?.replace(/_/g,' ').split(' ').map((w:string)=>w[0]?.toUpperCase()+w.slice(1)).join(' ')}
                  </div>
                  <div style={{ fontSize:'10px', color:catColor, marginTop:'1px' }}>{CATEGORY_LABELS[tech.category]||tech.category}</div>
                </div>
                <span style={{ fontFamily:'Cinzel,serif', fontSize:'12px', color:tech.currentLevel>0?catColor:'var(--ink-muted)' }}>
                  {tech.maxed?'МАКС':`${tech.currentLevel||0}/${tech.maxLevel}`}
                </span>
              </div>

              <div style={{ display:'flex', gap:'3px', marginBottom:'8px' }}>
                {Array.from({length:Math.min(tech.maxLevel||10,10)}).map((_,i)=>(
                  <div key={i} style={{ flex:1, height:'4px', borderRadius:'2px', background:i<(tech.currentLevel||0)?catColor:'var(--sand-3)' }} />
                ))}
              </div>

              {tech.bonus && (
                <div style={{ fontSize:'11px', color:'var(--ink-muted)', marginBottom:'6px' }}>
                  {tech.bonus.replace(/_/g,' ')}: +{(((tech.bonusPerLevel||0)*(tech.currentLevel||0))*100).toFixed(0)}%
                  {!tech.maxed&&<span style={{color:catColor}}> → +{(((tech.bonusPerLevel||0)*((tech.currentLevel||0)+1))*100).toFixed(0)}%</span>}
                </div>
              )}

              {!tech.maxed && tech.cost && (
                <div style={{ fontSize:'11px', color:'var(--ink-muted)', marginBottom:'8px' }}>
                  {Object.entries(tech.cost).map(([k,v]:any)=>`${v} ${k==='silver'?'🪙':k==='iron'?'⚙️':k}`).join(' · ')}
                  {tech.duration&&<span style={{marginLeft:'8px'}}>⏱ {Math.floor(tech.duration/60)}м</span>}
                </div>
              )}

              {tech.isResearching ? (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:'var(--ink-muted)' }}>Исследуется...</span>
                  <ResearchTimer seconds={tech.secondsRemaining||0} />
                </div>
              ) : !tech.maxed ? (
                <button onClick={()=>handleResearch(tech.key)} disabled={!canStart||researching===tech.key} style={{ width:'100%', padding:'7px', background:canStart?catColor:'var(--sand-2)', color:canStart?'#fff':'var(--ink-muted)', border:'none', borderRadius:'3px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px', cursor:canStart?'pointer':'not-allowed', opacity:inProgress&&!tech.isResearching?0.5:1 }}>
                  {researching===tech.key?'...':inProgress&&!tech.isResearching?'ЗАНЯТО':`ИЗУЧИТЬ УР.${(tech.currentLevel||0)+1}`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
