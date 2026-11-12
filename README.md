# drawioToMsWhiteboard

Convertitore sperimentale da **draw.io / diagrams.net** a **Microsoft Whiteboard**. Carica un file `.drawio` o `.xml`, scegli una pagina e trasferisci le forme mantenendole modificabili.

È un’app statica: conversione nel browser, nessun backend, nessun caricamento dei diagrammi su server, nessun servizio esterno richiesto durante la conversione. La pubblicazione su GitHub Pages è facoltativa.

> **Versione 0.1.0 — formato appunti non documentato.** Il progetto usa il contenuto HTML `whiteboard-tag` osservato negli appunti di Whiteboard. Non è un’importazione ufficiale e non usa un’API Microsoft. Un aggiornamento di Whiteboard può interromperne il funzionamento. Prova sempre il risultato su una lavagna vuota.

## Compatibilità

| Elemento | Supporto iniziale | Note |
| --- | --- | --- |
| Rettangoli | Sì | Forme native modificabili; gli angoli arrotondati diventano retti |
| Rombi | Sì | Forma nativa modificabile |
| Ellissi | Sì | Forma nativa modificabile |
| Testo delle forme | Parziale | Testo modificabile, centrato; carattere e formattazione semplificati |
| Caselle di testo / etichette dei collegamenti | Parziale | Rappresentate da rettangoli con bordo invisibile; restano anche nella modalità senza frecce |
| Dimensioni, colori esadecimali e posizione | Parziale | Posizioni relative dei gruppi appiattite; dimensione del testo adattata se necessario |
| Gruppi | Parziale | Conservate le coordinate dei figli, non il raggruppamento |
| Frecce | **Beta, facoltative** | Linee e punte ricostruite con rettangoli modificabili. **Non sono connettori nativi** e non seguono le forme quando vengono spostate |
| Punti di passaggio dei collegamenti | Parziale | Percorso ortogonale approssimato, nessun instradamento per evitare gli ostacoli |
| Curve, punte speciali, rotazioni | No / approssimazione | Le curve diventano segmenti; le rotazioni sono omesse; le punte sono triangolari |
| Icone, immagini, attori UML e altre forme | No | Esclusi e segnalati; esclusi anche i collegamenti verso gli oggetti omessi |
| Pagine multiple | Sì | Una pagina per conversione |
| File draw.io compressi | Sì, browser compatibili | Base64 + DEFLATE raw + URL encoding; in alternativa esporta XML non compresso |
| Link, livelli come struttura modificabile, metadati | No | Non vengono trasferiti |

I codici nativi delle forme osservati sono `4` (rettangolo), `5` (rombo), `34` (ellisse). I campioni dei connettori contengono `headPosition: {}` e `tailPosition: {}` e non espongono gli agganci alle forme. Per questo la versione iniziale **non dichiara il supporto ai connettori nativi**, anche quando il collegamento appare semplice.

## Avvio locale

Richiede **Node.js 22 o successivo**. L’app e il server locale non hanno dipendenze di runtime: puoi avviarli senza installare pacchetti.

```bash
npm run dev
```

Apri `http://localhost:4173`. Puoi anche usare un altro server statico. Non aprire `index.html` direttamente come `file://`: moduli JavaScript, caricamento dell’esempio e appunti richiedono un contesto adeguato. Per la copia HTML usa preferibilmente Edge o Chrome aggiornati, tramite localhost o HTTPS.

## Trasferimento in Whiteboard

1. Carica il file `.drawio` / `.xml` e scegli la pagina, se il documento ne contiene più di una.
2. Controlla l’anteprima e le note sugli oggetti esclusi.
3. Lascia disattivata **Includi le frecce** per ricreare successivamente i connettori in Whiteboard. Attivala per provare la ricostruzione geometrica.
4. Premi **Copia forme e testi** oppure **Copia diagramma con frecce**.
5. Apri una lavagna vuota in Microsoft Whiteboard web, clicca sull’area di disegno e premi **Ctrl+V**.

L’anteprima è indicativa: il rendering del testo e l’ordine degli oggetti in Whiteboard possono differire. L’inserimento di molte forme può richiedere alcuni secondi.

### Alternativa: script per la Console

Se la copia diretta non è disponibile o Whiteboard non riconosce il contenuto copiato dall’app:

1. Premi **Scarica script per Whiteboard**.
2. Apri il file `.txt` e copia il codice.
3. In Whiteboard web apri **F12 → Console**, scegli il contesto della pagina principale (`top`), incolla il codice ed eseguilo.
4. Nel pannello aggiunto alla pagina scegli **Copia solo forme e testi** o **Copia anche le frecce (beta)**.
5. Clicca sulla lavagna e premi **Ctrl+V**.

Lo script contiene i dati del diagramma convertito: trattalo come il documento di origine. Crea un pannello temporaneo e scrive negli appunti dopo un clic; non invia richieste di rete e non modifica la lavagna finché non incolli. Il pannello può essere chiuso. Per annullare l’incolla usa Ctrl+Z in Whiteboard.

## Repository GitHub

Questo progetto è pronto per una repository denominata **`drawioToMsWhiteboard`**. Crea una repository vuota nel tuo account e carica il contenuto di questa cartella, mantenendo `index.html`, `src/` e `styles.css` nella radice della repository. Non sono incluse credenziali o diagrammi personali.

Puoi caricare i file dall’interfaccia di GitHub oppure usare Git:

```bash
git init
git add .
git commit -m "Initial drawioToMsWhiteboard converter"
git branch -M master
git remote add origin https://github.com/TUO-UTENTE/drawioToMsWhiteboard.git
git push -u origin master
git switch -c develop
git push -u origin develop
```

Sostituisci `TUO-UTENTE` con il tuo account o la tua organizzazione. I comandi presuppongono una repository remota vuota. `master` è il ramo di produzione, `develop` quello di sviluppo. Dopo il push, in **Settings → General → Default branch** imposta `master`.

### GitHub Pages

Non serve una build. Nelle impostazioni della repository scegli **Pages → Deploy from a branch → master → / (root)**. In alternativa è incluso il workflow manuale `pages.yml`: scegli **GitHub Actions** come origine di Pages ed esegui **Deploy static app** dalla scheda Actions. Il workflow pubblica soltanto i file dell’app e l’esempio sintetico.

L’indirizzo del sito avrà la forma `https://TUO-UTENTE.github.io/drawioToMsWhiteboard/`. Tutti i percorsi dell’app sono relativi, per funzionare anche in una sottocartella.

## Sviluppo e test

```bash
# Test della conversione: nessuna installazione richiesta
npm test

# Test di integrazione nel browser (installazione necessaria soltanto per i test)
npm install
npx playwright install chromium
npm run test:browser
```

I test coprono forme, coordinate dei gruppi, collegamenti e punti intermedi, modalità senza frecce, oggetti esclusi, gerarchie non valide e serializzazione degli appunti. Il test browser copre anche caricamento, XML compresso, pagine multiple, copia HTML, download dello script e layout mobile. Non automatizza l’accesso a Microsoft Whiteboard: il controllo finale dell’incolla e della modifica rimane manuale.

Il workflow CI esegue test unitari e browser su ogni push e pull request.

### Struttura

```text
index.html                  Interfaccia
styles.css                  Layout responsive
src/parser.js               XML draw.io, decompressione e normalizzazione
src/converter.js            Geometrie e forme Whiteboard
src/clipboard.js            HTML appunti e generazione dello script
src/app.js                  Caricamento, anteprima e comandi
examples/basic.drawio       Esempio sintetico senza dati personali
scripts/serve.mjs           Server statico locale
tests/                      Test unitari e browser
.github/workflows/          CI e pubblicazione facoltativa
```

Limiti applicati: file in ingresso 10 MB, XML decompresso 20 MB, 10000 celle per pagina e 5000 oggetti generati. Le frecce possono generare molte forme: usa la modalità senza frecce se raggiungi il limite.

## Stato e prossimi passi

- Validazione manuale del copia/incolla per diversi browser e versioni di Whiteboard.
- Comprensione del formato degli agganci dei connettori nativi.
- Migliore fedeltà del testo, dei gruppi e delle punte delle frecce.
- Supporto selettivo ad altre forme, accompagnato da esempi e test.

Microsoft Whiteboard e draw.io / diagrams.net appartengono ai rispettivi titolari. Progetto indipendente, non affiliato o approvato da Microsoft o draw.io.

**Licenza:** da scegliere dal proprietario prima di una distribuzione con licenza open source; questa prima versione non include una licenza assegnata automaticamente.
