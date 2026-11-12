const MAX_XML = 20 * 1024 * 1024;

function xmlDocument(source) {
  if (source.length > MAX_XML) throw new Error('Il diagramma decompresso supera 20 MB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Le dichiarazioni DTD non sono supportate.');
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Il file non contiene XML draw.io valido.');
  return doc;
}

export function readDocument(source) {
  const doc = xmlDocument(source);
  if (doc.documentElement.localName === 'mxGraphModel') {
    return [{ name: 'Pagina 1', graph: doc.documentElement }];
  }
  if (doc.documentElement.localName !== 'mxfile') throw new Error('È richiesto un file .drawio / XML mxfile o mxGraphModel.');
  const pages = [...doc.documentElement.children].filter(e => e.localName === 'diagram');
  if (!pages.length) throw new Error('Il file non contiene pagine.');
  return pages.map((diagram, i) => ({ name: diagram.getAttribute('name') || `Pagina ${i + 1}`, diagram }));
}

export async function expandDiagram(encoded) {
  if (encoded.startsWith('<')) return encoded;
  if (!globalThis.DecompressionStream) throw new Error('La decompressione non è disponibile. Esporta un XML non compresso da draw.io.');
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/\s/g, '')), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const reader = stream.getReader(); const parts = []; let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_XML) { await reader.cancel(); throw new Error('Limite di decompressione superato.'); }
        parts.push(value);
      }
    } finally { reader.releaseLock(); }
    const combined = new Uint8Array(size); let offset = 0;
    for (const p of parts) { combined.set(p, offset); offset += p.length; }
    return decodeURIComponent(new TextDecoder().decode(combined));
  } catch (error) {
    throw new Error('Impossibile decomprimere questa pagina. Prova un XML non compresso. ' + error.message);
  }
}

export async function readPage(page) {
  let graph = page.graph || [...page.diagram.children].find(e => e.localName === 'mxGraphModel');
  if (!graph) graph = xmlDocument(await expandDiagram(page.diagram.textContent.trim())).documentElement;
  if (graph.localName !== 'mxGraphModel') throw new Error('La pagina non contiene un mxGraphModel.');
  const cells = [...graph.querySelectorAll('root > mxCell, root > object > mxCell, root > UserObject > mxCell')];
  const seen = new Set();
  return cells.map(cell => {
    const wrapper = cell.parentElement;
    const wrapped = wrapper.localName === 'object' || wrapper.localName === 'UserObject';
    const id = cell.getAttribute('id') || (wrapped && wrapper.getAttribute('id'));
    if (!id || seen.has(id)) throw new Error('Identificativo di oggetto mancante o duplicato.');
    seen.add(id);
    const geometry = [...cell.children].find(e => e.localName === 'mxGeometry');
    const num = (e, key, fallback = 0) => {
      const value = Number(e?.getAttribute(key) ?? fallback);
      if (!Number.isFinite(value) || Math.abs(value) > 1e7) throw new Error('Coordinate non valide nel diagramma.');
      return value;
    };
    const point = e => e ? { x: num(e, 'x'), y: num(e, 'y') } : null;
    const children = geometry ? [...geometry.children] : [];
    const special = role => point(children.find(e => e.localName === 'mxPoint' && e.getAttribute('as') === role));
    const array = children.find(e => e.localName === 'Array' && e.getAttribute('as') === 'points');
    return {
      id, parent: cell.getAttribute('parent'), source: cell.getAttribute('source'), target: cell.getAttribute('target'),
      vertex: cell.getAttribute('vertex') === '1', edge: cell.getAttribute('edge') === '1',
      visible: cell.getAttribute('visible') !== '0', style: cell.getAttribute('style') || '',
      value: cell.getAttribute('value') || (wrapped && wrapper.getAttribute('label')) || '',
      geometry: {
        x: num(geometry, 'x'), y: num(geometry, 'y'), width: num(geometry, 'width'), height: num(geometry, 'height'),
        relative: geometry?.getAttribute('relative') === '1',
        points: array ? [...array.children].filter(e => e.localName === 'mxPoint').map(point) : [],
        sourcePoint: special('sourcePoint'), targetPoint: special('targetPoint'), offset: special('offset')
      }
    };
  });
}

export function plainText(value) {
  // XML has already decoded one layer of entities. Decode HTML using an inert textarea,
  // then strip markup as text: never attach imported markup or images to the document.
  const textarea = document.createElement('textarea');
  const withLines = String(value).replace(/<br\s*\/?>|<\/?(?:div|p|li)(?:\s[^>]*)?>/gi, '\n');
  textarea.innerHTML = withLines.replace(/<[^>]*>/g, '');
  return textarea.value.replace(/\u00a0/g, ' ').replace(/\n[\t ]*\n+/g, '\n').trim();
}
