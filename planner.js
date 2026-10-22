(()=>{
  'use strict';
  const STORE='pitkovice-planner-v1';
  const NS='http://www.w3.org/2000/svg';
  const fmt=n=>Number(n).toLocaleString('cs-CZ',{maximumFractionDigits:1});
  const pointIn=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
  const orient=(a,b,c)=>Math.sign((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  const onSeg=(a,b,p)=>Math.min(a[0],b[0])-1e-7<=p[0]&&p[0]<=Math.max(a[0],b[0])+1e-7&&Math.min(a[1],b[1])-1e-7<=p[1]&&p[1]<=Math.max(a[1],b[1])+1e-7;
  const cross=(a,b,c,d)=>{const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);return(o1*o2<0&&o3*o4<0)||(o1===0&&onSeg(a,b,c))||(o2===0&&onSeg(a,b,d))||(o3===0&&onSeg(c,d,a))||(o4===0&&onSeg(c,d,b));};
  const edges=poly=>poly.map((p,i)=>[p,poly[(i+1)%poly.length]]);
  const intersection=(a,b)=>edges(a).some(([p,q])=>edges(b).some(([r,s])=>cross(p,q,r,s)));
  const area=pts=>Math.abs(pts.reduce((n,p,i)=>n+p[0]*pts[(i+1)%pts.length][1]-pts[(i+1)%pts.length][0]*p[1],0)/2);
  const normalizeAngle=n=>((Number(n)+180)%360+360)%360-180;
  const clampSize=n=>Math.max(.5,Math.min(1.8,Number.isFinite(Number(n))?Number(n):1));
  const dimensions=(model,item)=>{const k=clampSize(item?.size??1);return{width:model.width*k,depth:model.depth*k,area:model.area*k*k};};
  const worldPoints=(model,item,scale)=>{const a=item.angle*Math.PI/180,k=clampSize(item.size??1);return model.points.map(([x,y])=>[item.x+k*(x*Math.cos(a)-y*Math.sin(a))/scale,item.y+k*(x*Math.sin(a)+y*Math.cos(a))/scale]);};
  const polygonInside=(poly,boundary)=>poly.every(p=>pointIn(p,boundary))&&!intersection(poly,boundary);
  const polygonsOverlap=(a,b)=>intersection(a,b)||pointIn(a[0],b)||pointIn(b[0],a);
  const moveByMeters=(item,dx,dy,scale)=>({x:item.x+dx/scale,y:item.y+dy/scale});
  const readSaved=(raw,validIds)=>{try{const s=JSON.parse(raw||'null');if(s?.version!==1||!Array.isArray(s.items))return null;return{items:s.items.filter(x=>validIds.has(x.modelId)&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.angle)).slice(0,8).map(x=>({...x,size:clampSize(x.size??1)})),selected:s.items.some(x=>x.uid===s.selected)?s.selected:null};}catch{return null;}};
  const core={clampSize,dimensions,pointIn,intersection,area,normalizeAngle,worldPoints,polygonInside,polygonsOverlap,moveByMeters,readSaved};
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  if(typeof globalThis!=='undefined')globalThis.PitkovicePlannerCore=core;
  function init(root){
    const url=root.dataset.dataUrl||'assets/planner-data-v8.json';
    fetch(url).then(r=>{if(!r.ok)throw Error('Podklady plánu nejsou dostupné.');return r.json();}).then(data=>{mount(root,data);root.setAttribute('aria-busy','false');}).catch(()=>{root.innerHTML='<p class="planner-load-error" role="status">Editor se nepodařilo načíst. Zkontrolujte cestu k podkladům plánu.</p>';});
  }
  function mount(root,data){
    const q=s=>root.querySelector(s), svg=q('[data-canvas]'), scale=Number(data.scale)||.2083333333;
    const build=data.layers.find(x=>x.id==='build-area')?.points||[];
    const models=new Map(data.models.map(x=>[x.id,x]));
    const palette={'parcel-1970-4':'#9d8059','parcel-195':'#557483','parcel-198':'#55754a','parcel-197':'#946d7b'};
    data.layers.forEach(l=>{if(palette[l.id])l.color=palette[l.id];});
    const state={items:[],selected:null,view:[0,0,900,900],drag:null,fitTarget:'all',background:'plan',opacity:.9,orthoUri:null};
    let saved=null;try{saved=readSaved(localStorage.getItem(STORE),new Set(models.keys()));}catch{}
    if(saved){state.items=saved.items;state.selected=state.items.some(x=>x.uid===saved.selected)?saved.selected:state.items[0]?.uid||null;}
    else setDefault();
    const selected=()=>state.items.find(x=>x.uid===state.selected), model=i=>models.get(i.modelId);
    const el=(name,attrs={},parent=svg)=>{const n=document.createElementNS(NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;};
    const rectOf=pts=>{const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};
    function setDefault(){const m=models.get('B1');state.items=[{uid:'house-'+Date.now().toString(36),modelId:m.id,x:m.center[0],y:m.center[1],angle:normalizeAngle(m.angle),size:1}];state.selected=state.items[0].uid;}
    const fit=pts=>{if(!pts.length)return;const [x1,y1,x2,y2]=rectOf(pts),pad=Math.max(x2-x1,y2-y1)*.08+15;let w=x2-x1+2*pad,h=y2-y1+2*pad;const rect=svg.getBoundingClientRect(),ratio=rect.width&&rect.height?rect.width/rect.height:4/3;if(w/h>ratio)h=w/ratio;else w=h*ratio;state.view=[(x1+x2-w)/2,(y1+y2-h)/2,w,h];svg.setAttribute('viewBox',state.view.join(' '));};
    const allPts=data.layers.filter(l=>l.id!=='build-area').flatMap(l=>l.points);
    const worldPts=i=>worldPoints(model(i),i,scale);
    const inside=i=>polygonInside(worldPts(i),build);
    const overlaps=(i,j)=>polygonsOverlap(worldPts(i),worldPts(j));
    function save(){try{localStorage.setItem(STORE,JSON.stringify({version:1,items:state.items,selected:state.selected}));}catch{}}
    function status(i){if(!i)return['Přidejte dům z katalogu',''];if(!inside(i))return['Přesahuje pracovní plochu','is-out'];if(state.items.some(o=>o.uid!==i.uid&&overlaps(i,o)))return['Překryv s jiným půdorysem','is-overlap'];return['Uvnitř pracovní plochy','is-inside'];}
    let baseKey='';
    function render(){
      const focused=svg.contains(document.activeElement),focusedUid=document.activeElement?.getAttribute?.('data-uid');
      const nextKey=state.background+Boolean(state.orthoUri);
      svg.setAttribute('viewBox',state.view.join(' '));
      svg.querySelectorAll('.planner-house').forEach(n=>n.remove());
      if(baseKey!==nextKey){
      baseKey=nextKey;svg.replaceChildren();
      el('rect',{x:-5000,y:-5000,width:10000,height:10000,fill:'#e9ede7',style:'fill:#e9ede7'});
      if(state.background==='ortho'&&state.orthoUri){el('image',{href:state.orthoUri,width:data.ortho.width,height:data.ortho.height,transform:'matrix('+data.ortho.matrix.join(' ')+')',opacity:state.opacity,'aria-hidden':'true'});}
      q('[data-action="background-plan"]').setAttribute('aria-pressed',state.background==='plan');q('[data-action="background-ortho"]').setAttribute('aria-pressed',state.background==='ortho');q('[data-ortho-controls]').hidden=state.background!=='ortho';q('[data-ortho-note]').hidden=state.background!=='ortho';
      // The supplied orthophoto already contains the matching parcel boundaries.
      // Draw schematic boundaries only in plan mode, never duplicate them over the raster.
      if(!(state.background==='ortho'&&state.orthoUri&&data.ortho.annotated)){
      for(const l of data.layers){if(['access-200','corridor-lbc','meadow','build-area'].includes(l.id))continue;if(state.background==='ortho')el('polygon',{points:l.points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#f7f5e8','stroke-width':4,'vector-effect':'non-scaling-stroke',style:'fill:none;stroke:#f7f5e8;stroke-width:4;vector-effect:non-scaling-stroke'});el('polygon',{points:l.points.map(p=>p.join(',')).join(' '),fill:l.color, 'fill-opacity':'.07',stroke:l.color,'stroke-width':2,class:'planner-plan-poly',style:`fill:${l.color};fill-opacity:.07;stroke:${l.color};stroke-width:2;vector-effect:non-scaling-stroke`});}
      for(const id of ['meadow','corridor-lbc']){const l=data.layers.find(x=>x.id===id);if(l){const color=id==='meadow'?'#9a9b6f':'#ae5ddc';el('polygon',{points:l.points.map(p=>p.join(',')).join(' '),fill:color,'fill-opacity':'.16',stroke:'none',style:`fill:${color};fill-opacity:.16;stroke:none`});}}
      const b=data.layers.find(x=>x.id==='build-area');if(b){el('polygon',{points:b.points.map(p=>p.join(',')).join(' '),fill:'#a7d33e','fill-opacity':'.17',stroke:'#78875b','stroke-width':2,'stroke-dasharray':'8 5',style:'fill:#a7d33e;fill-opacity:.17;stroke:#78875b;stroke-width:2;stroke-dasharray:8 5'});const [x,y]=[b.points.reduce((n,p)=>n+p[0],0)/b.points.length,b.points.reduce((n,p)=>n+p[1],0)/b.points.length];const t=el('text',{x,y,fill:'#52613e','font-size':13,'font-family':'sans-serif','font-weight':700,'text-anchor':'middle',style:'fill:#52613e;font-size:13px;font-family:sans-serif;font-weight:700;text-anchor:middle'});t.textContent='STAVEBNÍ ČÁST';t.setAttribute('style','fill:#385037;font-size:11px;font-family:sans-serif;font-weight:600;text-anchor:middle;paint-order:stroke;stroke:#f3f5e7;stroke-width:3px;stroke-linejoin:round');}
      const road=data.layers.find(x=>x.id==='access-200');if(road){el('polygon',{points:road.points.map(p=>p.join(',')).join(' '),fill:'#dbc18f','fill-opacity':'.68',stroke:'#a68550','stroke-width':1.5,style:'fill:#dbc18f;fill-opacity:.68;stroke:#a68550;stroke-width:1.5'});const [x,y]=[road.points.reduce((n,p)=>n+p[0],0)/road.points.length,road.points.reduce((n,p)=>n+p[1],0)/road.points.length];const t=el('text',{x,y,fill:'#705b38','font-size':10,'font-family':'sans-serif','font-weight':700,'text-anchor':'middle',style:'fill:#705b38;font-size:10px;font-family:sans-serif;font-weight:700;text-anchor:middle'});t.textContent='Přístup · 200';t.setAttribute('style','fill:#705b38;font-size:10px;font-family:sans-serif;font-weight:600;text-anchor:middle;paint-order:stroke;stroke:#faf8ed;stroke-width:3px');}
      for(const l of data.layers.filter(x=>x.id.startsWith('parcel-'))){const [x,y]=[l.points.reduce((n,p)=>n+p[0],0)/l.points.length,l.points.reduce((n,p)=>n+p[1],0)/l.points.length],t=el('text',{x,y,fill:l.color,'fill-opacity':'.9','font-size':10,'font-family':'sans-serif','font-weight':700,'text-anchor':'middle',style:`fill:${l.color};fill-opacity:.9;font-size:10px;font-family:sans-serif;font-weight:700;text-anchor:middle`});t.textContent=l.label;t.setAttribute('style',`fill:${l.color};font-size:10px;font-family:sans-serif;font-weight:600;text-anchor:middle;paint-order:stroke;stroke:#faf9f2;stroke-width:3px;stroke-linejoin:round`);}
      }
      }
      for(const i of state.items){const m=model(i),g=el('g',{class:'planner-house'+(i.uid===state.selected?' is-selected':''),transform:`translate(${i.x} ${i.y}) rotate(${i.angle}) scale(${clampSize(i.size??1)/scale})`,tabindex:0,role:'button','aria-label':`${m.name}, ${fmt(dimensions(m,i).width)} krát ${fmt(dimensions(m,i).depth)} metrů, ${i.uid===state.selected?'vybraný':'vybrat'}`,'aria-pressed':i.uid===state.selected?'true':'false','data-uid':i.uid});
        const fill=i.uid===state.selected?'#e8d0a7':'#e5dcc7';el('polygon',{points:m.points.map(p=>p.join(',')).join(' '),fill,'fill-opacity':'.92',stroke:'#394237','stroke-width':2,style:`fill:${fill};fill-opacity:.92;stroke:#394237;stroke-width:2;vector-effect:non-scaling-stroke`},g);const label=el('text',{x:0,y:3,class:'planner-house-label',transform:`scale(${scale/clampSize(i.size??1)}) rotate(${-i.angle})`,style:'font:700 12px/1 sans-serif;fill:#293328;text-anchor:middle;pointer-events:none'} ,g);label.textContent=m.id;g.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();state.selected=i.uid;const p=cursor(e);state.drag={uid:i.uid,x:p[0],y:p[1],originX:i.x,originY:i.y};svg.setPointerCapture?.(e.pointerId);render();});g.addEventListener('click',()=>{state.selected=i.uid;render();});g.addEventListener('keydown',e=>{e.stopPropagation();if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const d=moveByMeters(i,e.key==='ArrowLeft'?-0.5:e.key==='ArrowRight'?0.5:0,e.key==='ArrowUp'?-0.5:e.key==='ArrowDown'?0.5:0,scale);i.x=d.x;i.y=d.y;changed();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}else if(e.key==='['||e.key===']'){e.preventDefault();i.angle=normalizeAngle(i.angle+(e.key==='['?-15:15));changed();}});
      }
      updateInspector();
      if(focused){const target=focusedUid&&Array.from(svg.querySelectorAll('[data-uid]')).find(n=>n.getAttribute('data-uid')===focusedUid);(target||svg).focus({preventScroll:true});}
    }
    function updateInspector(){const i=selected(),m=i&&model(i);q('[data-size]').disabled=!i;q('[data-size]').value=String(Math.round(clampSize(i?.size??1)*100));q('[data-size-value]').textContent=i?Math.round(clampSize(i.size??1)*100)+' %':'—';root.querySelectorAll('[data-action="size-minus"],[data-action="size-plus"],[data-action="rotate-minus"],[data-action="rotate-plus"]').forEach(b=>b.disabled=!i);if(m)q('.planner-catalog').value=m.id;q('[data-selected-title]').textContent=m?m.name:'Bez vybraného domu';q('[data-model-meta]').textContent=m?`${m.storeys} ${m.storeys===1?'podlaží':'podlaží'} · výška ${fmt(m.height)} m`:'';q('[data-dimensions]').textContent=m?`${fmt(dimensions(m,i).width)} × ${fmt(dimensions(m,i).depth)} m`:'—';q('[data-area]').textContent=m?fmt(dimensions(m,i).area):'—';q('[data-storeys]').textContent=m?String(m.storeys):'—';q('[data-height]').textContent=m?`${fmt(m.height)} m`:'—';q('[data-angle]').disabled=!i;q('[data-angle]').value=i?String(Math.round(i.angle)):'0';q('[data-angle-value]').textContent=i?`${Math.round(i.angle)}°`:'—';q('[data-action="remove"]').disabled=!i;q('[data-total]').textContent=fmt(state.items.reduce((n,o)=>n+dimensions(model(o),o).area,0));const [s,c]=status(i);q('[data-status]').textContent=s;q('[data-status]').className='planner-status '+c;}
    function changed(){save();render();}
    function remove(){if(!selected())return;state.items=state.items.filter(i=>i.uid!==state.selected);state.selected=state.items.at(-1)?.uid||null;changed();}
    function add(id){if(state.items.length>=8){q('[data-status]').textContent='Maximálně 8 domů v plánu.';return;}const m=models.get(id);if(!m)return;const uid=`${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`;state.items.push({uid,modelId:id,x:m.center[0],y:m.center[1],angle:normalizeAngle(m.angle),size:1});state.selected=uid;changed();}
    for(const m of data.models){const option=document.createElement('option');option.value=m.id;option.textContent=m.id+' · '+m.name;q('.planner-catalog').append(option);}
    root.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;const a=b.dataset.action,i=selected();if(a==='add-selected')add(q('.planner-catalog').value);if(a==='size-minus'&&i){i.size=clampSize(Math.round((clampSize(i.size??1)-.05)*100)/100);changed();}if(a==='size-plus'&&i){i.size=clampSize(Math.round((clampSize(i.size??1)+.05)*100)/100);changed();}if(a==='background-plan'){state.background='plan';fitCurrent();render();}if(a==='background-ortho'){state.background='ortho';loadOrtho();render();}if(a==='fit-all'){state.fitTarget='all';fitCurrent();}if(a==='fit-build'){state.fitTarget='build';fit(build);}if(a==='default'){setDefault();save();state.fitTarget='all';fit(allPts);render();}if(a==='remove')remove();if(a==='clear'){state.items=[];state.selected=null;changed();}if(a==='rotate-minus'&&i){i.angle=normalizeAngle(i.angle-15);changed();}if(a==='rotate-plus'&&i){i.angle=normalizeAngle(i.angle+15);changed();}if(a==='move'&&i){const d=moveByMeters(i,Number(b.dataset.dx||0)*.5,Number(b.dataset.dy||0)*.5,scale);i.x=d.x;i.y=d.y;changed();}if(a==='export-svg')exportSvg();if(a==='export-png')exportPng();});
    q('[data-size]').addEventListener('input',e=>{const i=selected();if(i){i.size=clampSize(Number(e.target.value)/100);changed();}});
    q('[data-opacity]').addEventListener('input',e=>{state.opacity=Number(e.target.value)/100;q('[data-opacity-value]').textContent=e.target.value+' %';svg.querySelector('image')?.setAttribute('opacity',state.opacity);});
    q('[data-angle]').addEventListener('input',e=>{const i=selected();if(i){i.angle=normalizeAngle(Number(e.target.value));save();render();}});
    function cursor(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return[q.x,q.y];}
    let dragFrame=0;
    svg.addEventListener('pointermove',e=>{if(!state.drag)return;const i=state.items.find(o=>o.uid===state.drag.uid);if(!i)return;const p=cursor(e);i.x=state.drag.originX+p[0]-state.drag.x;i.y=state.drag.originY+p[1]-state.drag.y;if(!dragFrame)dragFrame=requestAnimationFrame(()=>{dragFrame=0;render();});});
    const stop=()=>{if(state.drag){if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0;}state.drag=null;save();render();}};svg.addEventListener('pointerup',stop);svg.addEventListener('pointercancel',stop);svg.addEventListener('keydown',e=>{const i=selected();if(!i)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const d=moveByMeters(i,e.key==='ArrowLeft'?-0.5:e.key==='ArrowRight'?0.5:0,e.key==='ArrowUp'?-0.5:e.key==='ArrowDown'?0.5:0,scale);i.x=d.x;i.y=d.y;changed();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}else if(e.key==='['||e.key===']'){e.preventDefault();i.angle=normalizeAngle(i.angle+(e.key==='['?-15:15));changed();}});
    function exportImageSvg(width){const copy=svg.cloneNode(true),v=state.view;copy.removeAttribute('tabindex');copy.removeAttribute('xmlns');copy.setAttribute('width',String(width));copy.setAttribute('height',String(Math.round(width*v[3]/v[2])));copy.querySelectorAll('[tabindex],[role],[aria-label],[aria-pressed],[data-uid]').forEach(n=>['tabindex','role','aria-label','aria-pressed','data-uid'].forEach(a=>n.removeAttribute(a)));copy.querySelectorAll('.planner-house').forEach(g=>g.removeAttribute('class'));copy.querySelectorAll('.planner-house-label').forEach(t=>t.removeAttribute('class'));copy.querySelectorAll('[class]').forEach(n=>n.removeAttribute('class'));const notice=document.createElementNS(NS,'text');notice.setAttribute('x',String(v[0]+10));notice.setAttribute('y',String(v[1]+v[3]-10));notice.setAttribute('style','font:12px sans-serif;fill:#4e5549');notice.textContent='Schematický zákres podle mapového podkladu · není geodetickým zaměřením ani posouzením povolení stavby.';copy.append(notice);return copy;}
    function exportSvg(){const text=new XMLSerializer().serializeToString(exportImageSvg(1200)),blob=new Blob([text],{type:'image/svg+xml;charset=utf-8'});download(blob,'navrh-osazeni.svg');}
    function exportPng(){const copy=exportImageSvg(1600),blob=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=1600;c.height=Math.round(1600*state.view[3]/state.view[2]);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(b=>b&&download(b,'navrh-osazeni.png'),'image/png');};img.onerror=()=>{URL.revokeObjectURL(url);q('[data-status]').textContent='PNG se nepodařilo vytvořit. Zkuste stáhnout SVG.';};img.src=url;}
    function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();q('[data-status]').textContent='Připraveno ke stažení: '+name;setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
    fit(allPts);render();
    const orthoButton=q('[data-action="background-ortho"]');
    let orthoPending=null;
    function fitCurrent(){
      if(state.fitTarget==='build'){fit(build);return;}
      if(state.background==='ortho'&&state.orthoUri){
        // The same reference crop as the source brief, including its legend and scale.
        const box=[65,223,858,648],r=svg.getBoundingClientRect(),ratio=r.width/r.height||4/3;
        let w=box[2],h=box[3];if(w/h>ratio)h=w/ratio;else w=h*ratio;
        state.view=[box[0]+(box[2]-w)/2,box[1]+(box[3]-h)/2,w,h];
        svg.setAttribute('viewBox',state.view.join(' '));
      }else fit(allPts);
    }
    function loadOrtho(){
      if(state.orthoUri){fitCurrent();return;}
      if(orthoPending||!data.ortho)return;
      orthoButton.disabled=true;orthoButton.textContent='Načítám…';
      orthoPending=fetch(data.ortho.src).then(r=>{if(!r.ok)throw Error('Ortofoto nelze načíst');return r.blob();})
      .then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);}))
      .then(uri=>{state.orthoUri=uri;fitCurrent();render();})
      .catch(()=>{state.background='plan';render();q('[data-ortho-note]').hidden=false;q('[data-ortho-note]').textContent='Ortofoto se nepodařilo načíst. Kliknutím na Ortofoto to můžete zkusit znovu.';})
      .finally(()=>{orthoPending=null;orthoButton.disabled=false;orthoButton.textContent='Ortofoto';});
    }
    if(typeof ResizeObserver!=='undefined'){let raf=0;const observer=new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(fitCurrent);});observer.observe(q('.planner-canvas-wrap'));}
  }
  const start=()=>{
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{entries.filter(e=>e.isIntersecting).forEach(e=>{observer.unobserve(e.target);begin(e.target);});},{rootMargin:'300px 0px'});
    function begin(root){if(root.dataset.mounted)return;root.dataset.mounted='true';root.setAttribute('aria-busy','true');init(root);}
    document.querySelectorAll('[data-plot-planner]').forEach(root=>{if(observer){observer.observe(root);root.addEventListener('focusin',()=>begin(root),{once:true});}else begin(root);});
  };
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
})();
