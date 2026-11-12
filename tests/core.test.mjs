import test from 'node:test';
import assert from 'node:assert/strict';
import {convert,shapeItem,color,parseStyle} from '../src/converter.js';
import {clipboardHtml,consoleScript} from '../src/clipboard.js';
import vm from 'node:vm';
import {deflateRawSync} from 'node:zlib';
import {expandDiagram} from '../src/parser.js';

function node(id,x,y,w=200,h=100,style='',extra={}) {
  return {id,vertex:true,style,text:id,geometry:{x,y,width:w,height:h,points:[]},...extra};
}
const edge=(extra={})=>({id:'edge',edge:true,source:'A',target:'B',style:'exitX=0.5;exitY=1;entryX=0.5;entryY=0;',geometry:{x:0,y:0,points:[]},...extra});

test('mappa le tre forme e conserva testo, dimensioni e colori',()=>{
  const result=convert([node('A',100,40,200,100,'fillColor=#abc;'),node('B',400,40,180,80,'rhombus;'),node('C',700,40,160,60,'ellipse;')]);
  assert.deepEqual(result.payload.boardItems.map(i=>i.content.type),[4,5,34]);
  assert.deepEqual(result.payload.boardItems[0].content.fillColor,{r:170,g:187,b:204,a:1});
  assert.equal(result.payload.boardItems[1].size.width,180);
  assert.equal(result.payload.boardItems[0].content.text,'A');
  for(const item of result.payload.boardItems){assert.equal(item.position.x,item.originPoint.x+item.size.width/2);}
});

test('appiattisce gruppi annidati e coordinate relative',()=>{
  const result=convert([
    node('group',100,200,400,300,'group;',{text:''}),
    node('A',20,30,100,50,'',{parent:'group'}),
    node('nested',200,100,100,100,'group;',{parent:'group',text:''}),
    node('B',.5,.5,40,20,'',{parent:'nested',geometry:{x:.5,y:.5,width:40,height:20,relative:true,offset:{x:5,y:8}}})
  ]);
  assert.equal(result.counts.forms,2);
  const [a,b]=result.payload.boardItems;
  assert.equal(b.originPoint.x-a.originPoint.x,235);
  assert.equal(b.originPoint.y-a.originPoint.y,128);
});

test('omettere le frecce mantiene le etichette e non genera segmenti',()=>{
  const cells=[node('A',0,0),node('B',300,300),edge({text:'Sì'})];
  const plain=convert(cells),full=convert(cells,{includeArrows:true});
  assert.equal(plain.counts.total,3);assert.equal(plain.counts.labels,1);
  assert.equal(plain.counts.convertedEdges,0);assert.equal(full.counts.convertedEdges,1);
  assert(full.counts.total>plain.counts.total);
  assert(full.payload.boardItems.every(i=>i.content.contentType==='shape'));
});

test('coordinate esplicite degli agganci producono il percorso verticale previsto',()=>{
  const r=convert([node('A',0,0),node('B',0,250),edge()],{includeArrows:true});
  const segments=r.payload.boardItems.filter(i=>i.content.text==='');
  const shaft=segments.find(i=>i.size.height===150);
  assert(shaft);assert.equal(shaft.size.width,1.5);
});

test('conserva i punti intermedi e i percorsi dei collegamenti dentro gruppi',()=>{
  const r=convert([
    node('g',500,600,800,900,'group;', {text:''}),
    node('A',0,0,200,100,'',{parent:'g'}),node('B',300,300,200,100,'',{parent:'g'}),
    edge({parent:'g',geometry:{x:0,y:0,points:[{x:100,y:180},{x:400,y:180}]}})
  ],{includeArrows:true});
  assert.equal(r.counts.convertedEdges,1);
  const horizontal=r.payload.boardItems.find(i=>!i.content.text && i.size.width===300);
  assert(horizontal);assert.equal(horizontal.size.height,1.5);
});

test('gestisce collegamenti con un estremo libero',()=>{
  const r=convert([node('A',0,0),edge({target:null,geometry:{x:0,y:0,points:[],targetPoint:{x:100,y:250}}})],{includeArrows:true});
  assert.equal(r.counts.convertedEdges,1);
});

test('un punto intermedio coincidente con la partenza non interrompe la conversione',()=>{
  const r=convert([node('A',0,0),node('B',300,300),edge({geometry:{x:0,y:0,points:[{x:100,y:100},{x:400,y:200}]}})],{includeArrows:true});
  assert.equal(r.counts.convertedEdges,1);
});

test('decodifica il formato draw.io compresso, inclusi caratteri Unicode',async()=>{
  const xml='<mxGraphModel><root><mxCell value="Caffè &amp; ricerca" /></root></mxGraphModel>';
  const compressed=deflateRawSync(Buffer.from(encodeURIComponent(xml))).toString('base64');
  assert.equal(await expandDiagram(compressed),xml);
  assert.equal(await expandDiagram(xml),xml);
});

test('rifiuta dati compressi corrotti',async()=>{
  await assert.rejects(expandDiagram('not-a-valid-compressed-file'),/decomprimere/);
});

test('segnala icone e salta i loro collegamenti; ignora oggetti nascosti',()=>{
  const r=convert([node('A',0,0),node('B',300,0,50,50,'shape=umlActor;'),node('hidden',0,400,100,50,'',{visible:false}),edge()],{includeArrows:true});
  assert.equal(r.counts.forms,1);assert.equal(r.counts.skipped,1);assert.equal(r.counts.convertedEdges,0);
  assert(r.warnings.some(w=>w.includes('non supportati')));
});

test('gli oggetti figli di un gruppo nascosto non sono convertiti',()=>{
  assert.throws(()=>convert([node('g',0,0,300,300,'group;',{visible:false}),node('A',10,10,100,100,'',{parent:'g'})]),/Nessuna forma/);
});

test('rifiuta gerarchie cicliche e dati vuoti',()=>{
  assert.throws(()=>convert([node('A',0,0,200,100,'',{parent:'B'}),node('B',0,0,200,100,'',{parent:'A'})]),/ciclica/);
  assert.throws(()=>convert([]),/Nessuna forma/);
});

test('gestisce colori trasparenti e geometria non valida',()=>{
  assert.equal(color('none').a,0);assert.equal(parseStyle('rhombus;fillColor=#fff;').base,'rhombus');
  assert.throws(()=>shapeItem(0,0,-1,100),/Geometria/);
});

test('il JSON può attraversare HTML clipboard senza perdere caratteri',()=>{
  const p=convert([node('A',0,0,200,100,'',{text:'Caffè & "test" <script>alert(1)</script>\nSeconda riga'})]).payload;
  const html=clipboardHtml(p);const encoded=html.match(/whiteboardcontent="([^"]+)"/)[1];
  assert.deepEqual(JSON.parse(decodeURIComponent(encoded)),p);
});

test('lo script generato non esegue il contenuto del diagramma e crea i pulsanti',()=>{
  const p=convert([node('A',0,0,200,100,'',{text:'";globalThis.injected=true;//'})]).payload;
  const buttons=[];const element=()=>({style:{},append(){},remove(){},setAttribute(){}});
  const sandbox={document:{getElementById(){return null},createElement(tag){const e=element();if(tag==='button')buttons.push(e);return e},body:element()}};
  vm.runInNewContext(consoleScript(p,p),sandbox);
  assert.equal(sandbox.injected,undefined);assert.equal(buttons.length,3);
});
