export function clipboardHtml(payload) {
  return `<whiteboard-tag whiteboardcontent="${encodeURIComponent(JSON.stringify(payload))}"></whiteboard-tag>`;
}

export async function copyPayload(payload) {
  if (!globalThis.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Copia HTML non disponibile: usa localhost o HTTPS in Edge/Chrome, oppure scarica lo script.');
  }
  const data = { ...payload, correlationId: crypto.randomUUID() };
  await navigator.clipboard.write([new ClipboardItem({
    'text/html': new Blob([clipboardHtml(data)], { type: 'text/html' }),
    'text/plain': new Blob(['Diagramma drawioToMsWhiteboard'], { type: 'text/plain' })
  })]);
}

export function consoleScript(forms, complete) {
  // Data is serialized as a JavaScript string, not interpolated into executable statements.
  const serialized = JSON.stringify(JSON.stringify({ forms, complete }));
  return `// drawioToMsWhiteboard v0.1.0 — eseguire nella Console di Whiteboard web.
// Aggiunge un pannello. Scrive negli appunti soltanto dopo un clic. Nessuna richiesta di rete.
(() => {
  document.getElementById('drawio-to-whiteboard-panel')?.remove();
  const data = JSON.parse(${serialized});
  const p = document.createElement('section');
  p.id = 'drawio-to-whiteboard-panel';
  p.style.cssText = 'position:fixed;right:20px;top:20px;z-index:2147483647;padding:20px;width:310px;background:white;color:#172033;border:2px solid #087f78;border-radius:12px;font:14px/1.5 Arial;box-shadow:0 8px 30px #0003';
  const title = document.createElement('strong'); title.textContent = 'drawioToMsWhiteboard'; p.append(title);
  const note = document.createElement('p'); note.textContent = 'Le frecce sperimentali sono segmenti indipendenti e non seguono i blocchi.'; p.append(note);
  const status = document.createElement('p'); status.setAttribute('role','status');
  async function copy(payload) {
    try {
      const value = {...payload, correlationId:crypto.randomUUID()};
      const html = '<whiteboard-tag whiteboardcontent="'+encodeURIComponent(JSON.stringify(value))+'"></whiteboard-tag>';
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':new Blob([html],{type:'text/html'}),
        'text/plain':new Blob(['Diagramma drawioToMsWhiteboard'],{type:'text/plain'})
      })]);
      status.textContent = 'Copiato. Clicca sulla lavagna e premi Ctrl+V.';
    } catch(e) { status.textContent = 'Copia fallita: '+e.message; }
  }
  function button(label,action) {
    const b=document.createElement('button'); b.textContent=label;
    b.style.cssText='display:block;width:100%;padding:10px;margin-top:10px;cursor:pointer';
    b.onclick=action; p.append(b);
  }
  button('Copia solo forme e testi',()=>copy(data.forms));
  button('Copia anche le frecce (beta)',()=>copy(data.complete));
  button('Chiudi',()=>p.remove()); p.append(status); document.body.append(p);
})();
`;
}
