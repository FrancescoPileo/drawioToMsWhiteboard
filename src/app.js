import { readDocument, readPage, plainText } from './parser.js';
import { convert } from './converter.js';
import { copyPayload, consoleScript } from './clipboard.js';

const $=id=>document.getElementById(id);
let pages=[],current=null,generation=0;
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
function wrap(text,width,font) {
  ctx.font=`${font}px Arial`;const lines=[];
  for(const paragraph of text.split('\n')) {
    let line='';for(const word of paragraph.split(/\s+/)) {
      const trial=(line+' '+word).trim();
      if(line && ctx.measureText(trial).width>width){lines.push(line);line=word;}else line=trial;
    }lines.push(line);
  }return lines;
}
function fitFont(text,w,h,start) {
  let fs=start;while(fs>10 && wrap(text,Math.max(1,w-10),fs).length*fs*1.2>h-6)fs-=.5;return fs;
}
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
function enable(value) {
  for(const id of ['copy','script','zoom','reset'])$(id).disabled=!value;
  $('arrows').disabled=!value || !current?.arrowsAvailable;
}
function reset() {
  current=null;enable(false);$('preview').replaceChildren();$('preview').hidden=true;$('empty').hidden=false;
  $('stats').textContent='Il tuo diagramma apparirà qui';$('report').hidden=true;
}
function download(name,text) {
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function svgElement(tag,attrs={}) {
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));return el;
}
function cssColor(c){return `rgb(${c.r},${c.g},${c.b})`;}
function active(){return $('arrows').checked?current.complete:current.forms;}
function render() {
  if(!current)return;const result=active(),svg=$('preview');svg.replaceChildren();
  svg.setAttribute('viewBox',`0 0 ${result.bounds.width} ${result.bounds.height}`);
  for(const item of result.payload.boardItems) {
    const {x,y}=item.originPoint,{width:w,height:h}=item.size,c=item.content;
    const attrs={fill:cssColor(c.fillColor),'fill-opacity':c.fillColor.a,stroke:cssColor(c.lineColor),'stroke-opacity':c.lineColor.a,'stroke-width':c.lineThickness};
    if(c.lineStyle===1)attrs['stroke-dasharray']='8 6';
    let el;
    if(c.type===34)el=svgElement('ellipse',{...attrs,cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2});
    else if(c.type===5)el=svgElement('polygon',{...attrs,points:`${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`});
    else el=svgElement('rect',{...attrs,x,y,width:w,height:h});
    svg.append(el);
    if(c.text) {
      const rows=wrap(c.text,w-10,c.fontSize);
      const text=svgElement('text',{'text-anchor':'middle','font-size':c.fontSize,'font-family':'Arial,sans-serif',fill:'#1f1f1f'});
      for(const [i,line]of rows.entries()) {
        const t=svgElement('tspan',{x:x+w/2,y:y+h/2+(i-(rows.length-1)/2)*c.fontSize*1.2+c.fontSize*.35});t.textContent=line;text.append(t);
      }svg.append(text);
    }
  }
  $('empty').hidden=true;svg.hidden=false;
  const c=result.counts;
  $('stats').textContent=`${c.forms} forme · ${c.edges} collegamenti originali · ${c.total} oggetti generati`;
  $('warnings').replaceChildren(...result.warnings.map(w=>{const li=document.createElement('li');li.textContent=w;return li;}));
  $('report').hidden=!result.warnings.length;
  $('copy').textContent=$('arrows').checked?'Copia diagramma con frecce':'Copia forme e testi';
  updateZoom();
}
function updateZoom() {
  if(!current)return;const bounds=active().bounds;
  const available=$('viewport').clientWidth-50;
  const width=Math.max(100,available)*Number($('zoom').value)/100;
  $('preview').style.width=width+'px';$('preview').style.height=(width*bounds.height/bounds.width)+'px';
  $('zoom-value').textContent=$('zoom').value+'%';
}
async function selectPage() {
  const token=++generation;reset();status('Conversione in corso…');
  try {
    const parsed=await readPage(pages[Number($('page').value)||0]);
    if(token!==generation)return;
    if(parsed.length>10000)throw new Error('Oltre 10000 oggetti nella pagina: dividi il diagramma.');
    const cells=parsed.map(c=>({...c,text:plainText(c.value)}));
    const forms=convert(cells,{fitFont});let complete,arrowsAvailable=true;
    try{complete=convert(cells,{includeArrows:true,fitFont});}
    catch(error){complete=forms;arrowsAvailable=false;forms.warnings.push('Frecce non disponibili: '+error.message);$('arrows').checked=false;}
    current={forms,complete,arrowsAvailable};enable(true);$('zoom').value='100';render();
    status('Pronto. Copia il risultato oppure scarica lo script per Whiteboard.');
  }catch(error){if(token===generation){reset();status(error.message,true);}}
}
async function load(source,name) {
  generation++;reset();pages=[];$('page-control').hidden=true;$('page').replaceChildren();$('filename').textContent=name;
  try {
    pages=readDocument(source);
    for(const [index,page]of pages.entries()) {const o=document.createElement('option');o.value=index;o.textContent=page.name;$('page').append(o);}
    $('page-control').hidden=pages.length<2;await selectPage();
  }catch(error){status(error.message,true);}
}
async function openFile(file) {
  if(!file)return;
  if(file.size>10*1024*1024){generation++;reset();status('Il file supera 10 MB.',true);return;}
  const token=++generation;reset();status('Lettura del file…');
  try{const source=await file.text();if(token===generation)await load(source,file.name);}
  catch(error){if(token===generation)status(error.message,true);}
}
$('file').addEventListener('change',e=>openFile(e.target.files[0]));
$('page').addEventListener('change',selectPage);
$('arrows').addEventListener('change',render);
$('zoom').addEventListener('input',updateZoom);
$('reset').addEventListener('click',()=>{$('zoom').value='100';updateZoom();$('viewport').scrollTo(0,0);});
window.addEventListener('resize',updateZoom);
$('copy').addEventListener('click',async()=>{
  if(!current)return;
  try{await copyPayload(active().payload);status('Copiato. Apri Whiteboard, clicca sulla lavagna e premi Ctrl+V.');}
  catch(error){status(error.message+' Puoi usare il pulsante “Scarica script per Whiteboard”.',true);}
});
$('script').addEventListener('click',()=>{
  if(!current)return;download('drawioToMsWhiteboard.txt',consoleScript(current.forms.payload,current.complete.payload));
  status('Script scaricato. Aprilo e copia il codice nella Console di Whiteboard web.');
});
$('demo').addEventListener('click',async()=>{
  const token=++generation;reset();status('Caricamento esempio…');
  try{const response=await fetch('./examples/basic.drawio');if(!response.ok)throw new Error('Esempio non disponibile.');
    const source=await response.text();if(token===generation)await load(source,'basic.drawio · esempio');
  }catch(error){if(token===generation)status(error.message,true);}
});
for(const event of ['dragover','dragenter'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('over');});
$('drop').addEventListener('dragleave',()=>$('drop').classList.remove('over'));
$('drop').addEventListener('drop',e=>{e.preventDefault();$('drop').classList.remove('over');openFile(e.dataTransfer.files[0]);});
