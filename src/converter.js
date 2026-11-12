export const MAX_ITEMS = 5000;
const rgba = (r,g,b,a=1) => ({r,g,b,a});

export function parseStyle(source='') {
  const style={};
  for (const part of source.split(';')) {
    const pos=part.indexOf('=');
    if (pos>=0) style[part.slice(0,pos)]=part.slice(pos+1);
    else if (part && !style.base) style.base=part;
  }
  return style;
}

export function color(value, fallback='#1f1f1f') {
  if (value==='none') return rgba(0,0,0,0);
  const named={white:'#ffffff',black:'#000000',red:'#ff0000',blue:'#0000ff'};
  value=named[value] || value || fallback;
  if (/^#[a-f\d]{3}$/i.test(value)) value='#'+[...value.slice(1)].map(c=>c+c).join('');
  if (!/^#[a-f\d]{6}$/i.test(value)) value=fallback;
  return rgba(parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16));
}

export function shapeItem(x,y,width,height,text='',type=4,options={}) {
  if (![x,y,width,height].every(Number.isFinite) || width<=0 || height<=0) throw new Error('Geometria della forma non valida.');
  const fs=options.fontSize || 20;
  return {
    position:{x:x+width/2,y:y+height/2},scale:1,originPoint:{x,y},size:{width,height},rotation:0,
    content:{contentType:'shape',fillColor:color(options.fill,'#ffffff'),lineColor:color(options.stroke),
      lineStyle:options.dashed?1:0,lineThickness:options.thickness ?? 1,type,text,
      paragraphs:text.split('\n').map(t=>({spans:[{text:[t],spanStyles:[]}],paragraphStyle:'unstyled'})),
      fontSize:fs,textDecoration:[]}
  };
}

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const geometry=c=>c.geometry || {x:0,y:0,width:0,height:0,points:[]};
const shapeKind=c=>c.styleMap.shape || c.styleMap.base || 'rectangle';
const allowed=new Set(['rectangle','rect','rhombus','ellipse','text']);

function labelPosition(points,fraction,normal=0) {
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));
  let target=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,fraction));
  for(let i=0;i<lengths.length;i++) {
    if (target<=lengths[i] || i===lengths.length-1) {
      const a=points[i],b=points[i+1],l=lengths[i]||1,t=Math.min(1,target/l);
      return {x:a.x+(b.x-a.x)*t-normal*(b.y-a.y)/l,y:a.y+(b.y-a.y)*t+normal*(b.x-a.x)/l};
    }
    target-=lengths[i];
  }
  return points[0];
}

export function convert(input, {includeArrows=false, fitFont=null}={}) {
  const cells=input.map(c=>({...c,styleMap:parseStyle(c.style)}));
  const byId=new Map(cells.map(c=>[c.id,c]));
  if (byId.size!==cells.length) throw new Error('Identificativi duplicati.');
  const warnings=new Set(); const backgrounds=[],blocks=[],lineParts=[],labels=[];
  const boxes=new Map(); const routes=new Map(); const skipped=[]; const kept=new Set();
  const counts={forms:0,edges:0,convertedEdges:0,skipped:0,labels:0};
  const itemCount=()=>backgrounds.length+blocks.length+lineParts.length+labels.length;
  const checkLimit=()=>{if(itemCount()>=MAX_ITEMS)throw new Error('Oltre 5000 forme generate. Prova senza frecce o dividi il diagramma.');};

  function box(c,path=new Set()) {
    if(boxes.has(c.id))return boxes.get(c.id);
    if(path.has(c.id) || path.size>100)throw new Error('Gerarchia ciclica o troppo profonda.');
    path=new Set(path);path.add(c.id);
    const g=geometry(c); let x=g.x,y=g.y;
    const parent=byId.get(c.parent);
    if(parent?.vertex) {
      const p=box(parent,path);
      x=p.x+(g.relative?g.x*p.width:g.x); y=p.y+(g.relative?g.y*p.height:g.y);
      if(g.relative && g.offset){x+=g.offset.x;y+=g.offset.y;}
    }
    const result={x,y,width:g.width,height:g.height}; boxes.set(c.id,result);return result;
  }

  function visible(c,path=new Set()) {
    if(c.visible===false || c.styleMap.visible==='0')return false;
    if(path.has(c.id) || path.size>100)throw new Error('Gerarchia ciclica o troppo profonda.');
    path.add(c.id);const parent=byId.get(c.parent);
    return !parent || visible(parent,path);
  }

  for(const c of cells) {
    if(!c.vertex || !visible(c))continue;
    const s=c.styleMap,k=shapeKind(c);
    if(k==='group') {
      if(number(s.rotation,0)!==0)warnings.add('Le rotazioni dei gruppi non vengono applicate.');
      continue;
    }
    if(k==='edgeLabel')continue;
    if(!allowed.has(k) || s.image) {
      skipped.push({id:c.id,kind:k,text:c.text||''});counts.skipped++;continue;
    }
    const b=box(c),text=c.text||'';
    if(b.width<=0 || b.height<=0) {
      skipped.push({id:c.id,kind:k,text});counts.skipped++;continue;
    }
    checkLimit();
    const type=k==='rhombus'?5:k==='ellipse'?34:4;
    let fs=Math.min(96,Math.max(8,number(s.fontSize,20)));
    if(fitFont && text)fs=fitFont(text,b.width,b.height,fs);
    const options={fontSize:fs,fill:k==='text'?'none':s.fillColor,stroke:k==='text'?'none':s.strokeColor,
      thickness:Math.max(0,Math.min(20,number(s.strokeWidth,1))),dashed:s.dashed==='1'};
    const item=shapeItem(b.x,b.y,b.width,b.height,text,type,options);
    if(s.opacity!==undefined) {
      const a=Math.max(0,Math.min(1,number(s.opacity,100)/100));
      item.content.fillColor.a*=a;item.content.lineColor.a*=a;
    }
    (!text && type===4?backgrounds:blocks).push(item);kept.add(c.id);counts.forms++;
    if(s.rounded==='1')warnings.add('I rettangoli arrotondati vengono convertiti con angoli retti.');
    if(number(s.rotation,0)!==0)warnings.add('Le forme ruotate vengono convertite senza rotazione.');
    if(s.fontStyle || s.align || s.fontColor)warnings.add('Lo stile del testo è semplificato: centrato, senza formattazione avanzata.');
  }

  function endpoint(edge,role,toward) {
    const source=role==='exit',obj=byId.get(source?edge.source:edge.target),s=edge.styleMap;
    const parent=byId.get(edge.parent),p=parent?.vertex?box(parent):{x:0,y:0};
    if(obj) {
      const b=box(obj),cx=b.x+b.width/2,cy=b.y+b.height/2;
      if(s[role+'X']!==undefined) {
        return {x:b.x+b.width*number(s[role+'X'],0.5),y:b.y+b.height*number(s[role+'Y'],0.5)};
      }
      const dx=toward.x-cx,dy=toward.y-cy,k=shapeKind(obj);
      let t;
      if(k==='ellipse')t=1/Math.sqrt((dx/(b.width/2))**2+(dy/(b.height/2))**2);
      else if(k==='rhombus')t=1/(Math.abs(dx)/(b.width/2)+Math.abs(dy)/(b.height/2));
      else t=Math.min((b.width/2)/Math.abs(dx||1e-9),(b.height/2)/Math.abs(dy||1e-9));
      return {x:cx+dx*(Number.isFinite(t)?t:0),y:cy+dy*(Number.isFinite(t)?t:0)};
    }
    const point=geometry(edge)[source?'sourcePoint':'targetPoint'];
    if(point)return {x:p.x+point.x,y:p.y+point.y};
    throw new Error('Estremo mancante');
  }

  function edgeRoute(edge) {
    const s=edge.styleMap,g=geometry(edge),parent=byId.get(edge.parent);
    const p=parent?.vertex?box(parent):{x:0,y:0};
    const way=(g.points||[]).map(q=>({x:p.x+q.x,y:p.y+q.y}));
    const center=id=>{
      const obj=byId.get(id);if(!obj)return {x:0,y:0};
      const b=box(obj);return {x:b.x+b.width/2,y:b.y+b.height/2};
    };
    const start=endpoint(edge,'exit',way[0]||center(edge.target));
    const end=endpoint(edge,'entry',way.at(-1)||center(edge.source));
    const points=[start];
    for(const [i,q] of [...way,end].entries()) {
      const prev=points.at(-1);
      if(Math.abs(prev.x-q.x)>0.01 && Math.abs(prev.y-q.y)>0.01) {
        if(way.length) {
          const vertical=(i===0 && ['0','1'].includes(s.exitY)) || (points.length>1 && Math.abs(prev.y-points.at(-2).y)<0.01);
          points.push(vertical?{x:prev.x,y:q.y}:{x:q.x,y:prev.y});
        } else {
          const verticalExit=['0','1'].includes(s.exitY) || s.exitX===undefined;
          const verticalEntry=['0','1'].includes(s.entryY) || s.entryX===undefined;
          if(verticalExit && verticalEntry) {
            const mid=(prev.y+q.y)/2;points.push({x:prev.x,y:mid},{x:q.x,y:mid});
          } else if(!verticalExit && !verticalEntry) {
            const sameSide=s.exitX===s.entryX && ['0','1'].includes(s.exitX);
            const mid=sameSide?(s.exitX==='1'?Math.max(prev.x,q.x)+35:Math.min(prev.x,q.x)-35):(prev.x+q.x)/2;
            points.push({x:mid,y:prev.y},{x:mid,y:q.y});
          } else points.push(verticalExit?{x:prev.x,y:q.y}:{x:q.x,y:prev.y});
        }
      }
      if(distance(points.at(-1),q)>0.01)points.push(q);
    }
    return points.filter((p,i)=>i===0 || distance(p,points[i-1])>0.01);
  }

  function lineShape(x,y,w,h,stroke) {
    checkLimit();lineParts.push(shapeItem(x,y,Math.max(w,.1),Math.max(h,.1),'',4,{fill:stroke,stroke:'none'}));
  }
  function segment(a,b,stroke,width,dashed=false) {
    const length=distance(a,b);if(length<0.01)return;
    if(dashed) {
      for(let t=0;t<length;t+=12) {
        const u=Math.min(length,t+7);
        segment({x:a.x+(b.x-a.x)*t/length,y:a.y+(b.y-a.y)*t/length},
          {x:a.x+(b.x-a.x)*u/length,y:a.y+(b.y-a.y)*u/length},stroke,width);
      }
    } else if(Math.abs(a.x-b.x)<0.01)lineShape(a.x-width/2,Math.min(a.y,b.y),width,Math.abs(a.y-b.y),stroke);
    else lineShape(Math.min(a.x,b.x),a.y-width/2,Math.abs(a.x-b.x),width,stroke);
  }
  function tip(end,previous,stroke) {
    const dx=end.x-previous.x,dy=end.y-previous.y;
    for(let i=0;i<7;i++) {
      const breadth=(i+1)*1.45,depth=1.25;
      if(Math.abs(dx)>Math.abs(dy))lineShape(dx>0?end.x-(i+1)*depth:end.x+i*depth,end.y-breadth/2,depth,breadth,stroke);
      else lineShape(end.x-breadth/2,dy>0?end.y-(i+1)*depth:end.y+i*depth,breadth,depth,stroke);
    }
  }

  const edges=cells.filter(c=>c.edge && visible(c));counts.edges=edges.length;
  for(const edge of edges) {
    if((edge.source && !kept.has(edge.source)) || (edge.target && !kept.has(edge.target))) {
      if(includeArrows)warnings.add('Omesse le frecce collegate a forme non supportate.');
      continue;
    }
    let points;
    try {points=edgeRoute(edge);}catch {warnings.add('Alcuni collegamenti non hanno estremi utilizzabili.');continue;}
    if(points.length<2)continue;
    routes.set(edge.id,points);
    if(!includeArrows)continue;
    const s=edge.styleMap,stroke=s.strokeColor||'#1f1f1f',width=Math.max(1,Math.min(10,number(s.strokeWidth,1.5)));
    for(let i=1;i<points.length;i++)segment(points[i-1],points[i],stroke,width,s.dashed==='1');
    if(s.endArrow!=='none')tip(points.at(-1),points.at(-2),stroke);
    if(s.startArrow && s.startArrow!=='none')tip(points[0],points[1],stroke);
    counts.convertedEdges++;
    if(s.curved==='1' || s.edgeStyle==='entityRelationEdgeStyle')warnings.add('Le curve e alcuni percorsi complessi sono approssimati con segmenti ortogonali.');
  }

  for(const c of cells) {
    const edgeLabel=shapeKind(c)==='edgeLabel';
    if(!visible(c) || (!edgeLabel && !(c.edge && c.text)))continue;
    const edge=edgeLabel?byId.get(c.parent):c,points=routes.get(edge?.id);if(!points)continue;
    const g=geometry(c),fs=Math.max(8,number(c.styleMap.fontSize,20)),text=c.text||'';
    const p=labelPosition(points,(g.x+1)/2,g.y),off=g.offset||{x:0,y:0};
    const width=Math.max(40,text.length*fs*.65),height=fs*1.6;
    checkLimit();labels.push(shapeItem(p.x+off.x-width/2,p.y+off.y-height/2,width,height,text,4,{stroke:'none',fontSize:fs}));
    counts.labels++;
  }

  if(counts.skipped)warnings.add(`${counts.skipped} oggetti non supportati sono stati esclusi (icone, immagini o altre forme).`);
  if(includeArrows && counts.convertedEdges)warnings.add('Frecce beta: componenti indipendenti, senza agganci automatici; percorso e punte possono differire dall’originale.');
  const items=[...backgrounds,...lineParts,...blocks,...labels];
  if(!items.length)throw new Error('Nessuna forma supportata in questa pagina.');
  const minX=Math.min(...items.map(i=>i.originPoint.x))-30,minY=Math.min(...items.map(i=>i.originPoint.y))-30;
  for(const item of items)for(const key of ['position','originPoint']) {
    item[key].x=+(item[key].x-minX).toFixed(4);item[key].y=+(item[key].y-minY).toFixed(4);
  }
  return {
    payload:{boardItems:items,anchorPosition:{x:0,y:0},contentType:`Shape:${items.length}`},
    counts:{...counts,total:items.length},warnings:[...warnings],skipped,
    bounds:{width:Math.max(...items.map(i=>i.originPoint.x+i.size.width))+30,
      height:Math.max(...items.map(i=>i.originPoint.y+i.size.height))+30}
  };
}
