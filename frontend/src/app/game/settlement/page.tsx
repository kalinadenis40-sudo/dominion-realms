'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard.store';

const BICONS: Record<string,string> = { main_building:'🏰',sawmill:'🪵',quarry:'🪨',iron_mine:'⚙️',farm:'🌾',warehouse:'📦',wall:'🧱',barracks:'⚔️',stable:'🐴',workshop:'🔧',academy:'📜',market:'💰',watchtower:'🗼',palace:'👑' };
const BNAMES: Record<string,string> = { main_building:'Главное здание',sawmill:'Лесопилка',quarry:'Каменоломня',iron_mine:'Железная шахта',farm:'Ферма',warehouse:'Склад',wall:'Стена',barracks:'Казарма',stable:'Конюшня',workshop:'Мастерская',academy:'Академия',market:'Рынок',watchtower:'Башня дозора',palace:'Дворец' };

export default function SettlementPage() {
  const { data: dashData } = useDashboardStore();
  const [settlement, setSettlement] = useState<any>(null);
  const [tab, setTab] = useState<'overview'|'buildings'|'resources'>('overview');

  useEffect(() => {
    const id = dashData?.settlement?.id;
    if (!id) return;
    apiClient.get(`/settlements/${id}/full`).then((r:any)=>setSettlement(r)).catch(()=>{});
  }, [dashData?.settlement?.id]);

  if (!settlement) return <div style={{textAlign:'center',padding:'60px',color:'var(--ink-muted)',fontFamily:'Cinzel,serif',letterSpacing:'2px'}}>ЗАГРУЗКА...</div>;

  const res = dashData?.resources;
  const resources = [
    {key:'wood',icon:'🪵',label:'Дерево', val:Math.floor(res?.wood||0), rate:res?.woodPerHour||0, limit:res?.woodLimit||2000},
    {key:'stone',icon:'🪨',label:'Камень',val:Math.floor(res?.stone||0),rate:res?.stonePerHour||0,limit:res?.stoneLimit||2000},
    {key:'iron',icon:'⚙️',label:'Железо',val:Math.floor(res?.iron||0), rate:res?.ironPerHour||0, limit:res?.ironLimit||1500},
    {key:'food',icon:'🌾',label:'Еда',   val:Math.floor(res?.food||0),  rate:(res?.foodPerHour||0)-(res?.foodConsumption||0), limit:res?.foodLimit||2000},
    {key:'silver',icon:'🪙',label:'Серебро',val:Math.floor(res?.silver||0),rate:res?.silverPerHour||0,limit:res?.silverLimit||1000},
  ];

  return (
    <div style={{maxWidth:'1000px'}}>
      <div style={{background:'var(--ink)',border:'1px solid rgba(184,146,42,0.3)',borderRadius:'4px',padding:'18px 22px',marginBottom:'20px',display:'flex',alignItems:'center',gap:'16px'}}>
        <span style={{fontSize:'36px'}}>🏰</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:'Cinzel,serif',fontSize:'18px',color:'#fff'}}>{settlement.name}</div>
          <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginTop:'3px'}}>Уровень {settlement.level} · {settlement.biome} · {settlement.x}|{settlement.y}</div>
        </div>
        <div style={{display:'flex',gap:'20px'}}>
          {[{l:'ЛОЯЛЬНОСТЬ',v:settlement.loyalty,c:'#4CAF7D'},{l:'МОРАЛЬ',v:settlement.morale,c:'var(--gold)'},{l:'СЧАСТЬЕ',v:settlement.happiness,c:'#4A90A4'}].map(s=>(
            <div key={s.l} style={{textAlign:'center'}}>
              <div style={{fontFamily:'Cinzel,serif',fontSize:'20px',color:s.c}}>{s.v}%</div>
              <div style={{fontFamily:'Cinzel,serif',fontSize:'9px',color:'rgba(255,255,255,0.3)',letterSpacing:'1px'}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'flex',gap:'4px',marginBottom:'16px'}}>
        {[{k:'overview',l:'Обзор'},{k:'buildings',l:`Здания`},{k:'resources',l:'Ресурсы'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} style={{padding:'7px 16px',fontFamily:'Cinzel,serif',fontSize:'10px',letterSpacing:'1px',background:tab===t.k?'var(--ink)':'transparent',color:tab===t.k?'var(--gold-light)':'var(--ink-muted)',border:'1px solid var(--border)',borderRadius:'3px',cursor:'pointer'}}>{t.l}</button>
        ))}
      </div>

      {tab==='overview' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
          <div className="card-base" style={{padding:'16px'}}>
            <div style={{fontFamily:'Cinzel,serif',fontSize:'9px',letterSpacing:'2px',color:'var(--ink-muted)',marginBottom:'12px'}}>СОСТОЯНИЕ</div>
            {[{label:'Лояльность',val:settlement.loyalty,color:'#4CAF7D'},{label:'Мораль',val:settlement.morale,color:'var(--gold)'},{label:'Счастье',val:settlement.happiness,color:'#4A90A4'}].map(s=>(
              <div key={s.label} style={{marginBottom:'10px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                  <span style={{fontSize:'13px',color:'var(--ink)'}}>{s.label}</span>
                  <span style={{fontFamily:'Cinzel,serif',fontSize:'12px',color:s.color}}>{s.val}%</span>
                </div>
                <div style={{height:'5px',background:'var(--sand-3)',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{height:'100%',background:s.color,borderRadius:'3px',width:`${s.val}%`}} />
                </div>
              </div>
            ))}
            <div style={{borderTop:'1px solid var(--border)',paddingTop:'10px',marginTop:'4px'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px'}}>
                <span style={{color:'var(--ink)'}}>Население</span>
                <span style={{fontFamily:'Cinzel,serif'}}>{settlement.population}/{settlement.population_limit}</span>
              </div>
            </div>
          </div>
          <div className="card-base" style={{padding:'16px'}}>
            <div style={{fontFamily:'Cinzel,serif',fontSize:'9px',letterSpacing:'2px',color:'var(--ink-muted)',marginBottom:'12px'}}>АРМИЯ</div>
            {!settlement.units?.filter((u:any)=>u.quantity>0).length
              ? <div style={{color:'var(--ink-muted)',fontSize:'13px',textAlign:'center',padding:'16px 0'}}>Нет войск</div>
              : settlement.units?.filter((u:any)=>u.quantity>0).map((u:any)=>(
                  <div key={u.unit_type} style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:'13px',flex:1,color:'var(--ink)'}}>{u.unit_type.replace(/_/g,' ')}</span>
                    <span style={{fontFamily:'Cinzel,serif',fontSize:'12px'}}>{u.quantity.toLocaleString()}</span>
                  </div>
              ))
            }
          </div>
        </div>
      )}

      {tab==='buildings' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:'10px'}}>
          {settlement.buildings?.map((b:any)=>(
            <div key={b.building_type} className="card-base" style={{padding:'12px',opacity:b.level===0?0.5:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                <span style={{fontSize:'22px'}}>{BICONS[b.building_type]||'🏛'}</span>
                <div>
                  <div style={{fontFamily:'Cinzel,serif',fontSize:'11px',color:'var(--ink)'}}>{BNAMES[b.building_type]||b.building_type}</div>
                  <div style={{fontSize:'11px',color:'var(--ink-muted)',marginTop:'1px'}}>{b.level===0?'Не построено':`Ур. ${b.level}`}</div>
                </div>
              </div>
              <div style={{display:'flex',gap:'2px'}}>
                {Array.from({length:Math.min(b.level,10)}).map((_,i)=><div key={i} style={{flex:1,height:'3px',background:'var(--gold)',borderRadius:'1px'}} />)}
                {Array.from({length:Math.max(0,10-b.level)}).map((_,i)=><div key={i} style={{flex:1,height:'3px',background:'var(--sand-3)',borderRadius:'1px'}} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='resources' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px'}}>
          {resources.map(r=>(
            <div key={r.key} className="card-base" style={{padding:'16px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                <span style={{fontSize:'28px'}}>{r.icon}</span>
                <div>
                  <div style={{fontFamily:'Cinzel,serif',fontSize:'12px',color:'var(--ink-muted)'}}>{r.label}</div>
                  <div style={{fontFamily:'Cinzel,serif',fontSize:'20px',color:'var(--ink)'}}>{r.val.toLocaleString()}</div>
                </div>
              </div>
              <div style={{height:'5px',background:'var(--sand-3)',borderRadius:'3px',overflow:'hidden',marginBottom:'6px'}}>
                <div style={{height:'100%',background:r.val/r.limit>0.9?'var(--crimson)':'var(--gold)',borderRadius:'3px',width:`${Math.min(100,Math.round(r.val/r.limit*100))}%`}} />
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px'}}>
                <span style={{color:r.rate>=0?'#4CAF7D':'var(--crimson)',fontFamily:'Cinzel,serif'}}>{r.rate>=0?'+':''}{Math.round(r.rate)}/ч</span>
                <span style={{color:'var(--ink-muted)'}}>/{r.limit.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
