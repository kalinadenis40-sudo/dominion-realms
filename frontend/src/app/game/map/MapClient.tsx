'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useDashboardStore } from '@/store/dashboard.store';

const TILE_SIZE = 36;
const BIOME_COLORS: Record<string,string> = {
  plains:'#EAE0C4', forest:'#C8D8A4', mountains:'#C4B8A8',
  swamp:'#B8C8A0', wasteland:'#D4C4A0', tundra:'#D8E4EC',
};
const RELATION_COLORS: Record<string,string> = {
  own:'#B8922A', allied:'#1A5C4A', neutral:'#888', enemy:'#8B2020',
};

export default function MapClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const { data: dashData } = useDashboardStore();

  const [settlements, setSettlements] = useState<any[]>([]);
  const [movements,   setMovements]   = useState<any[]>([]);
  const [vp, setVp]  = useState({ x:200, y:200, zoom:1.0 });
  const [drag, setDrag] = useState({ active:false, sx:0, sy:0 });
  const [selected, setSelected] = useState<any>(null);
  const [hovered,  setHovered]  = useState<any>(null);
  const [searchQ,  setSearchQ]  = useState('');
  const [searchRes,setSearchRes]= useState<any[]>([]);
  const [jumpX,setJumpX] = useState('');
  const [jumpY,setJumpY] = useState('');
  const [sendArmyTarget, setSendArmyTarget] = useState<any>(null);
  const [worldId, setWorldId] = useState('');

  // Load world id
  useEffect(() => {
    apiClient.get('/worlds').then((w: any) => { if (w[0]) setWorldId(w[0].id); }).catch(()=>{});
  }, []);

  // Load data when viewport changes
  useEffect(() => {
    if (!worldId) return;
    const id = setTimeout(loadViewport, 200);
    return () => clearTimeout(id);
  }, [vp, worldId]);

  // Refresh every 15s
  useEffect(() => {
    if (!worldId) return;
    const iv = setInterval(loadViewport, 15000);
    return () => clearInterval(iv);
  }, [vp, worldId]);

  const loadViewport = useCallback(async () => {
    if (!worldId) return;
    const ts  = TILE_SIZE * vp.zoom;
    const cw  = canvasRef.current?.width  || 900;
    const ch  = canvasRef.current?.height || 650;
    const pad = 20;
    const x1 = Math.floor(vp.x - cw / ts / 2) - pad;
    const y1 = Math.floor(vp.y - ch / ts / 2) - pad;
    const x2 = Math.ceil (vp.x + cw / ts / 2) + pad;
    const y2 = Math.ceil (vp.y + ch / ts / 2) + pad;
    try {
      const res: any = await apiClient.get(`/map/viewport?worldId=${worldId}&x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}`);
      setSettlements(res.settlements || []);
      setMovements(res.movements || []);
    } catch(_) {}
  }, [vp, worldId]);

  // ── DRAW LOOP ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    cancelAnimationFrame(animRef.current);

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      const ts = TILE_SIZE * vp.zoom;

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#EAE0C4';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(90,70,40,0.12)';
      ctx.lineWidth   = 0.5;
      const gx0 = Math.floor(vp.x - W / ts / 2);
      const gy0 = Math.floor(vp.y - H / ts / 2);
      for (let gx = gx0; gx < gx0 + W/ts + 2; gx++) {
        const sx = (gx - vp.x) * ts + W/2;
        ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx,H); ctx.stroke();
      }
      for (let gy = gy0; gy < gy0 + H/ts + 2; gy++) {
        const sy = (gy - vp.y) * ts + H/2;
        ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(W,sy); ctx.stroke();
      }

      // Movements (animated dots)
      const now = Date.now();
      movements.forEach(mv => {
        const ox = (mv.ox - vp.x)*ts + W/2;
        const oy = (mv.oy - vp.y)*ts + H/2;
        const tx = (mv.tx - vp.x)*ts + W/2;
        const ty = (mv.ty - vp.y)*ts + H/2;
        const color = mv.type === 'attack' ? 'rgba(139,32,32,0.6)' : 'rgba(26,92,74,0.6)';

        // Dashed line
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(tx,ty); ctx.stroke();
        ctx.setLineDash([]);

        // Animated marker
        const total = mv.seconds_remaining > 0 ? mv.seconds_remaining : 1;
        const elapsed = (now / 1000) % total;
        const progress = Math.min(0.98, 1 - elapsed / total);
        const mx = ox + (tx - ox) * progress;
        const my = oy + (ty - oy) * progress;
        const angle = Math.atan2(ty - oy, tx - ox);

        ctx.fillStyle = color.replace('0.6','0.9');
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(angle)*7, my + Math.sin(angle)*7);
        ctx.lineTo(mx + Math.cos(angle+2.5)*4, my + Math.sin(angle+2.5)*4);
        ctx.lineTo(mx + Math.cos(angle-2.5)*4, my + Math.sin(angle-2.5)*4);
        ctx.closePath(); ctx.fill();
      });

      // Settlements
      settlements.forEach(s => {
        const sx = (s.x - vp.x)*ts + W/2;
        const sy = (s.y - vp.y)*ts + H/2;

        // Biome tile
        ctx.fillStyle = (BIOME_COLORS as any)[s.biome] || BIOME_COLORS.plains;
        ctx.fillRect(sx - ts/2, sy - ts/2, ts, ts);

        const rc   = (RELATION_COLORS as any)[s.relation] || '#888';
        const isSel = selected?.id === s.id;
        const isHov = hovered?.id === s.id;
        const r     = ts * 0.28 * (isSel ? 1.35 : isHov ? 1.18 : 1);

        // Glow for own/selected
        if (isSel || s.relation === 'own') {
          ctx.shadowColor = rc; ctx.shadowBlur = isSel ? 14 : 7;
        }

        ctx.fillStyle = rc;
        ctx.beginPath();
        ctx.roundRect(sx-r, sy-r, r*2, r*2, 3);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Icon
        ctx.font      = `${Math.round(ts*0.38)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.has_newbie_shield ? '🛡' : '🏰', sx, sy);

        // Label (zoom ≥ 0.8)
        if (vp.zoom >= 0.75) {
          ctx.font      = `${Math.round(9.5*vp.zoom)}px Cinzel, serif`;
          ctx.fillStyle = '#1C1712';
          ctx.textBaseline = 'top';
          const label = s.name.length > 10 ? s.name.slice(0,10)+'…' : s.name;
          ctx.fillText(label, sx, sy + r + 2);
        }
      });

      // Coord HUD
      ctx.fillStyle    = 'rgba(28,23,18,0.55)';
      ctx.font         = '11px Cinzel, serif';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${Math.round(vp.x)} | ${Math.round(vp.y)}  ×${vp.zoom.toFixed(1)}`, 8, 8);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [settlements, movements, vp, selected, hovered]);

  // ── INPUT ──────────────────────────────────────────────────────
  const worldCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const ts = TILE_SIZE * vp.zoom;
    return {
      wx: Math.round((e.clientX - r.left - c.width/2)  / ts + vp.x),
      wy: Math.round((e.clientY - r.top  - c.height/2) / ts + vp.y),
    };
  };

  const nearestSettlement = (wx: number, wy: number) =>
    settlements.find(s => Math.abs(s.x-wx) < 1.5 && Math.abs(s.y-wy) < 1.5);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDrag({ active:true, sx:e.clientX, sy:e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drag.active) {
      const ts = TILE_SIZE * vp.zoom;
      setVp(v => ({ ...v, x: v.x - (e.clientX-drag.sx)/ts, y: v.y - (e.clientY-drag.sy)/ts }));
      setDrag(d => ({ ...d, sx:e.clientX, sy:e.clientY }));
    } else {
      const {wx,wy} = worldCoords(e);
      setHovered(nearestSettlement(wx,wy) || null);
    }
  };

  const handleMouseUp   = () => setDrag(d => ({ ...d, active:false }));
  const handleMouseLeave= () => { setDrag(d => ({...d,active:false})); setHovered(null); };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const {wx,wy} = worldCoords(e);
    setSelected(nearestSettlement(wx,wy) || null);
    setSendArmyTarget(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setVp(v => ({ ...v, zoom: Math.max(0.3, Math.min(2.8, v.zoom * (e.deltaY>0 ? 0.85 : 1.18))) }));
  };

  const goHome = () => {
    const s = dashData?.settlement;
    if (s) setVp(v => ({ ...v, x:s.x, y:s.y }));
  };

  const handleSearch = async () => {
    if (!searchQ.trim() || !worldId) return;
    try {
      const r: any = await apiClient.get(`/map/search?worldId=${worldId}&q=${encodeURIComponent(searchQ)}`);
      setSearchRes(r || []);
    } catch(_) {}
  };

  const jumpTo = (x: number, y: number) => setVp(v => ({ ...v, x, y }));

  return (
    <div style={{ display:'flex', height:'calc(100vh - 90px)', gap:'12px', overflow:'hidden' }}>

      {/* Canvas */}
      <div style={{ flex:1, position:'relative', borderRadius:'4px', overflow:'hidden', border:'1px solid var(--border)' }}>
        <canvas ref={canvasRef} width={900} height={640}
          style={{ display:'block', width:'100%', height:'100%', cursor: drag.active ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave} onMouseMove={handleMouseMove}
          onClick={handleClick} onWheel={handleWheel}
        />

        {/* Zoom controls */}
        <div style={{ position:'absolute', bottom:'12px', right:'12px', display:'flex', flexDirection:'column', gap:'4px' }}>
          {[
            { icon:'+',  fn:()=>setVp(v=>({...v,zoom:Math.min(2.8,v.zoom*1.2)})) },
            { icon:'⌂',  fn:goHome },
            { icon:'−',  fn:()=>setVp(v=>({...v,zoom:Math.max(0.3,v.zoom*0.83)})) },
          ].map(b => (
            <button key={b.icon} onClick={b.fn} style={{
              width:'30px', height:'30px', background:'rgba(28,23,18,0.85)',
              border:'1px solid rgba(184,146,42,0.4)', borderRadius:'3px',
              color:'var(--gold-light)', fontFamily:'Cinzel,serif', fontSize:'15px',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            }}>{b.icon}</button>
          ))}
        </div>

        {/* Hover tooltip */}
        {hovered && !drag.active && (
          <div style={{ position:'absolute', top:'12px', left:'50%', transform:'translateX(-50%)', background:'rgba(28,23,18,0.9)', border:'1px solid rgba(184,146,42,0.4)', borderRadius:'3px', padding:'6px 14px', pointerEvents:'none', whiteSpace:'nowrap' }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'12px', color:'var(--gold-light)' }}>{hovered.name}</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', marginTop:'2px' }}>
              {hovered.owner_name || 'Нейтральное'} · {hovered.x}|{hovered.y} · Ур.{hovered.level}
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ width:'240px', display:'flex', flexDirection:'column', gap:'12px', overflowY:'auto' }}>

        {/* Search + jump */}
        <div className="card-base" style={{ padding:'12px' }}>
          <div style={{ fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'2px', color:'var(--ink-muted)', marginBottom:'8px' }}>ПОИСК</div>
          <div style={{ display:'flex', gap:'4px', marginBottom:'8px' }}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()}
              placeholder="Игрок или поселение"
              style={{ flex:1, padding:'6px 8px', border:'1px solid var(--border)', borderRadius:'3px', fontSize:'12px', outline:'none' }} />
            <button onClick={handleSearch} style={{ padding:'6px 8px', background:'var(--ink)', color:'var(--gold-light)', border:'none', borderRadius:'3px', cursor:'pointer', fontSize:'12px' }}>🔍</button>
          </div>
          {searchRes.map(r => (
            <div key={r.id} onClick={()=>{ jumpTo(r.x,r.y); setSearchRes([]); setSearchQ(''); }} style={{ padding:'6px 8px', cursor:'pointer', borderRadius:'3px', fontSize:'12px', color:'var(--ink)', background:'var(--sand)', marginBottom:'3px' }}>
              <div style={{ fontWeight:500 }}>{r.name}</div>
              <div style={{ fontSize:'10px', color:'var(--ink-muted)' }}>{r.owner_name} · {r.x}|{r.y}</div>
            </div>
          ))}
          <div style={{ display:'flex', gap:'4px', marginTop:'8px' }}>
            <input value={jumpX} onChange={e=>setJumpX(e.target.value)} placeholder="X" style={{ width:'50px', padding:'5px', border:'1px solid var(--border)', borderRadius:'3px', fontSize:'12px', outline:'none', textAlign:'center' }} />
            <input value={jumpY} onChange={e=>setJumpY(e.target.value)} placeholder="Y" style={{ width:'50px', padding:'5px', border:'1px solid var(--border)', borderRadius:'3px', fontSize:'12px', outline:'none', textAlign:'center' }} />
            <button onClick={()=>{ const x=parseInt(jumpX),y=parseInt(jumpY); if(!isNaN(x)&&!isNaN(y)) jumpTo(x,y); }} style={{ flex:1, padding:'5px', background:'var(--ink)', color:'var(--gold-light)', border:'none', borderRadius:'3px', cursor:'pointer', fontSize:'10px', fontFamily:'Cinzel,serif' }}>GO</button>
          </div>
        </div>

        {/* Legend */}
        <div className="card-base" style={{ padding:'10px 12px' }}>
          <div style={{ fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'2px', color:'var(--ink-muted)', marginBottom:'8px' }}>ЛЕГЕНДА</div>
          {[['#B8922A','Ваше'],['#1A5C4A','Союзник'],['#888','Нейтральное'],['#8B2020','Враг']].map(([c,l])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px' }}>
              <div style={{ width:'12px', height:'12px', background:c, borderRadius:'2px', flexShrink:0 }} />
              <span style={{ fontSize:'12px', color:'var(--ink)' }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Selected card */}
        {selected && (
          <div className="card-base" style={{ padding:'12px' }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'2px', color:'var(--ink-muted)', marginBottom:'8px' }}>ВЫБРАНО</div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
              <span style={{ fontSize:'22px' }}>🏰</span>
              <div>
                <div style={{ fontFamily:'Cinzel,serif', fontSize:'13px', color:'var(--ink)' }}>{selected.name}</div>
                <div style={{ fontSize:'11px', color:'var(--ink-muted)', marginTop:'1px' }}>{selected.owner_name || 'Нейтральное'} · Ур.{selected.level}</div>
              </div>
            </div>
            <div style={{ fontSize:'12px', color:'var(--ink-muted)', marginBottom:'10px' }}>📍 {selected.x}|{selected.y} · {selected.biome}</div>

            {selected.relation !== 'own' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                <button onClick={()=>setSendArmyTarget(selected)} style={{ padding:'7px', background:'var(--crimson)', color:'#fff', border:'none', borderRadius:'3px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px', cursor:'pointer' }}>⚔ АТАКОВАТЬ</button>
                <button onClick={()=>setSendArmyTarget({...selected, defaultType:'scout'})} style={{ padding:'7px', background:'transparent', color:'var(--navy)', border:'1px solid var(--navy-light)', borderRadius:'3px', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px', cursor:'pointer' }}>🔍 РАЗВЕДКА</button>
              </div>
            ) : (
              <div style={{ fontSize:'12px', color:'var(--ink-muted)', fontStyle:'italic' }}>Это ваше поселение</div>
            )}
          </div>
        )}

        {/* Movements */}
        {movements.length > 0 && (
          <div className="card-base" style={{ padding:'10px 12px' }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'9px', letterSpacing:'2px', color:'var(--ink-muted)', marginBottom:'8px' }}>ДВИЖЕНИЯ ({movements.length})</div>
            {movements.slice(0,6).map(mv=>(
              <div key={mv.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:'12px' }}>{mv.type==='attack'?'⚔':'🛡'}</span>
                <span style={{ flex:1, fontSize:'11px', color:'var(--ink)' }}>{mv.ox}|{mv.oy}→{mv.tx}|{mv.ty}</span>
                <span style={{ fontFamily:'Cinzel,serif', fontSize:'10px', color:'var(--gold)', flexShrink:0 }}>
                  {mv.seconds_remaining>0?`${Math.floor(mv.seconds_remaining/60)}м`:'...'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send army modal */}
      {sendArmyTarget && (
        <SendArmyModal
          target={sendArmyTarget}
          mySettlement={dashData?.settlement}
          onClose={()=>setSendArmyTarget(null)}
        />
      )}
    </div>
  );
}

function SendArmyModal({ target, mySettlement, onClose }: any) {
  const [type,    setType]    = useState<string>(target.defaultType || 'attack');
  const [units,   setUnits]   = useState<Record<string,string>>({});
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const unitList = [
    { key:'spearman',     icon:'🗡️', label:'Копейщики' },
    { key:'swordsman',    icon:'⚔️', label:'Мечники' },
    { key:'archer',       icon:'🏹', label:'Лучники' },
    { key:'light_cavalry',icon:'🐴', label:'Кавалерия' },
    { key:'scout',        icon:'🔍', label:'Разведчики' },
    { key:'catapult',     icon:'💣', label:'Катапульты' },
    { key:'lord',         icon:'👑', label:'Наместник' },
  ];

  const handleSend = async () => {
    const unitMap: Record<string,number> = {};
    for (const [k,v] of Object.entries(units)) { const n=parseInt(v); if(n>0) unitMap[k]=n; }
    if (!Object.keys(unitMap).length) { setError('Нет войск'); return; }
    setSending(true); setError('');
    try {
      const endpoint = type==='scout' ? '/scouting/send' : '/movements/send';
      const body     = type==='scout'
        ? { originSettlementId:mySettlement.id, targetSettlementId:target.id, scoutCount:unitMap.scout||1 }
        : { originSettlementId:mySettlement.id, targetSettlementId:target.id, type, units:unitMap };
      await apiClient.post(endpoint, body);
      setSuccess('✓ Отправлено!');
      setTimeout(onClose, 1200);
    } catch(err:any) {
      setError(err?.response?.data?.message || 'Ошибка');
    } finally { setSending(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(28,23,18,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff', borderRadius:'4px', border:'1px solid var(--border)', padding:'20px', width:'360px', maxHeight:'80vh', overflowY:'auto' }}>
        <div style={{ fontFamily:'Cinzel,serif', fontSize:'13px', color:'var(--ink)', marginBottom:'4px' }}>Отправить армию</div>
        <div style={{ fontSize:'12px', color:'var(--ink-muted)', marginBottom:'14px' }}>→ {target.name} ({target.x}|{target.y})</div>

        <div style={{ display:'flex', gap:'6px', marginBottom:'14px' }}>
          {[{k:'attack',l:'⚔ Атака',c:'var(--crimson)'},{k:'scout',l:'🔍 Разведка',c:'var(--navy)'},{k:'support',l:'🛡 Поддержка',c:'var(--teal-game)'}].map(t=>(
            <button key={t.k} onClick={()=>setType(t.k)} style={{ flex:1, padding:'6px', border:`1px solid ${type===t.k?t.c:'var(--border)'}`, borderRadius:'3px', background:type===t.k?t.c+'15':'#fff', fontFamily:'Cinzel,serif', fontSize:'9px', cursor:'pointer', color:type===t.k?t.c:'var(--ink-muted)' }}>{t.l}</button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'7px', marginBottom:'14px' }}>
          {unitList.map(u=>(
            <div key={u.key} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'15px', width:'20px', textAlign:'center' }}>{u.icon}</span>
              <span style={{ flex:1, fontSize:'12px', color:'var(--ink)' }}>{u.label}</span>
              <input type="number" min="0" placeholder="0" value={units[u.key]||''}
                onChange={e=>setUnits({...units,[u.key]:e.target.value})}
                style={{ width:'65px', padding:'5px 7px', border:'1px solid var(--border)', borderRadius:'3px', fontSize:'12px', textAlign:'right', outline:'none' }} />
            </div>
          ))}
        </div>

        {error   && <div style={{ color:'var(--crimson)',    fontSize:'12px', marginBottom:'10px' }}>{error}</div>}
        {success && <div style={{ color:'var(--teal-game)', fontSize:'12px', marginBottom:'10px' }}>{success}</div>}

        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'9px', border:'1px solid var(--border)', borderRadius:'3px', background:'#fff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:'10px', color:'var(--ink-muted)' }}>ОТМЕНА</button>
          <button onClick={handleSend} disabled={sending} style={{ flex:2, padding:'9px', background:'var(--ink)', color:'var(--gold-light)', border:'none', borderRadius:'3px', cursor:sending?'not-allowed':'pointer', fontFamily:'Cinzel,serif', fontSize:'10px', letterSpacing:'1px' }}>{sending?'...':'ОТПРАВИТЬ'}</button>
        </div>
      </div>
    </div>
  );
}
