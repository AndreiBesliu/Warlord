# DEVLOG — Warlord

## Reguli DEVLOG
- **Append-only** — nu se șterg intrări istorice
- Fiecare task are **Task Started** și **Task Completed (Meșteșugul — felia 3: vocabularul întreg, arborele, și un defect din felia 2)**
> Prompt: „continua"
> Model: Claude Opus 5
> - **DEFECT REPARAT, găsit la o verificare la rece a feliei 2:** rabatul era prețuit ca `curent − promis`. Sună rezonabil până îl pui lângă cealaltă regulă — un meșteșug se poate jura DOAR dacă e deja în ținere. Împreună, cele două forțează `curent === promis` exact în clipa în care prețul se citește, deci **fiecare cerere procentuală valora exact ZERO** și tot vocabularul se prăbușea la „cumperi puncte cu mâini". Trei din cinci feluri de cerere erau ornament.
> - **Repreţuit pe LIBERTATEA CEDATĂ**, nu pe distanța față de azi: un plafon la 20% cedează banda 20→100 pentru totdeauna. E și nenul, și stabil — nu se mișcă atunci când se mișcă un slider, deci un buget deja cheltuit nu poate intra sub apă. Test dedicat care împiedică întoarcerea.
> - **Vocabularul întreg:** 8 piese, 3 canale, **8 dovezi distincte**, și niciun canal n-are două piese pe aceeași dovadă. Primele trei dovezi (`coinShare`/`goodsShare`/`studyShare`) sunt **rivale prin construcție** — trei felii dintr-un scalar, deci nicio casă nu le poate dovedi pe toate. Verificat pe viu: o casă care a fost 100% monedă și mereu plină poate lua Full Hands și Many Hands, și e refuzată la celelalte cinci **cu motivul exact** („cere 40% zile din nimic — casa asta e la 0%").
> - **Arborele stă pe STANDING (zile ȚINUTE), nu pe nivelul echipei.** Un cititor va întinde mâna după `crewLevelAt` fiindcă așa merge arborele unei legiuni; ar fi greșit — nivelul se cumpără cu zile LUCRATE, pe care calendarul le dă oricărei case cu mâini pe ea, iar standing-ul se are doar ținând o promisiune care costă în fiecare zi. Scris în fișier acolo unde se va greși.
> - Piesele luate DUPĂ jurământ formează un lanț, deci fiecare costă o treaptă mai adâncă. Cele jurate la început sunt rădăcini și nu plătesc standing — în clipa jurământului nu există. (Prima variantă lega totul de ultima rădăcină și făcea treapta 0 **imposibil de atins** — o regulă pe care n-o vede nimeni.)
> - `goodsMult` **REFUZAT la fermă**, ca regulă de validator, nu ca un canal care întoarce tăcut 1: marfa unei ferme e hrana, iar hrana e plafonul de populație — singura resursă pe care nimic n-o mărginește. O piesă pe care o poți lua și care e apoi inertă e un refuz care nu ajunge nicăieri.
> - **`SHARE_OF_POSTS`**, a doua cerere proporțională, denominată în POSTURI, nu în mâini postate: se înăsprește când CONSTRUIEȘTI, nu când alegi cum folosești ce ai.
> - **Reparată o minciună veche de patru felii:** tabul Research calcula `studyPerDay` FĂRĂ populație, deci sub-raporta studiul pentru fiecare casă încadrată în timp ce antetul avea dreptate. Un argument. Verificat pe viu: acum ambele spun 207 study/zi.
> - Prins la audit: butoanele dezactivate din arbore la **2,54:1** pe plăcuța întunecată. Ridicate la aceeași valoare pe care rândul de echipă o folosea deja.
> - 585 teste verzi. `SAVE_SCHEMA` neschimbat (10) — felia asta nu adaugă niciun câmp.

**Task Completed (Meșteșugul — felia 2: jurământul, și ceasul închis)**
> Prompt: „continua"
> Model: Claude Opus 5
> - **O clădire poate acum să înceteze să fie de uz general.** Jură permanent să nu mai facă ceva cu ziua ei și devine mai bună la ce a păstrat. Decizia: care casă nu se va mai putea răzgândi.
> - **Punctele vin EXCLUSIV din cereri.** `availableCraftPoints === rebateTotal`. Niciun buget liber, niciun portofel umplut de timp: fiecare punct de bonus e cumpărat cu o libertate scoasă, iar contorul se mișcă live pe ecran în timp ce alegi — regula se VEDE, nu se citește.
> - **Două feluri de promisiune încălcată, în două locuri diferite.** Monotonele (cele pe care le poți rupe cu mâna) refuză LA control; proporționalele nu refuză nimic, doar ADORM meșteșugul. `outOfKeeping` e singura autoritate — controalele sunt o comoditate, fiindcă un save sau o reglare de config poate sosi deja peste linie și acolo nu mai e niciun clic de refuzat.
> - **Designul nu conține niciun preț.** Id-uri de piese, pași, două șiruri, ziua jurământului și CE s-a promis. Tot restul se re-prețuiește la citire din `GameConfig` — deci un meșteșug umflat nu e reprezentabil, o reglare se aplică retroactiv fără migrare, iar „calibrăm valorile mai târziu" rămâne gratis în loc să devină o problemă de date.
> - **O piesă necunoscută FAULTEAZĂ tot designul**, nu se sare. Un nod nerezolvabil prețuiește 0, deci sărirea l-ar face pe `spentPoints` să SCADĂ și portofelul s-ar reumple — o fântână de puncte deschisă de un downgrade de build. E și opusul a ce face tradiția (ea aruncă la hidratare, noi păstrăm), și asimetria e scrisă în antet.
> - **`kept` cere muncă, nu calendar:** ziua se creditează doar dacă a scos valoare pe canalul pe care jurământul l-a numit. Fără asta, o casă jurată și lăsată în paragină urcă la fel de repede ca una care lucrează.
> - **Podeaua de mâini se derivă din cod livrat:** `creditsADayOfWork` cere deja jumătate din echipă, deci un `MIN_HANDS` la jumătate sau sub ar fi un rabat pentru o promisiune pe care jocul o făcea oricum. Propoziția de refuz numește regula pe care ar dubla-o.
> - **CEASUL ÎNCHIS** (decizia 2 din spec, aprobată): `planTicks` rebaza pe un ceas dat înapoi în loc să refuze — mută ceasul OS înainte, încasezi 24 de zile; înapoi, resetezi fereastra; la nesfârșit. Acum ancora se PĂSTREAZĂ și jucătorul așteaptă saltul, plafonat la o fereastră offline: dus-întorsul e la zero, iar o corecție NTP costă cel mult atât.
> - **Prins pe viu, din nou:** primul refuz al sliderului ajungea DOAR în Log. Un slider nu poate fi `disabled` pe jumătate de cursă, deci refuzul se prinde și se SPUNE în modal. Plus `wl-bad` la 3,44:1 pe plăcuța întunecată — aceeași capcană ca la galbenul care e literal `yellow-400` acolo.
> - Verificat pe viu tot lanțul: buget 0 → 9 puncte din două cereri · jurat „Vatra de Fier" (Coinwise ×4) · previzualizare 65 → **78** · sliderul de Research refuză cu motivul pe ecran · o mână scoasă sub cele 9 promise → **adoarme**, bonusul dispare în același render și `kept` nu mai urcă.
> - `SAVE_SCHEMA` 9 → 10. 583 teste verzi (32 noi), contrast cel mai prost 4,47 pe plăcuță (preexistent), zero butoane sub 26px.

**Task Completed (Meșteșugul — felia 1: casa își ține catastiful)**
> Prompt: „vreau sa dezvoltam sistemul din spatele jocului, vom calibra valorile mai tarziu"
> Model: Claude Opus 5
> - Fundația feliei 3 a populației, produsă de un workflow de 11 agenți (2 citiri · 3 designuri, unul obligat să argumenteze că meșteșugul e sistemul GREȘIT · 2 jurii · 3 atacuri · spec). Meșteșugul a câștigat la ambele jurii; **24 de constatări, 9 fatale**, toate cu răspuns luat înainte de prima linie de cod.
> - **Catastiful nu e un al doilea ceas.** `work` numără zile, iar o zi se obține lăsând timpul să treacă. `record` numără **ce a scos casa**, iar cele trei valori (`coinVal`/`goodsVal`/`studyVal`) sunt trei felii din ACELAȘI scalar — deci cotele sunt **rivale prin construcție** și nicio casă nu poate fi excelentă la toate trei. Aia e singura proprietate care face dovada o dovadă.
> - `crewPresent` extras din `creditsADayOfWork`: catastiful și ceasul pun aceeași întrebare despre prezență și pot fi în dezacord doar despre ce a produs ziua.
> - **`daysDry` NU e `blocked`.** O casă pe 100% monedă nu e niciodată „blocată", deci un contor pe `blocked` ar spune numele sliderului de focus, nu al zilei. Se numără zilele care n-au scos nimic pe niciun canal.
> - `passiveIncomeAndProduction` scrie `studyValue` și `remainderValue` pe **ambele** căi de retur, inclusiv cea timpurie: altfel un apelant care prețuiește o zi primește `undefined` exact la clădirile care n-au produs nimic — cazul pe care cel mai mult vrea să-l vadă.
> - **Garda de stocare, în repo-ul soră, înainte să existe ceva permanent:** `rev` e un contor PER-DISPOZITIV, deci un tab vechi poate sta la un rev mai mare decât cloud-ul doar fiindcă a bifat mai multe zile local. **Schema bate rev-ul, în ambele direcții.** Fără asta, al doilea tab dă gratuit respec-ul pe care un jurământ permanent îl interzice.
> - Test nou care leagă `DayForecast` de `DayEconomyResult`: proiecția e copiată de mână, deci un câmp adăugat la rezultat și uitat acolo e invizibil în topbar cu typecheck verde — exact cum a driftat prognoza de două ori.
> - Verificat pe viu pornind dintr-un save VETERAN (echipă L3, 61 de zile lucrate, fără catastif): „casa asta nu ține încă niciun catastif" → 3 zile / 100% monedă → tras Research% la 40 și focusul la 40 → **53% monedă · 23% marfă · 25% studiu · 45 făcute**. Exclusivitatea se vede pe un ecran. Mâinile scoase: două zile fără nicio mișcare în catastif. Reload: totul supraviețuiește.
> - `SAVE_SCHEMA` 8 → 9. 549 teste verzi (31 noi), contrast 6,28, zero overflow la 375px.

**Task Completed (Populație — felia 2: echipa învață)**
> Prompt: „continua"
> Model: Claude Opus 5
> - **Nivelul e DERIVAT dintr-un contor monoton** (`population.work[buildingId]`), niciodată stocat: ce nu se scrie nu se poate scrie greșit și nu cere migrare. Creditat de TICK, nu de zi, deci o recuperare offline de 24 de zile creditează fiecare zi exact o dată (aceeași formă ca blocul de duty).
> - **Ce cumpără nivelul e VALOAREA muncii, niciodată mâini eliberate.** Eliberarea de mâini ar fi a doua plată pentru aceeași postare, denominată exact în resursa pe care feature-ul o face rară — și plătită de calendar, nu de o alegere. Cuprul e mărginit de clampul agregat; sufletele nu sunt mărginite nicăieri.
> - **Nivelul NU se resetează** când scoți mâinile. O mină își știe filoanele; resetarea ar pedepsi exact micromanagementul pe care feature-ul îl lasă liber și ar rupe monotonia care face nivelul derivat sigur.
> - **Abaterea de la plan, deliberată:** planul cerea ca ziua să conteze doar dacă s-a produs MARFĂ. Am scos regula aia — o moară pe 100% monedă își produce toată valoarea și n-ar fi învățat nimic, ceea ce nu poate explica nimeni. Regula livrată e **dovadă de muncă pe oricare din cele trei canale** (monedă, marfă, studiu). Grija reală a planului rămâne acoperită: o zi care n-a produs NIMIC nu creditează nimic. Iar `!blocked` NU e testul — `blocked` se pune doar înăuntrul lui `items > 0`, deci o clădire pe 100% monedă nu e niciodată „blocată" și gardul ăla s-ar cumpăra cu sliderul de focus.
> - `hands > 0` explicit lângă pragul de jumătate: fără el, `0 >= ceil(0.5 × 0)` e adevărat și fiecare clădire fără echipă ar aduna tăcut zile.
> - **Plafonul lui `perLevelBonus` e ÎNCRUCIȘAT**, nu pe el însuși: ce trebuie să rămână sub tavan e `staffBonus × levelMult(maxCrewLevel)`, iar oricare din celelalte două manete poate fi urcată separat.
> - Toate ramurile hidratării scriu toate câmpurile — un oraș creat și unul hidratat trebuie să aibă aceeași formă (`emptyLegion` a învățat-o pe pielea lui).
> - Verificat pe viu: ziua 20 a promovat moara la **Crew L2**, `×1.50 → ×1.63`, delta **750 → 813c/zi**; scoase mâinile, badge-ul rămâne și delta cade la 500; un fierar plin fără fier n-a primit nicio zi. La L4 cu echipă plină: `×1.88`, sub tavanul de ×2,00.
> - `SAVE_SCHEMA` 7 → 8. 535 teste verzi (17 noi), contrast cel mai prost 5,54 / 6,28, zero overflow la 375px.

**Task Completed (Populație — felia 1: un singur rezervor, ori la muncă, ori sub arme)**
> Prompt: „continua cu felia 1" (după decizia „recrutarea sa consume populatie si economia primeste un boost")
> Model: Claude Opus 5
> - **O sută de suflete îți încadrează domeniul SAU îți umple barăcile, niciodată amândouă.** Recrutarea nu mai e „am destui bani?" (un levy costă 100c dintr-o vistierie de 100.000c — banii n-au fost niciodată decizia), ci „pe care motor îl înfometez".
> - **Fără catalog de joburi: clădirea E jobul.** Omul de la mina de fier e miner fiindcă mina e mină. O listă `JOB_TYPES` ar fi cerut matrice de legalitate, a doua hidratare cu rezolvare de id-uri și al doilea ecran — și toate trei proprietățile cerute se livrează fără ea.
> - **Bonusul intră în `basePerDay`**, lângă nivel și `outputMult`, ÎNAINTE de research: o echipă completă dă +50% și la monedă, și la marfă, și la studiu, cu o singură regulă de învățat. Niciodată sub 1 — un factor 0 ar trece prin gardul `!basePerDay` și ar anula tăcut sliderul de Research%.
> - **Capcana FATALĂ prinsă înainte de prima linie:** dacă populația ar fi crescut din grânar, ar fi fost CUMPĂRABILĂ. FOOD e marfă de piață la 50c în ambele sensuri, fără spread și fără stoc. Creșterea mănâncă **doar hrana produsă azi**, însumată din defalcarea zilei — deci plafonul e ferma, exact unde designul pretindea că e. Verificat pe viu: 500 de hrană cumpărate n-au făcut niciun om.
> - **A doua capcană:** postările NU stau pe `Building`. `econ.buildings` e singura felie fără hidratare, iar un build de dinainte de 16.08 ar fi șters `population` și ar fi păstrat `buildings[].workers` — jumătatea supraviețuitoare ar fi făcut `idle` negativ pentru totdeauna. Într-o singură cheie, un build vechi le pierde pe amândouă odată și save-ul degradează la „toată lumea e acasă".
> - **Ledger sincron pentru recrutare:** e singura cale care scrie trei felii, și doar una poate refuza. Un updater care refuză acolo ar produce soldați plătiți din nimic, deci ledgerul e invarianta și updater-ul de suflete e necondiționat. La postare e invers — o singură felie, deci cureaua stă în updater.
> - Numerele, calibrate pe valorile reale: 60 de suflete la start (sub cele 80 de locuri din barăci, ca prima recrutare mare să REFUZE și refuzul să fie tutorialul) · 138 de posturi în domeniul complet · o mână la echipă plină valorează 83c/zi la moară și 417c/zi la armurărie (bandă de 5×, nu de 40×) · o fermă la 22,9 hrană/zi susține exact o naștere.
> - Verificat pe viu tot lanțul, inclusiv migrarea unui save real de ziua 527 fără cheia `population`: primește `60 + 14 + 24 = 98` de suflete, toate acasă.
> - `SAVE_SCHEMA` 6 → 7. 518 teste verzi (37 noi), contrast cel mai prost 5,54 (light) / 6,28 (dark), zero overflow la 375px.

**Task Completed (Minter: o clădire care face doar bani n-are ce împărți)**
> Prompt: „minter-ul, din moment ce doar face bani, ca produs, ar trebui sa aiba doar slider de research"
> Model: Claude Opus 5
> - Andrei are dreptate, și e mai rău decât un slider inutil: **sliderul monedă/marfă ARDEA producția Minter-ului.** N-are item de făcut (`options: []`), deci partea lăsată pe marfă nu devenea nimic — se anula. Pe un domeniu cu Minter la 40% asta însemna **4.800c/zi distruși**, iar ecranul îți explica politicos „the other 60% is DESTROYED — set its focus to 100% coin": o interfață care își cere scuze pentru un control care n-ar fi trebuit să existe.
> - Regula e **generală, nu un caz special pe nume**: `hasNoItemToMake(type)` întreabă tabelul de output, nu o listă de clădiri. O clădire adăugată mâine fără item de făcut moștenește regula în loc să-și ardă tăcut producția.
> - Studiul rămâne neatins — se ia tot de deasupra. Verificat pe viu: 8.000c/zi la 0% studiu, 4.800c/zi + 64 studiu/zi la 40%.
> - **Cod mort scos:** ramura care topea SILVER_INGOT în monedă nu putea rula niciodată (fără item ⇒ `items` mereu 0). Ștearsă, nu cârpită — argintul are deja două ieșiri (costuri de research și piața).
> - Fără câmp nou în save ⇒ fără `SAVE_SCHEMA++`. Saveurile existente cu Minter prost reglat se repară singure la prima zi.
> - Moara de cherestea, pe același ecran, a rămas exact cum era: două slidere, „40% Coin". 481 teste verzi.

**Task Completed** cu timestamp, prompt exact, model
- Roadmap-ul e updatat la fiecare sesiune
- Format timestamp: `YYYY-MM-DD HH:MM`

---

## 🚀 Active Roadmap & Backlog

### ⚔️ NORTH STAR: unitățile devin LEGIUNI (cerut de Andrei, 2026-08-15)

> „vreau ca fiecare unitate sa capete identitate ... ceva care sa semene cu legiunile Romane, cu traditii si compozitie unice, mai aproape de legiunile din Warhammer 40k. Dar in universul nostru"

**Vasul EXISTĂ deja și nu l-a numit nimeni.** `Unit.id` supraviețuiește la tot ce li se întâmplă oamenilor dinăuntru: completarea de efective îi schimbă, lupta îi omoară, promovarea le schimbă rangul — unitatea rămâne. Asta E proprietatea de legiune (vulturul supraviețuiește legionarilor). Identitatea nu cere un sistem nou; cere să **numim și să ținem minte** ceva ce deja persistă.

**Ce distruge identitatea azi, și trebuie să capăte ceremonie:**
- `mergeUnits` (units.ts) amestecă bucket-urile și un id **dispare fără urmă**
- `splitUnit` face două unități dintr-una — care dintre ele păstrează numele?
- `disbandUnit` varsă oamenii înapoi în rezervor fără niciun cost simbolic

**Blocantul structural real: `Unit.type` e UN SINGUR `SoldierType`.** O legiune romană sau una din 40k e prin definiție **arme combinate**; azi o unitate e numai sulițași SAU numai arcași. „Compoziție unică" cere cohorte de tipuri diferite sub același steag — și asta atinge `unitToCombatant`, `demandFor`, `createUnitFromBarracks`, motorul de luptă **și copia lui server din `functions/src/warlordCombat/`**. De aceea e ultima felie, nu prima.

**Ordinea propusă (ieftin → scump):**
1. **Numele și memoria.** `Unit` primește `name`, `foundedDay`, `honours[]`. Bătăliile scriu onoruri. Merge/split/disband capătă ceremonie: cine absoarbe pe cine, detașamentul care poartă numele părintelui, desființarea ca decizie gravă. **Zero atingeri la motorul de luptă.**
2. **Tradițiile.** Se leagă de „doctrine→tradiții" din roadmap-ul de research: cercetarea deblochează doctrine, o legiune **adoptă** una-două. Fiecare dă un bonus **ȘI o constrângere** (o legiune jurată zidului de scuturi refuză cavaleria). Constrângerea e ce transformă un buff în identitate.
3. **Stindardul.** Identitatea ca obiect fizic: se poate pierde în luptă și recuceri. Se prinde în rezultatul bătăliei, care există deja.
4. **Cohortele (compoziția).** `Unit.type` → cohorte mixte. Felia scumpă, atinge și PvP-ul server.

**De decis cu Andrei:** cine dă numele (jucătorul, cu sugestie de la joc — recomandarea mea: atașamentul vine din a numi tu) și câtă lume proprie scriem (azi nu există lore, doar medieval generic).


### 🔬 Research legat de lume — plan pe 4 felii (decis cu Andrei, 2026-08-01)
**Felia 1 ✅ LIVRATĂ** (vezi Session Log): clădirea **Scriptorium** ca poartă a cercetării + cerințe de infrastructură per tehnologie (`TechDef.requiresBuildings`, tip + nivel).

**Modelul agreat pentru feliile următoare** — progresul nu mai e o numărătoare de zile, ci **Studiu, resursă produsă zilnic**:
- **Felia 2 — Studiu ca producție.** ✅ **NUCLEUL LIVRAT 08.08** (rezervoare + slider Research%). RĂMASE ca **felia 2b**: fondurile (bani → Studiu, randament descrescător, plafon zilnic) și materialele dedicate. Rezervoare pe ramuri (Economy/Army/Campaign/Doctrine), alimentate de Scriptorium (nivel) + clădirile relevante fiecărei ramuri. **Fiecare clădire primește un al treilea slider: Research%**, care ia din producția curentă (monede vs. iteme) — logica lui Andrei: o clădire contribuie la cercetare fie prin resursele ei, fie prin timpul dedicat studiului în locul producției. Plus: **fonduri** (bani, randament descrescător, plafon zilnic) și **materiale dedicate** (pachet de resurse ⇒ multiplicator temporar pe proiectul activ).
- **Felia 3 — Oameni.** Două roluri DISTINCTE: (a) **Head of Research / erou** — unul singur, permanent, care ridică șansa zilnică de *big leap* (salt mare de progres), influențată și de domeniul cercetat; (b) **experți angajați per proiect** — salariu zilnic în bucla de upkeep + **randament dramatic descrescător dacă îngrămădești mai mulți pe același domeniu** (cerință explicită Andrei), tot cu trăsături (Pedant / Alchimist / Veteran de campanie).
- **Felia 4 — Consecințe.** Probe de teren (tehnologiile militare cer o bătălie purtată), eșecuri și eureka legate de buff-ul `BREAKTHROUGH` existent, și **deblocările din Doctrine să blocheze ceva real** (`GRAND_ARMORY`, `ELITE_DRILL` sunt azi promisiuni goale).
- **Felia 5 (viziune Andrei, de detaliat) — Doctrine & Tradiții.** Jucătorul *impune* o doctrină; dacă o ține destul de mult, ea *naște o tradiție* permanentă (ex. Apprenticeship). Direcția: un sistem prin care jucătorul își personalizează regatul, nu doar un arbore de bonusuri. De proiectat separat, după felia 3.

**Ce înseamnă trecerea de la zile la Studiu pentru restul producției** (întrebarea lui Andrei): tick-ul zilnic rămâne neatins — ziua e în continuare unitatea de timp pentru venituri, upkeep, hrană, loturi de antrenament și campanie. Se schimbă DOAR contorul unui proiect de cercetare: din „mai ai 3 zile" în „mai ai 120 de Studiu". Singura cuplare economică reală e sliderul Research% pe clădiri — acolo cercetarea chiar CONCUREAZĂ cu monedele și itemele, ceea ce e și scopul.

### 🎨 Revamp UI/UX + temă dark (CERUT de Andrei, 2026-08-01 — următorul lucru mare)
> Motivul, în cuvintele lui: *„ma dor ochii incercand sa testez, dar sa mai si joc"*. Deci nu e cosmetică — e condiție ca jocul să poată fi testat și jucat sesiuni lungi.

**Cauza directă a durerii de ochi:** jocul NU are temă dark, iar embed-ul o dezactivează explicit. `OurDaysApp/src/screens/Warlord.tsx` învelește jocul în `bg-white text-zinc-900 [color-scheme:light]` tocmai pentru că tot Warlord-ul folosește clase Tailwind deschise, fără variante `dark:`. Rezultat: chiar dacă OurDaysApp e pe dark, Warlord rămâne o placă albă pe tot ecranul. Lacătul ăsta se scoate ULTIMUL, după ce jocul chiar suportă dark.

**Observații concrete (din sesiunea de testare + captura de pe ziua 159):**
- **Suprafețe albe uriașe** — pagină albă + carduri albe, nimic pe care să se odihnească ochiul; contrast maxim pe toată suprafața, ore în șir.
- **Costurile sunt șiruri de iconițe fără etichetă** — „🪙1 ⚙50 ▪40 ◪4 3d". Nu poți învăța ce e fiecare pictogramă, nu există tooltip, iar badge-ul de zile arată exact ca încă o resursă.
- **„Cannot afford" nu spune CE lipsește** — buton gri, mort, fără „îți mai trebuie 30 Iron / 2 zile". Aceeași informație există deja în state, doar nu e arătată.
- **Tehnologiile blocate (🔒) diferă de cele disponibile doar prin opacitate** — la fel și ierarhia T1/T2/T3, redusă la un badge mic în colț.
- **Antetul e înghesuit** pe un singur rând: Day / Load / Reset / numărătoare / Pause Auto / Run Day. `Reset` (distructiv) stă lipit de `Load`, în linia principală.
- **Bara de taburi = 9 pastile plate**, fără iconițe și fără grupare; tabul activ e un bloc negru greu. La 9 taburi ar trebui grupare (Domeniu / Militar / Extern) sau iconițe.
- **Codul de culoare pe ramuri nu coboară în arbore** — Economy/Army/Campaign/Doctrine colorează doar cardurile T1; T2/T3 sunt gri, deci culoarea nu mai ajută la orientare exact acolo unde arborele devine complex.
- **Panoul de Momentum ocupă o casetă mare ca să spună „nimic încă"** — spațiu care ar trebui să se contracte când e gol.
- **Ierarhie tipografică plată** — titlu, cost, descriere și buton au greutăți apropiate; ochiul nu are unde să intre în card.
- **Log-ul e un dump brut** cu timestamp complet pe fiecare linie; fără filtre (economie / luptă / cercetare) și fără grupare pe zile.
- **Nemăsurat pe telefon** — layout `max-w-6xl` fix și grile de 4 coloane, deși aplicația-mamă e PWA/Capacitor și se deschide pe telefon.
- **Panoul de admin** are aceeași problemă: liste lungi de câmpuri, tot pe alb, fără secțiuni pliabile.

**Fundația tehnică (înainte de orice ecran):** jocul folosește clase Tailwind stock peste tot, deci soluția NU e să presar `dark:` prin 30 de fișiere, ci un set de **tokenuri semantice** (suprafață / suprafață-ridicată / text / text-slab / accent / avertisment) definite o dată și folosite de toate componentele. Abia apoi tema dark e o a doua valoare per token.

**Constrângeri de care să ții cont:**
- Cele **2 copii identice** (`games/warlord/src` ↔ `OurDaysApp/src/warlord`) — orice pasă de temă se aplică în ambele și se verifică cu `diff -q`.
- Warlord e **English-only** prin decizie explicită, deci revamp-ul UI nu costă traduceri (spre deosebire de restul OurDaysApp).
- Adminul cere autentificare ⇒ e punct orb la randare; verificarea lui rămâne pe seama owner-ului.

**Decizii de luat cu Andrei înainte de implementare:**
1. Tema dark a jocului **urmează tema OurDaysApp** (isDarkMode/customThemeIsDark din store) sau are comutator propriu în antet?
2. Păstrăm direcția vizuală medievală (pergament, texturi, imaginile de clădiri) și o adaptăm la dark, sau trecem pe ceva plat/modern și lăsăm arta doar în modale?
3. Revamp pe felii (întâi tokenuri + dark peste tot, apoi ecran cu ecran) sau redesign complet al unui singur tab ca prototip, aprobat, apoi restul?

### În curs / Următor
- **Combat System (grid tactic)** 🔨 ÎN CURS — tab nou "Campaign", luptă tură-cu-tură pe grid; motor pur + determinist (RNG cu sămânță) reutilizabil server-side pentru PvP viitor; PvE acum + document design PvP (OurDaysApp)
- **PvP în OurDaysApp** — integrare Warlord ca joc în arcade-ul OurDaysApp (Cloud Function autoritativ pe același motor); design în `docs/PVP_INTEGRATION.md`, implementare sesiune viitoare
- **Upgrade clădiri** — `level` pe `Building`, bonusuri producție per nivel
- **Comandanți/Lideri** — unitate specială cu bonusuri (XP, training time)

### Completate în sesiuni anterioare (mutate din roadmap)
- Unit Upkeep zilnic, Sistem Hrană (FOOD/FARM), Morale & Oboseală, Sistem Evenimente aleatorii

### Backlog
- **Rute comerciale pasive** — vânzări automate zilnice din Market
- **Tech Tree** — cercetare cu resurse + timp

---

## ✅ Features Completate

### Sistem de bază (pre-sesiune 1)
- Economy loop: clădiri → producție pasivă → wallet
- Resurse: WOOD, STONE, ORE, COAL, ingots
- Barăci: recrutare, antrenament batches, conversie tip/rang
- Unități: split, merge, replenish, training XP
- Market: cumpărare/vânzare echipament și resurse
- Save/Load localStorage
- Sistem modding (Registry)

---

## 📅 Session Log

### Session 4 — 2026-08-01

**2026-08-17 - Task Completed (comandantul: singura piesă a unei legiuni care se poate MUTA)**
> Prompt: „continua cu comandantul"
> Model: Claude Opus 5
> - **De ce nu e a doua tradiție.** O tradiție e permanentă, instituțională și legată de legiunea ei pe viață. Un comandant e opusul tuturor celor trei: **muritor, personal, și transferabil**. **Comandantul e piesa pe care o poți muta; tradiția e cea pe care nu.** Aia e decizia pe care feature-ul o creează: comandantul tău încercat stă cu legiunea care l-a făcut, iar mâine altă legiune e cea care trebuie să câștige.
> - **Oastea îl face pe om.** Trăsătura NU se alege — se derivă din ce făcuse legiunea în ziua în care l-a ridicat, același principiu ca dovada purtată de o piesă din paletă, și din același motiv: orice alege jucătorul liber, alege ca să-i convină, iar legătura cu ce ESTE legiunea se evaporă. **Verificat pe viu:** legiunea cu 400 de zile de gardă ar ridica **un Warden**, cea cu victorii și fără gardă **un Victor** — și scrie asta pe ecran **înainte** să plătești, ca nimeni să nu descopere ce i-a ridicat propriul palmares abia după.
> - **Zilele cântăresc mai puțin decât faptele**, altfel fiecare comandant din joc ar fi Warden până în luna a doua: o sută de zile pe zid e o carieră, o sută de victorii nu e un lucru care se întâmplă.
> - **E muritor, și DETERMINIST.** Cade la o înfrângere în care legiunea a pierdut peste jumătate din ce a pus în linie — momentul în care acoperea retragerea. Declanșator diferit de al stindardului (nimicire totală), ca să nu fie același eveniment cu două nume. Fără zar: o bătălie din jocul ăsta se rejoacă exact din sămânța ei, iar o aruncare de zar aici ar fi singura parte a unei bătălii rezolvate care nu s-ar putea rejuca.
> - **El nu răspunde niciunui jurământ:** ce valorează supraviețuiește unei tradiții adormite ȘI unui stindard pierdut. Exact asta îl face piesa spre care întinzi mâna când tot restul a mers prost. Dar **plafonul se aplică pe SUMĂ**, o dată, în același loc — un comandant peste o tradiție nu poate trece pe lângă un tavan pe care fiecare dintre ei îl respectă separat.
> - **Verificat pe viu, tot lanțul:** numire (−1g, trăsătură WARDEN derivată) → **mutare cu cariera intactă** (rang 3, nouă bătălii, +12 moral, iar legiunea care l-a făcut rămâne fără) → **cădere** la o înfrângere care a costat 70 din 80 („Aulus Verrus fell at Rival Baron. The Others is without a commander.").
> - Prins de tipuri, nu de mine: cele două locuri care cer canalele răspândeau `{...l}`, care duce `commander` ca **persoană** acolo unde se aștepta un set de canale. Acum o singură funcție de formatare, ca cei doi apelanți (o bătălie și o zi) să nu poată ajunge să nu fie de acord.
> - `SAVE_SCHEMA` 5 → **6**. **481 teste verzi** (34 noi).

**2026-08-17 - Task Completed (stindardul: identitatea ca obiect care poate fi luat)**
> Prompt: „continua cu stindardul"
> Model: Claude Opus 5
> - **Fără port-drapel, și asta e decizia.** Un port-drapel ar fi însemnat o corvoadă per bătălie („cine-l duce azi?"), un câmp de întreținut prin split/merge, și o regulă de re-explicat de fiecare dată când moare o cohortă. Stindardul cade când **FIECARE cohortă pe care legiunea a pus-o în linie e nimicită** — se derivă din raportul care există deja, n-are nimic de întreținut, și pică exact pe momentul care trebuie să doară. **O legiune care a păstrat o cohortă și-a păstrat vulturul:** aia e povestea și mecanica în același timp.
> - **Ce costă:** tradiția **DOARME**. Nu se retrage — o legiune nu încetează să fie ce a jurat fiindcă a fost bătută. Reutilizează suspendarea pe care `outOfKeeping` o avea deja, deci în joc există o singură idee numită „tradiția ta e adormită, uite de ce", nu două.
> - **Cum îl iei înapoi:** câștigi la misiunea care ți l-a luat, cu aceeași legiune. Un obiectiv găsibil și numibil, construit doar din fapte pe care bătălia le poartă deja.
> - **Nu e nimic de fermat, și e scris ca test:** pierderea costă o desfășurare întreagă, recucerirea îți dă înapoi ce aveai. De-aia mecanica n-are nevoie de plafon, de răcire sau de contor — bucla n-are direcție profitabilă.
> - **Verificat pe viu, toată bucla:** legiune de 6 oameni nimicită la Invasion → `standard: {lostTo:'INVASION', lostDay:400}` + linia din log · cardul spune unde e și că totul doarme · **fiecare buton de creștere și adâncire dezactivat cu motivul** · o ÎNFRÂNGERE la misiunea aia NU-l recuperează · o victorie acolo îl aduce acasă (`standard: null`, „won back its standard at Bandit Raid").
> - **Două lucruri pe care ecranul le spunea greșit, prinse uitându-mă:** butoanele de creștere rămâneau active (refuzul exista în state, dar ajungea doar în Log — aceeași regulă pe care o încălcasem la codul de tradiție); și „Worth now: 300c" contrazicea direct propoziția de sub el care zicea că totul doarme — acum scrie **„Would be worth"** cât timp e adormită.
> - O misiune pe care jocul n-o mai are se citește ca **niciun stindard pierdut** — altfel vulturul ar sta pe un câmp care nu poate fi luptat, iar tradiția ar dormi pentru totdeauna fără cale de întoarcere.
> - Contrast: motivul din paranteză de la „deepen" era 3,62:1 în dark pe tokenul mai șters — e un refuz de citit, nu o notă de subsol, deci a trecut pe `wl-bad` ca toate celelalte refuzuri din panou.
> - `SAVE_SCHEMA` 4 → **5**. **447 teste verzi** (18 noi).

**2026-08-17 - Task Completed (felia 4: forja — pași, adâncire, și o tradiție pe care o poți da mai departe)**
> Prompt: „continua cu felia 4"
> Model: Claude Opus 5
> - **Am început cu un defect al meu din felia 3:** `growBlocker` refuza o piesă deja luată cu „deepen it instead of repeating it" — iar jocul **nu avea** cum s-o adâncești. O instrucțiune care nu duce nicăieri e mai rea decât nicio instrucțiune. `deepenBlocker` plătește **diferența** de puncte dar cere dovada pentru **totalul nou**: pretenția care se face e cea adâncă, iar plata parțială ar lăsa o legiune să urce din treaptă în treaptă spre o cerință pe care n-a îndeplinit-o niciodată.
> - **Pașii se aleg la luare**, cu prețul și dovada actualizate live. Verificat: la 3 pași, Unbroken trece de la 3pt la **9pt**.
> - **Coduri de tradiție.** Ce face codul sigur nu e codificarea, ci **ce NU poate purta**: id-uri de piese, număr de pași, legături de părinte ca POZIȚII, cererile, două șiruri. **Niciun preț, niciun prag, niciun plafon** — toate se recalculează din paleta celui care importă. Deci o tradiție umflată **nu e reprezentabilă**, nu ceva de detectat și respins. Cine editează un cod de mână poate produce una ilegală (refuzată cu motiv) sau alta legală — niciodată una mai puternică.
> - **Regula pe care o poartă mecanismul: poți primi o tradiție, niciodată o istorie.** Codul aduce promisiunea — nume, crez, cereri — și un arbore GOL. Verificat pe viu: dătătorul avea Spoils la 4 trepte, primitorul a rămas cu `nodes: []`. Arborele tot trebuie crescut de legiunea aia, din faptele ei.
> - **Sumă de control de patru caractere** — nu securitate (n-are ce falsifica), ci cazul obișnuit: un cod căruia i s-a pierdut coada la wrap-ul unui chat s-ar decoda altfel într-o tradiție mai mică, legală la vedere, și ar fi acceptat tăcut. Verificat: cod trunchiat → refuzat, legiunea rămâne nejurată.
> - Un cod ilegal e refuzat **în cuvintele validatorului**, nu cu o eroare de import mai vagă — cele două uși spun același lucru.
> - **Reparat pe drum:** refuzul codului apărea doar în Log. Acum se decodează în timp ce tastezi, motivul stă lângă buton, iar un cod bun își arată promisiunea înainte s-o juri: *„The Unmoved" — never horsemen · at most 9 cohorts*.
> - Contrast: linia care explică pașii era 3,62:1 în dark pe tokenul mai șters — e instrucțiune, nu decor, deci a trecut pe `wl-muted`. Fără overflow la 375px, fără ținte sub 28px.
> - **429 teste verzi** (20 noi).

**2026-08-16 - Task Completed (felia 3: arborele — tradiția devine ceva ce CREȘTI, nu ceva ce alegi)**
> Prompt: „continua cu felia 3"
> Model: Claude Opus 5
> - **Catalogul de patru a dispărut.** O tradiție e acum un **arbore mic** pe care legiunea îl crește: **NIVELUL** spune cât de ADÂNC poate ajunge, **DOVADA** spune CARE atribut, **PUNCTELE** spun cât. Trei porți diferite ca fel — o legiune care doar luptă are adâncimea dar nicio dovadă de caracter; una care doar stă de gardă are dovada și n-are adâncime.
> - **Descoperire pe drum care a scos un concept întreg din cod:** dacă atributele se adaugă **pe rând, când le poți lua**, atunci *a proiecta* arborele și *a-l crește* sunt același lucru. Nu mai există listă separată de „câștigate": un nod există în design **fiindcă a fost luat**. Asta e literal „un tree de atribute pe care le dezvoltă o legiune", și omoară o clasă de bug în care cele două liste se contrazic.
> - **Dovada e proprietatea PIESEI, niciodată a designului.** Un atribut care plătește pentru călăreți uciși cere călăreți uciși. Dacă autorul ar alege dovada, ar alege-o pe cea îndeplinită deja, iar „exersează acțiuni relevante" s-ar evapora într-o formalitate. **Verificat pe viu:** o legiune cu 40 de zile de garnizoană și 4 poziții ținute primește oferite fix Steadfast, Unbroken și Spoils; celelalte șapte refuzate cu ce anume îi lipsește („Needs 20 days on patrol, has 0").
> - **Designul nu conține NICIUN număr** — id-uri de piese, câți pași, ce atârnă de ce, două șiruri. Toate prețurile, pragurile și plafoanele se recalculează local, deci **o tradiție umflată nu e reprezentabilă**, nu doar refuzată.
> - **REPREŢUIREA, prima** (constatarea măsurată acum două felii): moralul a devenit **PRAG DE JOS** — nu se poate irosi la 100, și contează exact după un măcel. Multiplicatorul de XP de luptă **a fost șters**: plafonul îl mănâncă și e pe dos, plătind exact cohortele care ucid mai puțin. Învățatul s-a mutat unde plafonul nu ajunge — **în curtea de instrucție și în înfrângere**. Cinci canale, toate în locuri care existau deja.
> - **Refuzul cererilor care nu cer nimic**, jumătatea care ține autoratul în picioare: `MAX_COHORTS 12` nu refuză nimic (12 e deja plafonul), `MIN_COHORTS 1` se îndeplinește existând, `SHARE 1%` cu o cohortă din o sută. Fără podelele astea, un jucător autorează douăsprezece atribute în spatele a douăsprezece promisiuni gratuite.
> - **Testul de expresivitate și-a făcut treaba de DOUĂ ori**, și de fiecare dată reparația a fost **regula, nu datele**: „rebate ≤ 60% din total" refuza Shieldwall (regulă gândită pentru un arbore autorat dintr-o dată — la unul crescut incremental pedepsește creșterea lentă → plafon absolut); iar „fiecare fel de cerere o dată" refuza Iron Vow, care neagă și călăreți și arcași — două promisiuni diferite, nu una repetată.
> - **Migrarea rulează ÎN `hydrateLegion`.** Verificat pe viu: `tradition: 'SHIELDWALL'` a devenit un design complet cu constrângeri și două noduri, păstrând ziua jurământului (12). Cele patru trăiesc acum ca **date** în `traditionLegacy.ts`, importate de nimic altceva. Un design care nu mai validează se **păstrează marcat `invalid`** — un id de catalog e proprietatea jocului, un design e autorul jucătorului.
> - **Două lucruri pe care ecranul le spunea greșit, prinse uitându-mă:** fiecare nod își afișa pragul ca și cum ar fi al lui, deși canalul se **adună** (20 și 12 fac 32 — al doilea citea ca fiind mai slab); nodurile spun acum ce **adaugă**, iar panoul spune **totalul**. Și un enum brut scăpase în tooltip („Needs 2 heldTheLine").
> - Ținte de atins de 17px la selectorul de părinte — reparate. Fără overflow la 375px, ambele teme.
> - `SAVE_SCHEMA` 3 → **4**, și e primul bump care **nu e aditiv**: `Legion.tradition` s-a schimbat din șir în obiect, deci un build vechi l-ar citi ca id necunoscut și l-ar anula. Exact cazul pentru care există garda.
> - **409 teste verzi** (51 pe tradiții).

**2026-08-16 - Task Completed (felia 2: îndeletnicirile de pace — a doua fântână)**
> Prompt: „continua cu felia 2"
> Model: Claude Opus 5
> - **Problema e de aritmetică, nu de aromă.** Domeniul are voie la **o luptă pe zi**, deci toate contoarele hrănite de bătălii se trag dintr-o singură fântână: calendarul. Ridici opt legiuni și nu primești progres de opt ori — primești o luptă pe zi, iar jocul optim e să trimiți cele mai tari cohorte, care stau într-o singură legiune. Aia adună tot, iar celelalte șapte se deosebesc doar prin nume.
> - **Regula care ține felia: BĂTĂLIILE CUMPĂRĂ ADÂNCIME, ÎNDELETNICIRILE CUMPĂRĂ DIRECȚIE.** Zilele de serviciu sunt **palmares, niciodată renume** — o zi se obține AȘTEPTÂND, iar ceasul zilei chiar retro-creditează o absență, deci orice ar putea cumpăra o zi s-ar cumpăra lăsând tabul deschis. O legiune care doar stă de gardă rămâne nivel 1; una care doar luptă are nivelul dar nicio dovadă de caracter. Ai nevoie de amândouă — **ăsta e literal „nivel ȘI exersare" din corectura lui Andrei.**
> - **Trei îndeletniciri, alese ca trei FORME ECONOMICE, nu trei nume:** garnizoană (ieftină, moralul se reface de două ori mai repede), tabără de instrucție (scumpă, cohortele se antrenează), patrulare (**îți aduce** bani din vamă). O a patra care ar fi fost doar un al patrulea nume ar fi adăugat un contor și nicio decizie.
> - **Niciun canal nou.** Instrucția refolosește exact calea de XP care există (`u.training || drilling.has(u.id)` — `||`, nu `+`, ca o cohortă deja la antrenament să nu fie plătită de două ori). Garnizoana adaugă la recuperarea de moral **pe aceeași condiție** ca ea: oameni după ziduri care nu sunt plătiți și hrăniți nu se odihnesc mai bine.
> - **Ocuparea E prețul**, și e verificată în `startBattle`, nu doar în ecran — o regulă care trăiește într-un singur ecran are atâtea găuri câte locuri o cheamă.
> - **Verificat pe viu, o singură zi, trei legiuni de câte 100:** moral 50 → **60** la garnizoană vs 55 la celelalte · XP 10 → **35** doar la instrucție · contoare 1/1/1 · în log `Duty 3s` (100×1 + 100×4 − 100×2 = 300c). Desfășurarea: **toate cele trei legiuni refuzate**, cu motivul pe buton ȘI pe ecran.
> - **Gol prins pe drum:** butoanele de legiune erau dezactivate, dar cohortele individuale rămâneau selectabile — `startBattle` refuza corect, dar refuzul apărea abia în Log. Acum sunt dezactivate și ele, cu marcajul „· on duty".
> - **Capcană de contrast plătită:** `disabled:opacity-60` pe cardul de cohortă compunea textul în jos și ducea „· on duty" — singurul cuvânt care explică refuzul — la **3,09:1** în light. Starea dezactivată o poartă acum suprafața și cursorul; cuvintele își păstrează contrastul. **3,09 → 5,65.**
> - `SAVE_SCHEMA` 2 → **3** (`Legion.duty`). **392 teste verzi** (16 noi).

**2026-08-16 - Task Completed (felia 1: ce a FĂCUT o legiune, și nivelul care iese din asta)**
> Prompt: „continua cu felia 1"
> Model: Claude Opus 5
> - **Două registre ținute separat, și asta e toată ideea.** **Renumele** (ce cumpără nivel) vine DOAR din ce nu se poate obține gratis: victorii, întoarceri nesângerate, poziții ținute cu preț, misiuni grele. **Palmaresul** (bătălii, înfrângeri, retrageri, uciși pe clase, promovări) se ține minte și va fi dovada pe care o cere un nod de tradiție, dar **nu dă nivel**. Fără separarea asta, „nivel" ar fi doar alt cuvânt pentru „timp petrecut".
> - **Nivelul e DERIVAT, niciodată stocat.** Ce nu se scrie nu se poate scrie greșit, nu cere migrare, și nicio editare de save nu-l umflă fără să umfle un registru pe care hidratarea îl plafonează oricum.
> - **Cele trei ferme, închise și verificate PE VIU, nu doar în teste:**
>   1. **Cohorta simbolică.** 5 oameni lângă o oaste de 400: legiunea „The Mascots" a primit **exact nimic**, cu motivul în log — „held 1% of the line — a legion is credited from 25%". Fără regula asta, ea lua aceeași victorie ca cele 8 cohorte care au sângerat, **și** lua „fără pierderi" fiindcă nimeni n-a ajuns la ea.
>   2. **Retragerea.** `abandonBattle` rezolvă o bătălie în care nu s-a dat nicio comandă — zero pierderi, zero cost. Pornit și retras imediat: singura schimbare a fost `retreats: 1`, **renumele a rămas 8 → 8** și `battles` neatins. Două clicuri pe zi nu mai cumpără un nivel.
>   3. **Plafonul per bătălie.** Un măcel a dat `slain: 200`, plafonat — un masacru nu e o specializare.
> - **Creditul merge la legiunea care A MĂRȘĂLUIT**, dintr-un instantaneu luat la desfășurare (`campaign.marchedLegions`). Ambele taburi sunt montate simultan, deci fără el un jucător care vede măcelul venind își putea rearanja cohortele înainte să culeagă rezultatul și muta creditul pe o legiune care n-a fost acolo. **Efectele** rămân rezolvate live (fereastra e o bătălie, efectul e trecător); **palmaresul e permanent, deci ia instantaneul.**
> - `abandonBattle` rulează în sfârșit și `pruneMembership` — n-a scris niciodată nimic în legiuni, deși și înaintea unei retrageri pot muri cohorte.
> - Uciderile se numără **pe clasa a ceea ce a fost ucis** (călăreți / arcași / infanterie grea), dintr-o singură trecere prin log-ul bătăliei. Un arcaș călare intră la ambele, fiindcă e ambele. Asta e materia primă pentru „ai voie la Spărgători de cai când ai spart cai".
> - `SAVE_SCHEMA` 1 → **2** (`Legion.practice`, `CampaignState.marchedLegions`) — exact regula scrisă ieri, aplicată prima dată.
> - Reparat pe drum: „1 battles" era o mașină vorbind. `DEED_LABEL` are acum ambele forme.
> - Contrast: cel mai prost 4,51:1 (dark) / 4,67:1 (light), fără overflow la 375px. **376 teste verzi** (35 noi).

**2026-08-16 - Task Completed (felia 0: save-ul nu mai poate fi mâncat de un tab vechi)**
> Prompt: „traditiile nu inlocuiesc nivelul, ele sunt un tree de atribute ... vreau sa fie ceva ce userii creeaza" (constatare ieșită din analiza adversarială a redesign-ului; verificată de mine la sursă înainte s-o cred)
> Model: Claude Opus 5
> - **Gaura, în lanț:** blob-ul de save e un **literal fix de 14 chei** (`useGameState.tsx:143`), fără versiune și fără trecere-mai-departe a cheilor necunoscute; fiecare slice hidratează pe listă închisă; jocul **n-are cale de auto-actualizare** (notat deja la ceasul zilei — tab vechi = cod vechi la nesfârșit); iar `warlordCloud.ts:61` adoptă strict după `rev` și **incrementează `rev` la fiecare scriere**. Deci: tab vechi → hidratează save nou → aruncă tăcut ce nu știe → scrie trunchiat → urcă `rev` → împinge în cloud → celălalt dispozitiv adoptă versiunea ciuntită. **Zero erori nicăieri.** Nu e un risc al tradițiilor: **legiunile livrate ieri erau deja expuse.**
> - **Două apărări, diferite ca fel.** (1) Un build care deschide un save ștampilat mai NOU **refuză să persiste**, total — ce n-a putut hidrata lipsește deja din memorie, deci orice scriere ar fi o trunchiere. (2) Cheile de nivel superior necunoscute sunt **purtate mai departe** prin ciclul de salvare, ca plasă pentru cazul în care cineva adaugă o cheie și uită bump-ul.
> - **Ce NU poate face, spus pe față:** nu protejează retroactiv. Build-urile de dinainte n-au ce verifica. Gaura se închide pentru tab-urile de la build-ul ăsta încolo, și fiecare zi în care nu era livrat însemna încă un build care n-o să învețe niciodată să se dea la o parte.
> - **O ștampilă stricată se citește ca VECHE, niciodată ca nouă** (`schema: 'nine'`, `NaN`, negativ) — refuzul de scriere e efectul greu, deci cere un număr real; altfel o greșeală de tastare ar zăvorî un jucător în afara regatului lui.
> - Refuzul e un **banner deasupra a tot, nedemisibil** — nu o linie în Log. Jocul continuă să se joace în memorie; tăcerea aici s-ar citi ca joc funcțional exact până când închizi tab-ul și constați că lipsește o după-amiază.
> - **Verificat pe viu, ambele jumătăți:** save cu `schema: 99` + o cheie din viitor → ecranul trece la ziua 556, iar save-ul stocat rămâne **neschimbat octet cu octet** (ziua 555, `schema: 99`, cheia din viitor intactă). Save normal cu o cheie necunoscută → se scrie normal, se ștampilează `schema: 1`, iar **cheia necunoscută supraviețuiește scrierii**.
> - Contrast pe banner: 12,66:1 (dark) / 14,03:1 (light), fără overflow la 375px. 341 teste verzi (13 noi).
> - Regula e în `CLAUDE.md`: **orice câmp nou în save cere `SAVE_SCHEMA++`.**

**2026-08-16 - Task Completed (tradițiile: un bonus care refuză ceva)**
> Prompt: „continua cu traditiile"
> Model: Claude Opus 5
> - **Ideea feliei:** un bonus fără constrângere nu diferențiază nimic — toată lumea îl ia, toate legiunile converg, iar „tradiție" devine alt cuvânt pentru „nivel". Constrângerea e ce face ca două legiuni să NU poată fi aceeași legiune. Patru tradiții, fiecare refuză altceva: **The Shieldwall** (fără călăreți, ≥50% infanterie grea), **The Wind's Own** (numai călăreți, maximum 6 cohorte), **The Long Watch** (fără călăreți, ≥50% arcași), **The Iron Vow** (nici călăreți nici arcași, ≥8 cohorte).
> - **Constrângerea e de DOUĂ feluri, și tratarea lor la fel ar minți.** Interdicțiile sunt monotone (le încalci doar adăugând) → se verifică la intrare și **refuză**, în `joinBlocker`, unicul punct prin care trece orice atribuire. Cerințele de proporție se pot strica fără să faci nimic — îți moare o cohortă în luptă — deci nu refuză nimic și **nu retrag jurământul**: **suspendă bonusul** până readuci legiunea în formă, cu cifrele reale pe ecran („needs 1 of 1 cohorts to be heavy foot, has 0"). Disciplină, nu confiscare.
> - **Efectele se evaluează pe armata care A PLECAT**, nu pe cea care s-a întors: o legiune care a pierdut o cohortă ÎN lupta asta a luptat-o în formă, iar evaluarea de după i-ar lua bonusul pentru pierderea pe care tocmai a suferit-o.
> - **`XP_CAP` rămâne absolut.** Multiplicatorul se aplică peste baza brută și *apoi* se taie la 60 — plafonul există ca o singură bătălie să nu fabrice veterani, iar un multiplicator aplicat DUPĂ el ar fi exact bătălia aia. Consecință asumată: tradiția ajută într-o luptă obișnuită și nu face nimic într-un măcel. Aplicat în `applyBattleResult`, **înainte de `promoteBuckets`** — dat după write-back ar fi lăsat oameni peste pragul lor nepromovați.
> - **Zero atingeri la motor** și niciun deploy de functions: bonusurile merg pe canale de domeniu (moral, XP), regula pe care `research/effects.ts` o are deja scrisă. PvP-ul nu le vede, **și scrie asta în ecran**, nu doar într-un comentariu.
> - **DEFECT DIN FELIA 1, găsit pe viu și reparat:** `assignToLegion` valida cu `joinBlocker` citit din snapshot-ul de render. Două atribuiri în același frame citeau amândouă același snapshot, iar a doua băga aceeași unitate în **două legiuni deodată** — desfășurată de două ori, numerotată de două ori. Reprodus în browser (H1 în ambele legiuni), reparat repetând verificarea **înăuntrul updater-ului**, pe lista curentă. O funcție pură nu poate vedea un snapshot învechit, deci testele n-aveau cum. În CLAUDE.md ca tipar.
> - **Verificat pe viu, bucla întreagă:** jurământ 60 000c → 35 000c (−25 000 exact), badge + crez pe card, cavaleria **refuzată** cu motivul pe buton („The Shieldwall is sworn against horsemen") și acceptată în legiunea nejurată de alături, detașare până sub prag → apare suspendarea, bătălie câștigată → moralul cohortei supraviețuitoare **65 → 78** (+15 din tradiție peste delta bătăliei) în timp ce unitățile nedesfășurate au rămas la 65, log `🚩 The First Host held to The Shieldwall`, onoare ×3 → ×4.
> - **Balans:** costul jurământului 5 000c → **25 000c** după ce l-am văzut pe ecran lângă o vistierie reală; oricum copper-ul e ceremonie, prețul adevărat e constrângerea permanentă.
> - **Contrast:** cel mai prost raport pe blocul nou era 3,95:1 în dark pe etichetele Takes/Keeps/Gives — mutate pe `wl-muted` cu majuscule+tracking (tiparul „ASSIGN A COHORT" de dedesubt), acum 6,53:1. Fără overflow la 375px, fără ținte de atins sub 28px.
> - 328 teste verzi (34 noi în `tradition.test.ts`).

**2026-08-16 - Task Started (tradițiile legiunii — felia 2 din north star)**
> Prompt: „continua cu traditiile"
> Model: Claude Opus 5
> Plan: `~/.claude/plans/woolly-meandering-crane.md`. Tradiția = **bonus ȘI constrângere**, adoptată o dată și permanentă. Constrângerea de două feluri: interdicțiile se refuză la intrare, cerințele de proporție doar **suspendă** bonusul (o cohortă poate muri în luptă — un refuz n-are ce refuza acolo). Bonusul stă pe canalele de domeniu (moral după luptă, XP din luptă), NU pe statistici de luptă — aceeași regulă pe care `research/effects.ts` o are deja scrisă, deci zero atingeri la motor și la copia lui server.

**2026-08-15 - Task Completed (fântâna de XP: veteranii plătesc ce-i învață pe noi)**
> Prompt: „lasa DataRead, continua cu warlord"
> Model: Claude Opus 5
> - **Defectul, măsurat:** completarea de efective adăuga fiecărui nou-venit `floor(avgXP unitate × 0.10)` **din nimic**. Pe o unitate VETERAN de 40 la 700 XP asta însemna **+700 XP la fiecare apăsare**, și se compunea — o medie mai bogată cumpăra un bonus mai mare data viitoare. Aia era sursa buclei completează→desființează care tipărea ranguri, dar **se scurgea și la joc normal**, nu doar sub un jucător care o căuta.
> - **Mecanica rămâne, mintul nu.** Veteranii care-i ridică pe novici e designul corect; ce era greșit e că le **fabrica** experiența în loc s-o **transfere**. Acum: ce câștigă noii veniți, plătesc profesorii. **Totalul armatei nu mai poate crește.**
> - **Plafonul nu e o clemă pusă pe deasupra, e locul unde transferul se termină:** un profesor nu poate duce un elev peste el însuși. Rezolvând `(vetXp − T)/vetCount ≥ (newXp + T)/newCount` iese o formulă închisă, iar când novicii știu deja mai mult ea dă zero singură — nu e caz special.
> - **Consecință de design, asumată:** media unității după completare e acum media ponderată simplă. **Completarea DILUEAZĂ**, cum ar trebui. Bonusul vechi ascundea asta; acum decide doar în ce RANG stă experiența, ceea ce tot contează fiindcă promovarea e per bucket.
> - Verificat pe viu, nu doar în teste: 40 VETERAN × 700 + 10 NOVICE × 0 → **28 000 înainte, 27 980 după** (−20 din trunchiere; niciodată în plus). Novicii au ajuns la 70, veteranii au scăzut la 682, 50 de oameni prezenți. Înainte de reparație: 28 700.
> - **Reparat pe drum:** `npm run dev` fixa `--port 5173`, deci două sesiuni care lucrau în arborele `Apps/` se băteau pe același socket și a doua servea tăcut nimic. Portul vine acum din mediu (`vite.config.ts`).
> - 294 teste verzi (12 noi în `reinforce.test.ts`, scrise ca invariant: „totalul nu crește NICIODATĂ", pe toate combinațiile de ranguri, plus 100 de cicluri completează→desființează).


**2026-08-15 - Task Completed (legiunile: o formațiune care supraviețuiește cohortelor ei)**
> Prompt: „vreau ca fiecare unitate sa capete identitate ... legiunile Romane ... mai aproape de 40k. Dar in universul nostru", apoi corectura: **„legiunile nu se absorb, vreau un sistem similar cu Total War Rome 2"**
> Model: Claude Opus 5
> - **Corectura a făcut feature-ul MAI MIC, nu mai mare.** Plănuisem identitatea PE `Unit`. În Rome 2 legiunea e ARMATA: o formațiune cu nume care **conține** unități. Deci „compoziție unică" nu costă nimic — o legiune are sulițași și arcași pentru că *conține* o cohortă de fiecare — iar **`Unit` nu primește niciun câmp**. Motorul de luptă, și copia lui byte-identică de pe serverul PvP, nu află niciodată că există legiuni. **Felia 4 din roadmap (cohorte în `Unit`) a dispărut cu totul**, împreună cu toată instalația de identitate prin `mergeUnits`/`splitUnit`.
> - **Apartenența e o listă de id-uri REZOLVATĂ LA CITIRE, nu întreținută la fiecare moarte.** Un id de unitate moare în șapte locuri, iar unul dintre ele — **write-back-ul din PvP** — rescrie armata salvată din afara state-ului jocului și n-ar chema niciodată codul nostru. Șapte locuri de curățat înseamnă șapte locuri de uitat. Verificat pe viu exact așa: am șters o unitate direct din blob, pe sub `useGameState`. **Registrele o mai numesc, ecranul nu, și cohortele au închis rândurile.**
> - **Douăsprezece cohorte, și nu e o alegere de gust:** PvP-ul refuză al treisprezecelea combatant server-side, iar campania **n-are niciun plafon și se strică peste douăzeci și patru** (`placeArmy` înfășoară rândurile și stivuiește tăcut combatanți pe căsuțe ocupate, de unde nu mai pot fi atinși). Douăsprezece e cea mai mare legiune care poate intra în ambele feluri de luptă.
> - **Sugestia de nume SONDEAZĂ, nu numără.** „Câte sunt + 1" se ciocnește în trei feluri care se întâmplă normal: desființezi a doua din trei și următoarea fură numele celei de-a treia; jucătorul tastează manual numele următor; redenumești una și ordinalul se eliberează fără să afle numărătoarea.
> - **Primul text scris de jucător care se salvează vreodată în jocul ăsta.** Ajunge în `addLog`, iar `logKind` clasifică liniile scanând tot șirul — deci o legiune cu ⚠ sau 🔬 în nume și-ar fi trimis propriile linii la Warnings sau Research. Scot glifele, **nu și cuvintele**: „The Victors" are voie să existe și să aterizeze la Battles; a mutila numele ales de jucător ca să protejezi un filtru de log ar fi trocul mai prost.
> - **Onorurile sunt numărate, nu listate** (`Victor of Rival Baron ×7`) — tot save-ul călătorește la Firestore ca un singur document, motiv pentru care și logul e plafonat la 300 de linii. Regula „doar cine s-a întors acasă" a ieșit din `finishBattle` într-o funcție pură (`awardVictoryHonours`): o regulă îngropată într-un setState e o regulă pe care n-o poate testa nimeni.
> - Reparate pe drum: `DeployPanel` și raportul de bătălie scriau „Light Inf Spear" (`prettyName` ocolește Registry-ul) unde tot restul jocului scrie „Light Infantry (Spear)"; câmpul de redenumire avea 29px înălțime; „20 strong" lângă „60 strong" erau două măsuri diferite cu același cuvânt (acum „fields 20" și „60 men").
> - **Constatare de documentație:** regula „`logic/types.ts` e byte-identic cu copia server" era **falsă de trei felii încoace** și inertă (serverul importă din el exact 7 simboluri, niciunul divergent). Corectată în CLAUDE.md — o regulă despre care toată lumea știe că e falsă e mai rea decât nicio regulă.
> - Verificat: 282 teste verzi, 0 contraste sub prag în ambele teme și pe 375px, 0 ținte mici, 0 input-uri fără etichetă, 0 overflow, 0 enum-uri brute; save vechi fără cheia `legions` încarcă gol; înfrângerea nu decorează pe nimeni.


**2026-08-15 - Task Completed (de unde vin oamenii: surse de recrutare)**
> Prompt: „ok, continua" (a patra din cele patru mecanici de adâncime agreate pentru armată)
> Model: Claude Opus 5
> - **Jumătate din mecanică era deja scrisă și MOARTĂ.** `RecruitPool` căra un XP de la bun început, `recruit()` îl amesteca ponderat — dar intrarea era fixată pe 0 și nu-l citea nimeni înapoi; `queueLightTraining` îl arunca. Trei surse (Levy / Volunteers / Mercenaries) leagă firul: câmpul mort capătă un rol, iar cel mai sărac ecran din joc (un câmp și un buton) capătă o alegere.
> - **Regula care ține tot designul: rangul se plătește în timp, niciodată în bani.** Prima versiune dădea mercenarilor 150 XP — peste `PROMOTE_AT.NOVICE` (100), deci un rang întreg cumpărat pe cupru, cu zero zile în plus. Și, fiindcă rangul e o **treaptă** iar rezervorul e o **medie**, peste prag prețul nu cumpăra nimic vizibil până când mercenarii nu treceau de 2/3 din rezervor — o prăpastie invizibilă, exact peste care apasă butonul implicit de 50. Sub prag (0/40/90) totul devine liniar. Plafonul stă în **getter**, nu în valorile implicite: nici adminul cu `startingXp: 500` nu poate cumpăra un rang.
> - **Rezervorul ține TOTALUL, nu media.** Forma veche re-deriva media și o trunchia la fiecare scriere, deci pierderea se acumula: zece mercenari urmați de cincizeci de levy aterizau la 21 XP unde aritmetica zice 25 — **o șesime evaporată**, fără eroare și fără unde s-o vezi. Acum e exact prin construcție, iar „scoaterea oamenilor nu mișcă media" e adevărată prin construcție, nu doar cât timp rezervorul e uniform.
> - **Previzualizarea NU are voie să diveargă de tick.** `carriedXp` a intrat în toate cele 4 apeluri ale lui `trainingXpFor` în aceeași schimbare. Verificat pe viu: cardul a promis „12 zile → 20 Trained · aduc 90 XP fiecare", iar după 12 zile rezervorul avea **20 TRAINED la 110 XP** (90 cărat + 120 drilled − 100 pragul). Identic.
> - **Plafonul de un rang rămâne 349** — nu l-am coborât la 225 deși există un argument: ar fi fost o **regresie pe jocul de azi**, unde `DRILLED × ARM_DRILL × MARTIAL_FERVOUR` dă fix 225, deci DOC_ELITE (140.000c) ar contribui exact zero într-un caz fără niciun mercenar. Când plafonul taie, ecranul **spune cât a aruncat** — o pierdere tăcută e același defect ca un refuz tăcut.
> - **Am SCOS din plan rezervoarele de ofertă.** Erau frâna anti-dominanță; fixul de mai sus le face inutile (beneficiu liniar ⇒ cuprul e un preț adecvat). Rămâneau treimea cu risc maxim și câștig minim: stare persistată nouă în felia fără funcție de hidratare, un pas nou în tick — pentru o frână care, la 5 min/zi și 24 de zile de recuperare, **se reumple într-o absență de două ore**: ar fi strâns șurubul pe cine joacă și l-ar fi răsplătit pe cine lasă tabul deschis.
> - **Restanță închisă:** `explainIntensity` și `explainCapacity` fuseseră scrise când au apărut mecanicile și **nu le importase nimic** — `intensity`/`barracks` se editau doar din JSON brut. Secțiunea **Army** din admin le consumă pe amândouă plus `explainRecruitSources`.
> - **RUSHED distruge și ECHIPAMENTUL** oamenilor pierduți — accidental în cod, dar e singura interacțiune auto-corectoare a designului (cu cât oamenii-s mai scumpi, cu atât grăbitul doare mai tare). Scris ca intenționat și fixat cu test, înainte să-l „repare" cineva într-un refund.
> - Verificat: 246 teste verzi, 0 contraste sub 3:1 în ambele teme și pe 375px (89 elemente), 0 overflow, 0 enum-uri brute pe toate cele 5 secțiuni montate, migrarea unui save vechi `{count, avgXP}` fără XP pierdut.


**2026-08-15 - Task Completed (zona de armată: un singur tab, cinci secțiuni, ecrane care vorbesc omenește)**
> Prompt: „vreau un UI mai frumos si o tranzitie mai smooth intre tab-urile ce tin de soldati si razboi"
> Model: Claude Opus 5
> - **Ce costa o mișcare normală:** de la antrenat un lot la format o unitate — patru clicuri, și tot ce tastasei dispărea, fiindcă ieșirea dintr-un tab îl demonta. Acum: **un clic**, iar secțiunile rămân MONTATE, deci cantitatea supraviețuiește dus-întorsului. Secțiunea stă în `App`, deasupra montării condiționate, deci o plimbare prin Overview te aduce înapoi unde erai.
> - **Zonele invizibile de click au dispărut, și nu ca simplificare.** Pe scena taberei **cele două dreptunghiuri se SUPRAPUNEAU** — inspecția stătea peste cortul comandantului și îi fura clicurile. Tooltipul de la Headquarters se tăia în afara containerului pe telefon. Niciunul din cele cinci nu era accesibil la tastatură, iar pe touch nu există hover — deci jumătate din fiecare imagine făcea ceva în tăcere. Arta a rămas ca banner care urmează secțiunea.
> - **Ecranele nu mai vorbesc în cod.** Un singur formator care preferă numele deja scrise în Registry: „Light Infantry (Spear)", nu `LIGHT_INF_SPEAR`; „3 Spear", nu `SPEAR: 3`. Același tip se scria în **patru feluri** în patru panouri. Verificat scănând textul randat, nu cu ochiul: **zero enum-uri brute**.
> - **Defecte reparate pe drum:** `checkCreateUnit` era scris pentru exact asta și **nu-l importa nimic** (de-aia „Create Unit" stătea mort fără motiv); câmpurile de rang n-aveau plafon (cereai 999 dintr-un rezervor de 3, butonul rămânea activ, refuzul apărea în Log); cu auto-buy pornit interfața sărea complet peste verificarea de echipament, deși state-ul o făcea față de trezorerie; cinci spinnere „(avail 0)" per unitate, necondiționat.
> - **Mișcarea animă DOAR transform.** Un fade de la opacity 0 ține elementul invizibil cât timp nu progresează — și nu progresează într-un tab pe care browserul nu-l compune. Auditul de contrast a prins-o ca **41 de elemente la raport exact 1:1** față de propriul fundal, adică secțiunea întreagă transparentă. **Mișcarea nu trebuie să fie niciodată motivul pentru care ceva e vizibil.**
> - **Fișa de unitate:** numele conduce (id-ul intern `U_k3f9a` era titlul), chevroane de rang, bară de XP până la rangul următor — `PROMOTE_AT` exista de mult și nu-l arătase nimeni.
> - Verificat: 0 contraste sub 3:1 în ambele teme și pe 375px, 0 overflow, toate cele 5 secțiuni accesibile la tastatură, 223 teste verzi.


**2026-08-15 - Task Completed (capacitatea cazărmii — 2/4 din adâncime)**
> Prompt: „continua"
> Model: Claude Opus 5
> - **Cazarma nu avea fund.** Puteai recruta la nesfârșit, iar rezervorul de soldatți antrenați (abia făcut vizibil) putea crește fără nicio consecință. Nivelul cazărmii cumpăra doar sloturi și zile — lucruri pe care le simți rar.
> - **Capacitate = recruți + rezervorul de antrenați. Soldatții dintr-o unitate NU se numără** — sunt pe teren. Asta face din „formează unități" supapa, și e invariantul pe care l-am fixat cu test: dacă unitățile ar conta, plafonul ar fi fundac.
> - **Se aplică DOAR la recrutare** — nu din lene, ci dintr-o observație: un lot ia N recruți și întoarce N antrenați, o conversie mută dintr-un rezervor în altul. Ambele sunt **nule la total**, deci nu pot depăși plafonul. Verificat și live: lotul s-a terminat, totalul cartiruit a rămas 80.
> - **Se blochează, nu se pedepsește.** Un plafon care lasă lotul să se termine și apoi aruncă oameni ar distruge ceva plătit.
> - **A închis și ultimul refuz tăcut din joc:** costul de recrutare adăugat felia trecută se refuza încă doar în tabul Log, fiindcă `checkRecruit` exista dar formularul nu era legat la el. Acum: buton mort + „Barracks full — 80 of 80 quartered. Form units or upgrade."
> - Upgrade-ul de cazarmă spune acum ce cumpără: sloturi, zile **și locuri**.
> - **Verificat în browser, bucla întreagă:** 80/80 ⇒ buton mort cu motivul; lot terminat ⇒ tot 80 (net zero); format o unitate ⇒ 60/80 și butonul reînvie.
> - 223 teste verzi (11 noi în `logic/capacity.test.ts`), typecheck + build verzi.
> - **RĂMÂN din cele patru:** instructori cu salariu + randament descrescător, surse de recruți cu calitate diferită.


**2026-08-14 - Task Completed (intensitatea de antrenament — prima din cele patru mecanici de adâncime)**
> Prompt: „cu care crezi ca e mai eficient" → „e ok" (intensitatea, recomandată de mine și acceptată)
> Model: Claude Opus 5
> - **De ce asta prima:** rangurile există complet și sunt deja valoroase (+10% atac / +8% apărare pe treaptă, **mor primii cei verzi** la pierderi, iar ADVANCED e poartă dură pentru heavy cav și horse archers), dar antrenamentul nu putea produce decât NOVICE. Sistemul zăcea.
> - **Trei intensități:** RUSHED (jumătate din zile, o cincime din oameni nu termină), STANDARD (**bit-identic cu azi**, câmp absent ⇒ STANDARD, deci save-urile și conversiile rămân neatinse), DRILLED (mai lung, soldă plătită la punerea în coadă, ies TRAINED).
> - **Un lot promovează CEL MULT UN RANG.** Testul scris ca REGULĂ, nu ca număr, a prins gaura înainte să ajungă pe live: cu tehnologiile de antrenament stivuite (`trainXpMult` ajunge la ×3), un lot DRILLED ar fi scos ADVANCED direct — adică tot urcușul de ~22 de zile prin Training Mode sărit dintr-o cumpărătură. `trainingXpFor` e acum sursa unică a plafonului, citită și de tick, și de prognoza de dinainte de apăsare.
> - **Rangul de aterizare vine din `promoteBuckets`** — aceeași funcție pe care o folosesc unitățile. Zero matematică paralelă de rang.
> - **Două defecte care locuiau exact în funcția pe care trebuia s-o ating:** (1) o conversie consuma ADVANCED+ și întorcea NOVICE — rangul pe care era condiționată era distrus chiar de pasul care îl cerea; `takeByRank` se scria la punerea în coadă și **nu se citea niciodată**. (2) sosirile făceau `count += qty` fără amestec de XP, deci un lot proaspăt moștenea tăcut media celor care erau deja în slot.
> - **Verificat în browser:** cardul a promis „12 days → 20 TRAINED · drill pay", iar lotul a scos exact 20 TRAINED @ 20xp (120 acordat − 100 prag) cu 1000c scăzuți la coadă; RUSHED a promis „4 days → 16 NOVICE (4 wash out)" și a scos exact 16. Numărul afișat = numărul plătit.
> - 212 teste verzi (18 noi în `logic/intensity.test.ts`), typecheck + build verzi.
> - **RĂMÂNE din cele patru:** capacitate de cazarmă, instructori cu salariu + randament descrescător, surse de recruți cu calitate diferită.


**2026-08-14 - Task Completed (bucla de armată: reparată și onestă)**
> Prompt: „vreau sa imbunatatim sistemul de recrutare si de training, plus ca nu functioneaza sistemul de creare unitati"
> Model: Claude Opus 5
> - **Defectul, reprodus și izolat:** „Create Unit" arunca `TypeError: onCreate is not a function` la fiecare apăsare. `UnitsTab` cerea `createUnit`, state-ul exportă `createUnitFromBarracks`. A trecut de typecheck fiindcă props-urile veneau prin `state as any`, și de teste fiindcă traseul ăsta **nu avea niciunul**. Cum e SINGURA cale de la 0 unități la 1 (`splitUnit`/`mergeUnits` cer una existentă), armata nu putea fi pornită deloc. Regresie din `96c1b92`.
> - **Redenumirea e jumătatea mică.** Am scos `as any` — tab-urile destructurează `GameStateShape` — și fallback-urile `?? (() => {})` care transformau un handler lipsă în „nu se întâmplă nimic" prin construcție. Următoarea greșeală de forma asta e eroare de compilare (a și fost, pe `disbandUnit`, cât am lucrat).
> - **Am parcurs bucla întreagă în browser și restul a ieșit la iveală:** recrutarea era GRATIS (50 de oameni, trezoreria neatinsă); fiecare refuz exista doar în tabul Log cât butonul rămânea activ; rezervorul de soldatți antrenați era invizibil din cazarmă; iar echipamentul dispărea la creare, deci o unitate plătită integral arăta „Ready 0/20" cu listă roșie.
> - **Unitatea își ține acum gearul.** `computeEquipped` avea chiar comentariul că așteaptă asta. Save-urile vechi primesc kitul cerut de efectiv (altfel o armată întreagă apărea dezbrăcată de un patch), iar un test de regresie fixează că o unitate complet echipată câmpuiește EXACT cât înainte — altfel felia ar fi rebalansat tăcut fiecare luptă. Replenish (formular finit, inaccesibil) reactivat, Disband adăugat: registrul se închide la fir (20 sulitțe/armuri/scuturi înapoi, 20 soldatți înapoi în cazarmă).
> - **Defect latent reparat:** `training.ts` pasa inventarul VIU unei funcții care mutează, apoi îl punea înapoi prin aceeași referință — React sărea peste actualizare; mergea doar fiindcă un `setState` vecin forța randarea.
> - **O constatare din teste:** cerința de echipament e definită în DOUĂ locuri (`perSoldierRequirement` pentru ce plătești, Registry `def.req` pentru ce ți se măsoară). Coincid azi; am pus o gardă să nu divergeze tăcut. Plus: un Registry ne-inițializat întoarce cerință GOALĂ, adică orice unitate pare complet echipată — testele cheamă `Registry.init()`.
> - Șters cod mort (`ConvertCavForm`, `TrainRow`), reparat butonul „Merge Selected" dezactivat (1,49:1, aceeași capcană de opacitate ca la revamp), „(ROOKIE)" → NOVICE.
> - 197 teste verzi (15 noi în `logic/army.test.ts`, prima acoperire de vreodată pe bucla asta), typecheck + build verzi, 0 contraste sub 3:1.
> - **RĂMÂNE, agreat cu Andrei:** adâncimea — intensitate de antrenament, surse de recruți cu calitate diferită, instructori cu salariu și randament descrescător, capacitate de cazarmă.


**Task Completed (Warlord Research Felia 2: Studiul ca resursă produsă)**
> Prompt: „continua" — următorul lucru din roadmap după ce revamp-ul s-a golit.
> Model: Claude Opus 5
> - **Cercetarea nu mai e o coadă de așteptare, e un cost.** Un proiect număra zile și nu costa nimic din ce producea domeniul. Acum consumă **Studiu**, acumulat pe ramuri (Economy/Army/Campaign/Doctrine), produs de Scriptorium și de cât din producția zilnică a unei clădiri dedici studiului. Ziua rămâne unitatea de timp a jocului — venituri, upkeep, hrană, antrenament, campanie: neatinse.
> - **Al treilea slider NU e o împărțire în trei.** Research ia prima felie din valoarea zilei; `focusCoinPct` împarte apoi ce rămâne, exact ca înainte. Un slider cu trei capete însumând 100 ar fi rescris tăcut intenția fiecărei clădiri din fiecare save existent. Câmp absent ⇒ 0 ⇒ comportament bit-identic (test de regresie explicit).
> - **Calibrat ca sliderul să fie o decizie:** un Scriptorium singur e mai LENT decât vechiul ceas de zile la orice nivel (50/65/80 față de un ritm de referință de 100). Viteza veche e ceva ce cumperi deviind producție. Altfel sliderul ar fi doar un bonus.
> - **Două lucruri din plan au picat la contactul cu codul:** (a) Scriptorium-ul **rămâne** în afara economiei de cupru — studiul lui e funcție de nivel, nu o valoare în cupru convertită; i-aș fi dat venit în monede la focus-ul implicit de 100%; (b) `GameConfig.init` rula **după** ce se hidratau feliile, deci migrarea unui proiect vechi ar fi folosit baseline-ul implicit în loc de cel din admin. Mutat.
> - **Capcana care șterge stare în tăcere:** `hydrateResearch` enumeră câmpuri (spre deosebire de `hydrateCampaign`, care face spread), deci `pools` scris în localStorage ar fi dispărut la fiecare reload, fără nicio eroare. Adăugat acolo și testat direct, plus verificat live cu dublu reload.
> - **Save-urile vechi se convertesc proporțional:** 2 zile din 3 ⇒ 2/3 din costul în Studiu. Verificat pe un save real forjat în forma pre-Studiu.
> - **Adminul:** secțiune nouă „Study — the pace of research" cu linie de efect + formulă (prin `explainStudy`, care RULEAZĂ `studyPerDay`, nu redescrie formula); `days` reetichetat **Effort**; textul „Research already in progress keeps the days it was queued with" reparat — nu mai era adevărat.
> - **Verificat în browser, nu doar la typecheck:** bara a promis Economy +56.4/zi, ziua a livrat exact +56.4; registrele se închid la virgulă (106,4 + 56,4 − 162,8 = 0); celelalte ramuri neatinse. 0 contraste sub 3:1 în ambele teme, în joc și în admin. Două „defecte" măsurate s-au dovedit artefacte ale panoului de browser cu lățime 0 — verificate a doua oară la 1280 real.
> - 182 teste verzi (25 noi), `tsc -b` + build verzi în ambele proiecte. Fondurile și materialele dedicate rămân felia 2b.


**2026-08-08 - Task Completed (revamp felia 5: ce a mai rămas din listă, după ce am verificat ce mai e adevărat)**
> Prompt: „am salvat si merge, continua cu revamp-ul"
> Model: Claude Opus 5
> - **Lista de observații era din 01.08 și patru felii trecuseră peste ea, așa că am verificat-o înainte să implementez** (cinci verificări paralele în cod + o pasă adversarială pe fiecare). **Trei observații au picat cu argumente bune și le-am lăsat în pace:** culoarea ramurilor (identitatea ramurii o dă titlul secțiunii, nu fundalul cardului — fundalul e canal de STARE, iar colorarea celor blocate ar șterge granița dintre ce poți și ce nu poți face), antetul (Reset e deja separat, cu tokenuri de acțiune distructivă și confirmare) și caseta de Momentum (starea ei goală e SINGURUL loc unde jocul explică mecanica — pliată, ar ascunde sistemul exact de jucătorul care nu știe de el).
> - **`opacity-70` era un defect de contrast pe care auditul de tokenuri nu avea cum să-l vadă.** Pe un card de research blocat, perechea DECLARATĂ de tokenuri dă 5,28:1 — dar opacitatea compune și textul, și fundalul, iar linia „Requires: ..." randă la **2,93:1**, sub prag. Adică exact explicația lacătului era cel mai greu de citit lucru din card. Acum de-emfaza stă în **bordură punctată + titlu estompat**, iar cerința se citește la contrast plin. Același tratament la cardurile de clădiri pe care nu ți le permiți (unde textul „Need 90g + 100 Stone" cădea de la 5,65:1 la 3,54:1).
> - **Tier-ul a devenit structură, nu o pastilă de 10px.** Lista era deja sortată pe tier, dar nu spunea asta nimănui: acum are separatoare „Tier 1 / 2 / 3", iar pastila din colț a dispărut ca redundantă.
> - **Ierarhia tipografică — partea care mai rămăsese:** numele nu învingea niciodată butonul. În research numele era `text-sm` ca butonul plin cu accent; în piață, numele obiectului și butoanele Buy/Sell erau toate la dimensiunea de bază. Acum numele e cel mai mare text din card. Plus două inversiuni: titlurile de secțiune din Clădiri erau 24px REGULAR sub un titlu de card 20px BOLD, iar **numărul zilei** — lucrul pe care îl verifici constant — era 16px/400 lângă un „Warlord" de 30px/700 care nu se schimbă niciodată.
> - **Două defecte găsite cu ochii, nu din listă:** `SCRIPTORIUM` (clădirea care deschide TOATĂ cercetarea) randă `<img>` fără `src` — iconiță de imagine ruptă, pentru că doar grila de resurse avea garda de fallback; și textul din Overview spunea încă „Coin/day scales with the building price", fals de la rebalansare. Plus două culori hardcodate rămase din fallback-urile de artă (`bg-stone-300`, `text-amber-900/20`), acum pe tokenuri.
> - **Verificat în browser, nu doar la typecheck:** audit de contrast care ține cont de opacitate (asta lipsea data trecută) — **0 eșecuri în ambele teme**, pe Research/Clădiri/Piață, desktop și 375px; 0 overflow orizontal; 0 imagini rupte; 12 separatoare de tier; numele obiectului 16px/700 vs butoane 14px/400.
> - 157 teste verzi, typecheck + build verzi.


**2026-08-08 - Task Completed (logic/explain.ts: ce face fiecare valoare de balans, cu formula ei)**
> Prompt: „se pare ca valoarea pe care o trecusem deja pentru costul unei cladiri a fost actualizat, si se pare ca si productia de lemn a crescut. o sa vreau in admin sa se vada mai clar ce efect au si vor avea in viitor modificarile pe care le face. vreau sa se vada formula de calcul etc."
> Model: Claude Opus 5
> - **`logic/explain.ts` răspunde la „ce face valoarea asta?" RULÂND jocul, nu re-derivand formula.** Fiecare funcție cheamă exact codul pe care îl cheamă tick-ul zilnic (`simulateEconomyDay`, `dailyUpkeepCopper`, `dailyFoodConsumption`, `buildingCostCopper`, `computeReward`). Regula asta nu e stil: bug-ul „UI-ul reimplementează formula și afișează numere pe care jocul nu le plătește" s-a livrat de trei ori în codul ăsta.
> - **Cheia noii felii: fiecare explicație se evaluează SUB configurarea care se editează**, nu sub cea salvată — `under(cfg, fn)` schimbă singleton-ul, rulează, și îl pune la loc în `finally`. Fără asta, linia de efect ar fi mințit exact acolo unde trebuie să explice: ridici producția de lemn în formular și linia de sub câmp îți arată vechea valoare.
> - Funcții noi: `explainRecipe` (materialele valorează mai mult decât obiectul? — exact capcana pe care panoul o avertiza în proză, acum măsurată), `explainBuildingCost` (construcție + drumul până la L3 + resursele), `explainCompany` (ce costă pe zi o companie întreagă, nu un soldat), `explainMission` (ce armată scoate în față și cât plătește), plus parametrul `config` pe `explainBuilding`/`buildingFormula`.
> - `buildingFormula` citește `GameConfig.buildingOutputValue(type) ?? BUILDING_OUTPUT_VALUE[type]` — formula arată numărul aflat în vigoare, nu default-ul din tabel.
> - **Testele acoperă și scurgerea:** o previzualizare nu trebuie să lase NICIODATĂ configurarea globală pe valorile previzualizate, nici când simularea aruncă.
> - 153 teste verzi (25 în `logic/explain.test.ts`), typecheck + build verzi.


**2026-08-02 - Task Completed (revamp UI felia 4: navigație grupată + log filtrabil)**
> Prompt: „fa ca tine" — adică mai departe pe ordinea recomandată, fără să mai întreb.
> Model: Claude Opus 5
> - **Navigația:** nouă pastile egale, într-un singur rând, nu dădeau nicio hartă a jocului. Acum sunt trei grupuri după ce faci efectiv — **Domain** (Overview / Resources / Buildings / Market), **Army** (Barracks / Units / Campaign), **Records** (Research / Log) — cu proximitatea făcând treaba în locul unui chenar în plus, plus o iconiță pe fiecare tab.
> - **Pe telefon, navigația mânca 172 px** (o cincime din ecran) fiindcă grupurile se împachetau pe patru rânduri. Acum e **o singură bandă derulabilă lateral: 38 px**. Am ales derularea în locul variantei doar-cu-iconițe pentru că pe touch nu există hover, deci o iconiță fără etichetă e o ghicitoare.
> - **Log-ul avea un singur flux nediferențiat.** Ca să afli de ce ți-a scăzut trezoreria trebuia să citești pe lângă fiecare linie de antrenament și de luptă. Acum: **șase categorii cu chip-uri de filtrare** (Days / Economy / Army / Battles / Research / Warnings), fiecare cu numărul de intrări — numărul rămâne vizibil chiar și când categoria e ascunsă, ca filtrarea să nu ascundă niciodată faptul că s-a întâmplat ceva. Plus căutare și un rând „Showing 6 of 8 entries".
> - **NOU `logic/logKind.ts`** (pur, testat): categoria e INFERATĂ din linie, nu înregistrată, pentru că `addLog` e chemat din vreo douăzeci de locuri iar textele sunt scrise tot de noi. `stripTimestamp` scoate prefixul de ceas de pe fiecare rând — era zgomot pe absolut toate.
> - **Un test a prins o problemă reală de proiectare:** linia „X requires: Y" din `startResearch` nu conținea niciun marcaj că e despre cercetare, deci nu putea fi clasificată. Reparat la sursă — cele șase mesaje de research își pun acum singure eticheta `🔬`. Un mesaj de log trebuie să-și spună subiectul; clasificatorul nu trebuie să ghicească.
> - **Verificat:** categoriile clasifică corect toate cele 8 linii-tip (1 zi, 2 economie, 2 armată, 1 luptă, 1 research, 1 avertisment); mutarea unei categorii scade lista de la 8 la 6; căutarea „research" lasă exact 1. Pe 375 px: overflow 0, zero contraste sub 3:1, zero ținte sub 32 px. Pe 1280 px, ambele teme: la fel.
> - 114 teste verzi (10 noi în `logic/logKind.test.ts`), typecheck + build verzi.
> - **Rămâne din revamp:** ierarhia tipografică din carduri, culoarea ramurilor care se oprește la tier 1 în arborele de research, și panoul de admin (OurDaysApp) — care e și punctul meu orb, fiind în spatele autentificării.

**2026-08-02 - Task Completed (revamp UI felia 3: jocul e utilizabil pe telefon)**
> Prompt: „ok, continua".
> Model: Claude Opus 5
> - **Am măsurat înainte să repar**, la 375×812 cu un domeniu populat, pe toate cele 9 taburi. Nu erau probleme cosmetice, erau structurale.
> - **111 px de overflow orizontal pe FIECARE tab.** Cauza: antetul ținea ~460 px de controale (Day / Load / Reset / numărătoare / Pause / Run Day) într-un `ml-auto flex` imbricat care **nu putea să se împacheteze**. Într-un viewport de 375 px, tot jocul se mișca lateral — pe orice ecran, nu doar pe unul. Rescris în două rânduri care se împachetează: identitate + ziua pe primul, ceasul și acțiunile lui pe al doilea, iar acțiunile distructive (Load / Reset) împinse la capăt. Padding-ul paginii a scăzut la 12 px sub `sm` — 24 px din 375 e prea mult din lățime.
> - **Ținte de atingere sub orice prag:** butoanele „UP" de upgrade erau **23×18 px**. Acum 34×34 minim, cu text de 11 px în loc de 9. Butonul de acțiune din Research avea 28 px înălțime — acum minim 36.
> - **Text sub pragul de citit pe telefon:** 12 locuri la 10 px (badge-urile de nivel, eticheta de deficit din magazin, badge-urile de dificultate din Campaign) — ridicate la 11 px, cel mai mic corp folosit de restul jocului.
> - **Verificat după reparație:** overflow 0 pe toate taburile la 375 px, zero ținte sub 32 px, zero text sub 11 px. Apoi înapoi la 1280 px, în ambele teme, pe 6 taburi: overflow 0, zero perechi de contrast sub 3:1 — deci reparația pentru telefon n-a stricat desktopul.
> - 104 teste + typecheck + build verzi.
> - **Rămâne din revamp:** gruparea celor 9 taburi (se împachetează pe 3 rânduri pe telefon), filtrele din Log, ierarhia tipografică, culoarea ramurilor care se oprește la tier 1, și panoul de admin (OurDaysApp).

**2026-08-02 - Task Completed (revamp UI felia 2: costurile spun ce-ți lipsește)**
> Prompt: „continua cu revamp-ul".
> Model: Claude Opus 5
> - **Cea mai mare gaură de informație din interfață era „Cannot afford".** Jocul știa răspunsul — fiecare cale de cumpărare compară deja costul cu punga și cu depozitele — dar UI-ul afișa doar un buton gri mort. Jucătorul era refuzat fără să afle DE CE și trebuia să umble prin taburi ca să deducă.
> - **NOU `logic/costs.ts`** (pur, testat): `evaluateCost(cost, holdings)` întoarce, pentru fiecare linie, `need / have / short`, plus o etichetă gata de pus pe buton („Need 28 Iron Ingot + 2g"). Acoperă monede, resurse, arme, armuri și cai — iar la cai numără doar pe cei **activi**, pentru că doar aceia se pot cheltui.
> - **NOU `components/common/CostList.tsx`** — un preț se citește și se învață: fiecare intrare are numele lângă iconiță, iar ce-ți lipsește apare roșu cu „(have N)". Rândurile vechi erau șiruri de pictograme fără etichetă („🪙1 ⚙50 ▪40 ◪4"), imposibil de învățat: nu puteai spune care e cărbunele și care minereul de cupru.
> - **Research:** aceeași evaluare alimentează rândul de preț, starea butonului și eticheta lui — deci cardul nu poate promite una și butonul alta. „Cannot afford" a devenit „Need 2 Iron Ingot". Zilele au ieșit din șirul de resurse într-o linie proprie („Takes 3 days"): înainte badge-ul `3d` arăta exact ca încă o resursă.
> - **Magazinul de clădiri:** fiecare dală se dezactivează când nu-ți permiți și spune exact ce-ți lipsește, în dală și în tooltip. Înainte apăsai și nu se întâmpla nimic — refuzul ajungea doar în log.
> - **Reset nu-ți mai poate șterge regatul dintr-un click.** Stătea lipit de Load, fără confirmare; acum e separat, colorat ca acțiune distructivă și cere confirmare care numește ziua pierdută.
> - **Terenul din grila de luptă are tokenuri proprii** (`wl-plains/forest/hill/river`). Împrumuta culori de status, alese pentru alarmă, nu ca să semene cu iarbă și pădure — iar în dark ordinea de luminanță se inversa și harta se descompunea. Acum ordinea (plains > hill > river > forest) e **identică în ambele teme**, verificat prin măsurare.
> - **Două regresii de contrast prinse de audit, nu de ochi:** (1) `Card` impunea `text-wl-ink` pe wrapper, așa că un apelant care inversează suprafața (ResourcesTab) ajungea cu două culori de text pe același element, iar câștigătorul era ordinea din stylesheet — titlul ieșea 1.32:1, practic invizibil; (2) `subtle` era cu un fir prea deschis pe suprafața muted (2.95:1). Ambele reparate la sursă.
> - 104 teste verzi (8 noi în `logic/costs.test.ts`), typecheck + build verzi, audit de contrast pe toate cele 9 taburi în ambele teme: zero perechi sub 3:1.
> - **Rămâne din revamp:** gruparea celor 9 taburi, filtrele din Log, ierarhia tipografică, culoarea ramurilor care se oprește la tier 1, mobilul (nemăsurat) și panoul de admin.

**2026-08-02 - Task Completed (revamp UI felia 1: tokenuri semantice + temă dark)**
> Prompt: „continua cu ce urma de facut la joc" — următorul lucru din ordinea agreată era revamp-ul UI + tema dark („mă dor ochii încercând să testez, dar să mai și joc").
> Model: Claude Opus 5
> - **Măsurat înainte de a decide:** 109 utilitare de culoare distincte în 26 de fișiere. Varianta „pun `dark:` peste tot" ar fi însemnat 200+ decizii independente care divergă imediat. Deci: **tokenuri semantice**, rezolvate o dată per temă.
> - **NOU `src/styles/tokens.css`** — vocabular semantic (surface / panel / panel-muted / panel-contrast, ink / muted / subtle / inverse, line, accent, good / bad / warn / info, plus culorile celor 4 ramuri de research), cu valori pentru light și dark. Scopat pe `.warlord`, clase prefixate `wl-` ca să nu se bată cu gazda (OurDaysApp deține deja `accent`, `border`, `background`).
> - **Tema dark e CALDĂ, nu albastru-negru** — jocul e medieval, iar arta presupune pergament și aur. Decizie implicită; se schimbă din valorile tokenurilor, nu din structură.
> - **Sursa temei e pluggable:** `App` acceptă `theme?: 'light'|'dark'`. Gazda care are propria setare o impune; fără ea, jocul își ține propriul comutator ☾/☀ persistat. Așa merge și embed-at, și pe orice alt canal.
> - **`tailwind.warlord.js`** — scala de culoare, o singură sursă, consumată ȘI de configul jocului ȘI de al aplicației (build-ul care compilează jocul când e embed-at e al aplicației). Capcană plătită: export dublu (named + default al aceluiași obiect) face `cloneDeep`-ul din Tailwind să recurgă la infinit, iar eroarea arată spre `styles.css`, care n-are nicio vină.
> - **Conversia celor 24 de fișiere** a rulat în paralel (5 agenți pe seturi disjuncte + un audit), ~450 de utilitare convertite. Culorile rămase sunt deliberate și documentate: text pe scrim-uri negre peste fotografii și dalele cu `mix-blend-multiply`.
> - **Arta nu putea fi tokenizată** — PNG-urile de clădiri sunt decupaje pe alb, compuse cu `mix-blend-multiply`, deci dala DE SUB ele trebuie să rămână deschisă, altfel arta devine noroi. Pe fundal închis rămâneau 8 dreptunghiuri crem de 315×236 — exact oboseala vizuală pe care tema o combate. Soluție: clasele `.wl-art` / `.wl-scene`, iar tema dark le estompează (`brightness(.6)`, respectiv `.66`). Regula stă lângă tokenuri, nu ca variante `dark:` în componente: o componentă spune CE e o suprafață, niciodată în ce temă e.
> - **Verificare:** audit de contrast calculat în browser (raport WCAG între text și fundalul efectiv), pe toate cele 9 taburi, cu un domeniu populat (8 clădiri, 2 unități, research în curs, buff-uri active), în AMBELE teme: **zero perechi sub 3:1**. Zero suprafețe luminoase neestompate pe dark. `npx tsc --noEmit` + 96 teste + build verzi.
> - **Rămâne de decis cu Andrei:** terenul din grila de luptă folosește acum tokenuri de status (good / accent / info) ca umpluturi, iar în dark ordinea de luminanță PLAINS/FOREST se inversează — se citește, dar nu mai „arată" ca iarbă vs pădure. Merită tokenuri proprii de teren.

**2026-08-02 - Task Completed (topbar cu resurse + prognoză zilnică)**
> Prompt: „o sa vreau ca resursele sa poata fi vazute permanent in topbar, si vreau sa se vada si cat vor creste zilnic in functie de setarile cladirilor".
> Model: Claude Opus 5
> - **`simulateEconomyDay(input)` în `logic/economy.ts`** — o zi de economie ca funcție PURĂ. Corpul e ridicat verbatim din `useEconomy.applyBuildingIncome` (producție + rețete + minter + grajd), plus upkeep-ul soldaților și hrana. `useEconomy` a rămas un ambalaj de 25 de linii care doar comite rezultatul. **Prognoza nu e o a doua implementare — e ACEEAȘI funcție**, singurul mod în care numărul afișat nu poate devia de cel plătit (bug pe care proiectul l-a livrat deja de două ori).
> - **`logic/forecast.ts`** — `forecastDay()` întoarce deltele exacte pe resursă, delta de monede, hrana cerută vs. consumată, zilele până la golire și clădirile blocate; `explainResource()` construiește explicația din același breakdown, deci tooltipul nu poate contrazice cifra.
> - **`components/common/ResourceBar.tsx`** — bară persistentă în antet, vizibilă din orice tab: monede + fiecare resursă cu stocul și `+n/−n` pe zi. Hrana insuficientă colorează pastila în roșu; tooltipul spune cine produce, cine consumă și în câte zile se golește. Se recalculează la fiecare render **intenționat** — memoizarea pe `inv` ar fi greșită, pentru că `queueLightTraining` mută inventarul pe loc, fără să schimbe referința.
> - **Trei minciuni de UI reparate, găsite de cartografiere:** (1) `ProductionModal` avea încă o ramură hardcodată `LUMBER_MILL + WOOD → 0 monede, 10 lemn` chiar sub comentariul care documenta postmortemul aceleiași erori — la focus 100 tick-ul plătește 500c și 0 lemn; (2) `OverviewTab` afirma „10% din cost / 70% valoare", formulă pe care jocul n-o mai folosea (clădirile de resurse au valori proprii, iar craftEfficiency intră în numitor); (3) `ResourcesTab` **omitea complet FOOD**, singura resursă consumată în fiecare zi.
> - Reparat și un `NaN` latent: `nres[outItem] += maxAfford` la topirea într-un save fără cheia de lingou dădea `undefined + n` și otrăvea resursa permanent.
> - **Ce scoate la iveală bara:** `buyBuilding` creează orice clădire cu `focusCoinPct: 100`, iar la focus 100 nu mai rămâne nimic de transformat în bunuri — **o fermă nou-construită produce 800 de monede și ZERO hrană**. Până acum nimic nu-ți spunea asta.
> - 96 teste verzi (17 noi în `logic/forecast.test.ts`: ordinea clădirilor contează, deficitul se distruge, hrana se oprește la 0, punga NU, zilele până la golire, config-ul admin ajunge în prognoză).
> - Verificat live: prognoza afișată (WOOD +15, IRON_ORE −38, COAL −19, IRON_INGOT +19, FOOD ±0, +800c) a coincis **exact** cu ce a produs apăsarea pe „Run Day"; cu 30 de soldați și 7 hrană pastila devine roșie, arată −7 (nu −30) și explică „needs 30 — starving, Empty in 1 day". Zero erori în consolă.

**2026-08-01 - Task Completed (Research felia 1 — Scriptorium + cerințe de infrastructură)**
> Prompt: „research ar trebui sa fie disponibil dupa ce se construieste o cladire anume, si anumite research options ar trebui sa fie influentate de unele cladiri si de nivelul lor de upgrade… vreau un sistem complex si realistic".
> Model: Claude Opus 5
> - **NOU: clădirea `SCRIPTORIUM`** (60.000 cupru + 60 Wood + 40 Stone, niveluri 1-3). Fără ea, tabul Research **nu există** în navigație, iar `startResearch` refuză orice proiect. Click pe Scriptorium în Buildings → deschide direct tabul Research (același comportament ca Barracks). Nu produce încă nimic — producția de Studiu vine în felia 2, deci e în lista de clădiri fără venit din `useEconomy`.
> - **`TechDef.requiresBuildings`** — fiecare din cele 12 tehnologii cere infrastructura care o face plauzibilă (Improved Kilns ⇒ Smelter L2, War Academy ⇒ Barracks L3 + Armory L2, Grand Armory ⇒ Armory L3 + Scriptorium L2 etc.). Nou în `catalog.ts`: `missingBuildings()` (întoarce text gata de afișat: „Smelter L2 (you have L1)"), `buildingReqsMet()`, `hasResearchBuilding()`. Verificarea e ȘI în `startResearch`, nu doar în UI.
> - Cardul blocat spune acum exact ce lipsește, pe două linii separate: tehnologii („Requires:") și clădiri („Needs:").
> - Cerințele trec prin `resolveCatalog`, deci sunt **editabile din admin** (tabul JSON) ca orice altă valoare de balans; un override le poate înlocui sau șterge complet.
> - **Bug găsit pe drum:** `FARM` exista în TOATE tabelele (cost, resurse, output, consum de hrană) dar **nu apărea în nicio listă de construcție** din `BuildingsTab` — nu puteai construi o fermă, deși hrana se consuma zilnic. Adăugată la `resTypes`.
> - 79 teste verzi (11 noi în `logic/research/gating.test.ts`), tsc + build verzi, cele 2 copii identice.
> - Verificat live: fără Scriptorium tabul Research lipsește din cele 8 taburi; după construire apare al 9-lea; cele 12 carduri afișează exact ce infrastructură le lipsește; construind un Blacksmith se deblochează fix un card (Iron Tools); pornirea cercetării scade banii și cele 4 lingouri și intră în coadă. Zero erori în consolă.

**2026-08-01 - Bug Fix (ziua nu avansa după ieșire/intrare în aplicație)**
> Raport: „am lăsat jocul deschis și a ajuns la ziua 159, am ieșit și am intrat înapoi, iar ziua nu a avansat" + „timer-ul s-a resetat".
> Model: Claude Opus 5
> - **Cauza:** `App.tsx:46` — `n > Date.now() ? n : Date.now() + TICK_MS`. Termenul următoarei zile era un timestamp ținut lângă save (`${saveKey}:nextTickAt`) și era ARUNCAT dacă trecuse, la orice montare. Timpul petrecut cu jocul închis credita zero zile, numărătoarea repornea la 5:00, iar vizitele mai scurte de 5 minute nu avansau niciodată ziua.
> - **NOU `src/logic/tick.ts`** (pur, testat): `planTicks(now, lastTickAt, tickMs, maxDays)` → `{ due, grant, forfeited, anchor, remainingMs }`. Ceasul e ancorat de `lastTickAt` — momentul ultimei zile încheiate — care intră ÎN SAVE (deci se sincronizează cu norul în embed, ca `day`). Numărătoarea e derivată din ancoră: fără derivă, fără reset la remontare.
> - `useGameState`: `lastTickAt` în save + dep-array + `loadSave` + `resetAll` (cele 4 locuri); `runDailyTick(anchorTo?)` avansează ancora cu exact o fereastră, sau la un moment dat de apelant (butonul „Run Day").
> - `App.tsx`: recuperarea rulează **o zi per commit** (`pendingDays`), pentru că `runDailyTick` citește snapshot-ul de render — N apeluri sincrone ar fi avansat ziua cu 1. Heartbeat-ul se instalează o singură dată și citește jocul printr-un ref (înainte avea `state`, obiect nou la fiecare render, în dependențe).
> - Plafon implicit 24 de zile (2 ore reale), reglabil din admin (`GameConfig.tick()`: `minutesPerDay`, `maxOfflineDays`). Excedentul se pierde și ancora e rebazată, ca următoarea intrare să nu-l crediteze din nou. O singură linie de log pentru absență, ca `LOG_CAP` să nu șteargă istoricul.
> - 68 teste verzi (15 noi), `npx tsc --noEmit` ✅, `npm run build` ✅, cele 2 copii identice. Verificarea live e în DEVLOG-ul OurDaysApp.

**2026-08-01 - Task Started (admin de balans)**
> Prompt: "adminul" — un admin de unde se configurează tot ce ține de balans. Decizii: aceiași admini ca OurDaysApp (`admins/{uid}`, panou separat, permisiune comună); scope v1 = tehnologii + buff-uri de momentum + economia de bază.
> Plan: singleton `GameConfig` (model `Registry`) peste tabelele existente, pârghii care citesc din el, reparat modificatorii de research care nu ajungeau nicăieri, doc `warlordConfig/live` + reguli, panou în OurDaysApp.
> Model: Claude Opus 5

**2026-08-01 - Task Completed (admin de balans + modificatori reparați)**
> Model: Claude Opus 5
> - **NOU `src/logic/config.ts`** — singleton `GameConfig` cu override-uri peste DEFAULT-uri: prețuri clădiri (copper + resurse), valoarea de bază pe resursă, upkeep (bază + multiplicator de rank), hrană, antrenament (`baseDays`/`minDays`/`maxSlots`), presete de misiune, catalog de tehnologii, buff-uri. Valorile invalide (NaN, negative, tip greșit, id necunoscut) cad pe default — un typo în admin nu poate strica economia. Singleton pentru că `BuildingsTab`/`ProductionModal` citesc tabelele direct din module: o configurare pasată doar prin `useGameState` ar fi afișat un preț și ar fi încasat altul.
> - **REPARAT — doi modificatori de research erau inerți.** `mods.buildCostMult` (Craft Guilds, Grand Armory) și `trainDaysDelta`/`trainSlotsDelta` (War Academy) apăreau în `ResearchTab` fără să ajungă nicăieri. Acum: `buildingCostCopper(type, mult)` e SINGURA sursă de preț (cumpărare, upgrade, PriceTag, tooltip), iar `enqueueBatch(…, daysDelta)` / `canEnqueue(…, extraSlots)` primesc deltele prin `Ctx.mods` din `training.ts`.
> - **REPARAT — `ProductionModal` reimplementa formula de venit** (`0.10*cost`, `0.7*mv`), ignorând nivelul clădirii, valorile de bază pe resursă și bonusurile de research. Acum cheamă `passiveIncomeAndProduction`, exact funcția rulată de tick-ul zilnic. `useEconomy` folosește prețul din config drept bază de venit, FĂRĂ reducerea de research (o tehnologie de construcție ieftină nu trebuie să reducă și veniturile).
> - Date resolvate: `missionPresets()` în `enemies.ts` și `resolveBuffs(overrides)` în `momentum.ts` (plus `onBattleWon/Lost/onResearchCompleted(buffs, table)`), lângă `resolveCatalog` existent. `useGameState` acceptă `opts.config`, inițializează `GameConfig` și exportă presetele resolvate + getterele de preț.
> - Exportate ca DEFAULT-uri pentru panou: `UPKEEP_BASE`, `UPKEEP_RANK_MULT`, `FOOD_BASE`, `RESOURCE_BUILDING_BASE_VALUE`.
> - `App.tsx` primește prop-ul `config` (embed-ul îl încarcă din Firestore înainte de montare). Panoul de admin + regulile trăiesc în OurDaysApp (`src/warlordAdmin/`, `warlordConfig/live`) — vezi DEVLOG-ul de acolo.
> - `npx tsc --noEmit` ✅, `npm run build` ✅, 53 teste verzi (13 noi în `src/logic/config.test.ts`, inclusiv testele care dovedesc că modificatorii nu mai sunt inerți). Cele 2 copii de cod de joc identice (`diff -q`).

### Session 3 — 2026-07-11

**2026-07-11 - Task Started**
> Prompt: "poti sa vezi folderul games, vreau sa lucram la jocuri online in aces folder" → decizii: (1) Warlord devine multiplayer și va trăi în interiorul OurDaysApp (fără deploy separat deocamdată); (2) sesiunea asta = Combat System, model grid tactic tură-cu-tură; (3) livrăm motor determinist + PvE complet în Warlord standalone + document de design PvP pentru OurDaysApp (implementat sesiunea viitoare).
> Plan: Motor de luptă PUR și DETERMINIST (RNG cu sămânță) în `src/logic/combat/` (types, rng, stats, engine, ai, enemies, army) ca să ruleze identic pe client (PvE) și mâine într-un Cloud Function (PvP verificabil). Stat-uri de combat + matrice counters (nu există azi). Slice `useCampaign` + tab `CampaignTab` cu grid. Pierderi aplicate înapoi în armată (închide bucla economică). Teste Vitest pe determinism. Doc `docs/PVP_INTEGRATION.md`.
> Model: Claude Opus 4.8

**2026-07-11 - Task Completed**
> Model: Claude Opus 4.8
> Changes:
> - **Motor pur de combat** `src/logic/combat/` (nou): `types.ts` (BattleState/Combatant/Command JSON-serializabile, grid map-of-rows), `rng.ts` (mulberry32 cu sămânță, poziția = `rngCursor`), `stats.ts` (`DEFAULT_COMBAT_STATS` pt toate 11 tipurile + matrici counters `weaponVsArmor`/`weaponVsMounted`/cav-vs-ranged/brace/shield + tabel terrain + tunables), `engine.ts` (`applyCommand` reducer pur, `legalMoves`/`legalTargets`, `computeKillsCore`/`resolveDamage`/`estimateKills`, `checkVictory`, `buildBattle`), `ai.ts` (`chooseEnemyCommands` determinist, planifică cu daune medii, nu consumă rng-ul luptei), `army.ts` (`unitToCombatant`, `fieldedStrength`, `applyBattleResult` write-back pierderi rank-crescător/XP/morală + șterge distrusele), `enemies.ts` (`MISSION_PRESETS` bandit/baron/invazie + `generateEnemyArmy`/`generateTerrain`/`createBattle`), `index.ts` barrel.
> - `src/logic/units.ts`: extras `computeEquipped` din `computeReady` (refactor behavior-preserving) + comentariu despre `equip` gol.
> - `src/logic/registry.ts`: `UnitDef.combat?` (override moddabil de stat-uri, injectat, nu citit în hot-path).
> - `src/state/useCampaign.ts` (nou): slice campanie (luptă activă, deployedIds, reward, record W/L, lastResult).
> - `src/state/useGameState.tsx`: instanțiere `useCampaign`; funcții `grantLoot`/`startBattle`/`battleCommand`/`runEnemyTurn`/`finishBattle`/`abandonBattle`/`dismissBattleResult`; `campaign` în save+dep-array+load+reset; export tot în return.
> - UI (nou): `components/tabs/CampaignTab.tsx` (state machine MENU/DEPLOY + luptă + rezultat, auto-enemy-turn via useEffect) + `components/campaign/{BattleGrid,BattleLog,MissionList,DeployPanel,ResultScreen}.tsx`. Wiring `App.tsx` (tab „Campaign").
> - Teste: Vitest instalat + `combat.test.ts` (10 teste: determinism seed, serialize/resume, AI pur, counters, conservare pierderi, veterani supraviețuiesc, unitate distrusă scoasă, luptă completă la rezoluție). Script `test`/`test:watch`.
> - `docs/PVP_INTEGRATION.md` (nou): design integrare PvP în OurDaysApp (schemă Firestore, Cloud Function autoritativ pe același motor, partajare cod `shared/`, întărire rules, i18n, limitări).
> - `CLAUDE.md`: path corectat (`Apps\games\warlord`), regula „nu atinge Apps\" re-scopată la proiectele-soră, hartă combat, capcane noi (equip gol, dual-units bug, puritate motor, save campanie).
> Build: `npx tsc --noEmit` ✅ | `npm run build` ✅ (2.27s) | `npm run test` ✅ (10/10)
> Verificare end-to-end (dev server, prin DOM — screenshot-urile panoului dădeau 0x0): Bandit Raid jucat până la victorie — armată generată determinist (forță 75 ≈ 0.6×125, morală 70, plasare corectă), select/move/attack + AI inamic funcționale, la victorie prada +3000c (=40×75) în wallet, pierderile scrise înapoi (4→2 unități, veteranii supraviețuiesc, +XP), record 1W/0L, persistat în localStorage.

**2026-07-11 - Task Completed (embed în OurDaysApp)**
> Prompt: "vreau sa ii facem deploy in aplicatia OurDaysApp si sa il lucram acolo, iar eu sa il testez in aplicatie"
> Model: Claude Opus 4.8
> Decizii: tot jocul single-player ca rută `/warlord` în OurDaysApp; i18n în engleză deocamdată; ambele repo-uri ținute IDENTICE.
> Changes:
> - Copiat codul de joc în `OurDaysApp/src/warlord/` (logic/state/components/mods/assets + App.tsx→WarlordApp.tsx). Rută lazy `/warlord` + `src/screens/Warlord.tsx` wrapper + buton ⚔ (Swords) în header CalendarHome (desktop+mobil).
> - Curățenie strict-compat (aplicată în AMBELE copii ca să rămână identice): `import type` (verbatimModuleSyntax), eliminat importuri/variabile nefolosite (React inutil cu jsx:react-jsx, dead destructure în App/BuildingsTab, dead local `units` state → `const [, setUnits]`, funcție `hasFreeBatchSlot` nefolosită etc.).
> - Adăugat notă de sincronizare în CLAUDE.md.
> Build: standalone `tsc --noEmit` ✅ + `test` ✅ (10/10); OurDaysApp `tsc -b` ✅ + `vite build` ✅ (Warlord = chunk lazy 118kB/gzip 32kB, bundle principal neschimbat) + deploy hosting ✅ (live: our-days-2a939.web.app/warlord).
> Verificat local (bypass temporar de auth, revenit): Warlord se randează la /warlord fără erori de consolă; flux complet Load→Campaign→Deploy→March→grid de luptă funcțional în contextul embed.

**2026-07-11 - Task Started (dezvoltare joc)**
> Prompt: "vreau sa imbunatatim si sa dezvoltam jocul / deci? / limita este libera"
> Plan: (1) fix dead-state split/merge/training; (2) promovare rank din XP + XP antrenament aplicat zilnic; (3) upgrade clădiri cu nivele; (4) progresie campanie (1 luptă/zi, escaladare, streak); (5) prognoză de atac + raport de bătălie; (6) salvări per-uid în embed. Sync ambele repo-uri + teste + review + deploy.
> Model: Claude Opus 4.8

**2026-07-11 - Task Completed (dezvoltare joc)**
> Model: Claude Opus 4.8
> BUG-URI REALE REPARATE:
> - **Save pierdut la refresh** — useGameState scria save-ul la mount cu state proaspăt, suprascriind salvarea înainte de Load. Fix: hidratare la inițializare (`readSaveBlob` citit sincron în useState initializer; toate slice-urile — useEconomy/useBarracks/useUnits/useCampaign — primesc blob-ul). Refresh-ul păstrează acum progresul.
> - **Dead-state**: doSplit/doMergeIfReady/toggleTraining scriau într-un `units` local mort → mutate pe `unit.setUnits` (butoanele Split/Merge/Training funcționează de-acum); checks înainte de setState.
> - **XP fără destinație**: `trainingGainPerDay` nu era folosit nicăieri; unitățile în training nu primeau nimic.
> FEATURES NOI:
> - **Promovare în rank** (`units.ts`): `PROMOTE_AT` (NOVICE 100 / TRAINED 250 / ADVANCED 450 / VETERAN 700 → ELITE doar din luptă), `promoteBuckets` pur (conservare exactă, overflow XP purtat, merge ponderat în bucket-ul superior, same-ref când nu promovează nimic). Aplicat zilnic în `runDailyTick` (training) și post-luptă în `applyCasualtiesToUnit`.
> - **Upgrade clădiri** (`economy.ts` + `BuildingsTab`): `Building.level` 1–3, output ×1.0/×1.3/×1.6 (`buildingLevelMult` în `passiveIncomeAndProduction`), cost upgrade = 60% × cost bază × nivel curent; badge L{n} real + buton UP (înlocuiește „LVL 1" hardcodat). BARRACKS/MARKET/STABLE excluse.
> - **Progresie campanie** (`useCampaign` + `enemies.ts`): `lastBattleDay` (1 bătălie/zi — butonul Prepare devine „Resting 🏕"), `clears` per misiune → `escalationMult` (+5%/victorie, cap +50% forță inamică), `streak` → `streakLootMult` (+5%/victorie consecutivă, cap +50% pradă; reset la înfrângere/retragere). `createBattle(units, diff, seed, {ratioMult, rewardMult})`.
> - **Prognoză de atac** (`engine.ts` + `CampaignTab`): `forecastAttack` pur (varianță medie, ZERO rng consumat, zero mutație — sigur pt PvP); panou lateral cu ținta, ~kills, ~pierderi la ripostă, ☠ letal, (ranged); click pe rând = atac.
> - **Raport de bătălie** (`army.ts` + `ResultScreen`): `UnitReport[]` per unitate (fielded/lost/XP/promovări/💀) în `lastResult.report`; tabel în ecranul de rezultat.
> - **Salvări per-uid în embed** (`App.tsx` + OurDaysApp `screens/Warlord.tsx`): prop `saveKey` scopează save + timerele autoTick; embed folosește `warlord_save_{uid}` cu migrare one-time din `warlord_save`.
> COMPAT: save-urile vechi se hidratează cu defaults (`hydrateCampaign`, `level ?? 1`, `report?`).
> Build: standalone `tsc` ✅ + `build` ✅ + Vitest **18/18** ✅ (6 teste noi: promovare/conservare/forecast-pur/escaladare); OurDaysApp `tsc -b` ✅ + `build` ✅ (chunk Warlord 126kB).
> Verificat end-to-end în preview (embed): hidratare la refresh (Day 5 fără Load), save vechi fără crash, promovare NOVICE→TRAINED cu overflow 15 XP, FARM L1→L2 cu −4800c exact, lastBattleDay setat la start de luptă, panou forecast apărut la țintă în rază + atac prin panou (8 kills, ranged, fără ripostă) + ascuns după acțiune.
> REVIEW ADVERSARIAL (workflow 19 agenți, 15 constatări confirmate = 9 distincte, toate reparate):
> - CRITIC: schimbarea saveKey pe componentă montată suprascria save-ul noii chei cu state-ul vechii chei → `key={saveKey}` la <WarlordApp> în embed (remount = re-hidratare) + guard `hydratedKey` în useGameState (persist doar pentru cheia din care s-a hidratat).
> - MAJOR: migrarea legacy `warlord_save` putea fi consumată de un render anonim → migrare doar cu uid real autentificat.
> - MAJOR: `canPayUpkeep`/`foodShortage` calculate pe snapshot-ul PRE-venit (moral scădea deși upkeep-ul era de fapt plătit din venitul zilei) → `applyBuildingIncome` returnează `{walletDelta, resources}` post-producție, flag-urile se calculează pe valorile de azi.
> - MAJOR: estimarea inamicului din DeployPanel ignora escaladarea (subestima) → primește `clears` + `escalationMult`.
> - MINOR: setBarracks/addLog în interiorul updater-ului setBatches (dublare latentă în StrictMode) → pre-pass pur; kills-urile unităților distruse pierdute din raport → combatanții distruși rămân în array (hp 0, toți consumatorii filtrează hp>0), selecție curățată la moarte; resetAll nu golea mergePick → golit; tooltip UP zicea „+30%" mereu → arată multiplicatorul rezultat (×1.3/×1.6).
> Post-fix: tsc ✅, 18/18 teste ✅, build ambele ✅, redeploy ✅.

**2026-07-12 - Task Started (PvP server-authoritative)**
> Prompt: "pvp" + decizii: server-authoritative de la început („securitate și anti-cheat bun, aplicația se extinde de la familie la social mai larg"), pierderi reale, push de tură.
> Plan: modul pur `combat/pvp.ts` (sanitizeDeploy + createPvpBattle) în TOATE 3 copiile (standalone/embed/functions); 4 Cloud Functions (accept/submit/forfeit/turn-push) rulând ACELAȘI applyCommand; fence firestore.rules pe gameType warlord-battle; client OurDaysApp-only `src/warlordPvp/` cu optimistic UI + reconciliere prin determinism + write-back pierderi idempotent.
> Model: Claude Opus 4.8

**2026-07-12 - Task Completed (PvP server-authoritative)**
> Model: Claude Opus 4.8
> LIVRAT (server-authoritative, LIVE pe our-days-2a939.web.app/warlord → tab ⚔ PvP):
> - Motor: `combat/pvp.ts` NOU pur (sanitizeDeploy — reconstruiește Combatant-uri curate cu caps ≤12 unități/≤500 per unitate/≤2000 total, vet derivat, statsOverride ȘI loadoutWeapon eliminate; createPvpBattle determinist). A TREIA copie byte-identică în `Apps/OurDaysApp/functions/src/warlordCombat/`. `army.ts applyBattleResult(side)` pt perspectiva ENEMY. 24 teste vitest.
> - Cloud Functions (`OurDaysApp/functions/src/index.ts`): createWarlordChallenge, acceptWarlordChallenge, submitWarlordCommand, forfeitWarlordBattle (onCall + tranzacții) + onWarlordBattleUpdated (push „e tura ta"/„joined"/„battle over"). Toate rulează ACELAȘI applyCommand ca autoritate.
> - firestore.rules: fence pe warlord-battle (create doar prin callable; update interzice state/winner/status/seed/deploy/players/finalized/etc.; delete doar waiting); colecția privată `warlordDeploys` interzisă total clientului.
> - Client OurDaysApp-only `src/warlordPvp/` (pvpApi/PvpPanel/PvpBattle) + toggle Domain|PvP în screens/Warlord.tsx + branch GamesHubModal. Optimistic UI (applyCommand local) reconciliat cu doc-ul server prin determinism, rollback la applied:false. Pierderi reale idempotente (warlord_pvp_applied_{uid}).
> REVIEW ADVERSARIAL (workflow, constatări confirmate reparate ÎNAINTE de ship-ul final):
> - CRITIC: `loadoutWeapon` valida independent de `type` → arcaș-cu-halebardă (rază 3 fără ripostă + ×1.5 vs armură + fură scutul). FIX: `loadoutWeapon` eliminat complet din sanitizeDeploy (PvP = stats vanilla, arma mereu default-ul tipului). Test nou.
> - MAJOR: adversarul putea citi armata provocatorului din doc înainte să-și aleagă a lui (counter-pick). FIX: crearea prin `createWarlordChallenge` (callable), armata provocatorului în `warlordDeploys/{gameId}` (Admin-only); doc-ul „waiting" n-are info de armată. Repară și verificarea de membru grup + validarea server la creare.
> - MINOR: `finalized` adăugat la deny-list.
> AMÂNAT (documentat în docs/PVP_INTEGRATION.md): fără timeout de tură (retragerea = portița); i18n engleză.
> Build: standalone tsc+24 teste ✅; embed tsc ✅; functions tsc ✅; vite build ✅. Deploy: functions ✅ + rules ✅ + hosting ✅.

**2026-07-12 - Task Completed (Tech Tree + Momentum)**
> Model: Claude Opus 4.8
> LIVRAT (ultimul item din backlog-ul original):
> - **Nucleu pur `logic/research/`**: `catalog.ts` — 12 tehnologii pe 4 ramuri × 3 trepte, DEFINITE CA DATE, cu `resolveCatalog(overrides)` (merge peste default; viitorul admin doar livrează un obiect de override — fără migrare). `effects.ts` — UN SINGUR obiect `Modifiers` + `applyDelta`/`clampModifiers` cu **plafoane** (economia nu poate exploda). `momentum.ts` — buff-uri temporare + `aggregate()`.
> - **EFECTELE ÎNCRUCIȘATE cerute:** o victorie nu mai dă doar pradă — declanșează **War Spoils** (+25% producție 3z) ȘI **Martial Fervour** (+50% XP antrenament 3z); o cercetare terminată dă **Breakthrough** (+10% prod, +20% XP, 2z); o înfrângere/retragere dă **Licking Wounds** (−15% prod, 2z). Buff-urile trec prin ACEEAȘI agregare ca tehnologiile ⇒ o singură cale de efect, nu două sisteme. Re-câștigarea REÎMPROSPĂTEAZĂ buff-ul (nu-l stivuiește) — altfel o serie de victorii ar compune la infinit.
> - **Pârghii backward-compatible** (default = fără efect): `passiveIncomeAndProduction(outputMult, craftEfficiency)`, `applyBuildingIncome(addNote, mods)`, `dailyUpkeepCopper/dailyFoodConsumption(units, mult)`, `batchDurationDays/batchSlots(level, delta)`, `trainingGainPerDay × mods.trainXpMult`, `rewardMult × mods.lootMult`, sloturi de training + `mods.trainSlotsDelta`, moral post-luptă.
> - `useResearch` (model `useCampaign`, cu `hydrateResearch` tolerant la save-uri vechi) + `startResearch` (tiparul `buyBuilding`: toate verificările înainte de setState) + bloc în `runDailyTick` (pre-pass pur, ca la batch-uri) + save/deps/load/reset/export.
> - `ResearchTab`: 4 coloane, stări blocat/disponibil/în curs/cercetat, bara de **Momentum** cu zilele rămase și panoul „Total effect".
> DECIZIE: cercetarea afectează DOMENIUL, nu stat-urile de luptă — motorul (3 copii byte-identice) rămâne neatins, PvP-ul rămâne vanilla, iar avantajul se propagă onest prin trupe mai multe/mai bine antrenate. Arena „armate reale" va fi doar o decizie de includere a obiectului `Modifiers`.
> BUG prins de verificarea LIVE (nu de teste): garda „s-a schimbat ceva?" din tick compara doar lungimile, iar decrementarea zilelor nu schimbă lungimea ⇒ cercetarea nu progresa niciodată. Acum scrie ori de câte ori există ceva în desfășurare.
> Build: `tsc` ✅ + **40/40 teste** (16 noi) ✅ + `build` ✅ standalone; `tsc -b` ✅ + `build` ✅ embed; cele 10 fișiere verificate identice între copii (`diff -q`). Deploy hosting ✅.
> Verificat live: costuri deduse exact (18000c + 50 lemn), zile 3→2→…→deblocat, Breakthrough auto-acordat, XP/zi 25 → 53 (35 bază după promovare × 1.25 tech × 1.2 buff), retragerea adaugă Licking Wounds fără să distrugă buff-ul existent, zero erori de consolă.
> RĂMÂNE (notat): admin Warlord (editor peste `resolveCatalog`), Arene PvP, deblocările din ramura Doctrine încă nu filtrează UI-uri (ids expuse în `mods.unlocks`).

**2026-07-12 - Task Completed (matchmaking GLOBAL — o singură lume)**
> Prompt: "atacam acum" (după decizia: toți userii aplicației sunt jucători în ACEEAȘI lume; grupurile = strat social)
> Model: Claude Opus 4.8
> PvP-ul era limitat la membrii unui grup comun. Acum ORICE user poate provoca pe ORICINE; grupurile/prietenii rămân doar scurtături de descoperire.
> Totul e OurDaysApp-only (codul de joc sincronizat NU s-a schimbat): registru public `warlordPlayers/{uid}` (nume/nameLower/poză/putere + wins/losses scrise DOAR de server), `createWarlordChallenge` cu groupId opțional (etichetă, nu poartă) + notificare/push scrise direct de funcție, `recordWarlordResult` la fiecare final, selector de adversar din toată lumea (recenți + căutare + badge „known").
> REPARAT în aceeași sesiune (prins de review-ul adversarial, era LIVE): `acceptWarlordChallenge` citea necondiționat `groups/${g.groupId}` — cu groupId null rezultă calea validă-dar-inexistentă „groups/null", deci ORICE provocare globală eșua cu permission-denied. Acum e ghidat de `battleGroupId` tipat; eticheta de grup, când există, se verifică în continuare.
> Reguli: ramura de grup rămâne PRIMA (interogările arcade evaluează exact ca înainte) + gardă de null, ramura `players` gardată pe cheie.

**2026-07-12 - Task Completed (cont de joc cloud-sync)**
> Prompt: "fiecare user al aplicatiei OurDaysApp are un cont separat pentru jocul Warlords...?" → decizie: toți userii = O lume; regatul fiecăruia devine cont real cross-device.
> Model: Claude Opus 4.8
> Persistență pluggable în `useGameState(saveKey, opts?)` (SYNCED): `opts.initialBlob` (cloud override) + `opts.onPersist(blob)` (scriere suplimentară, ex. cloud). Log plafonat la 300 (protejează doc-ul cloud). `App.tsx` propagă prop-urile. Standalone neschimbat (fără opts → localStorage). 24 teste.
> OurDaysApp-only: `src/warlordCloud.ts` (loadWarlordDomain: cloud→localStorage + migrare local→cloud dacă cloud gol; saveWarlordDomain; createDomainSync debounced 2.5s + flush). `screens/Warlord.tsx`: încarcă cloud ÎNAINTE de mount (ready-gate + spinner), onPersist=writer debounced, flush la unmount/switch-view. PvP write-back (`writeLocalArmy`) împinge acum și în cloud. Rule nouă `warlordDomains/{uid}` owner-only.
> Model salvare: localStorage = cache write-through + offline; Firestore `warlordDomains/{uid}` = sursă durabilă. Regatul urmează userul pe orice dispozitiv.
> NOTAT (viziune, de construit ulterior): toți userii într-o singură lume, PvP dincolo de grupuri (grupurile = strat social: căutare/mesaje/invitații), legături joc↔app definite în sesiunea principală.
> Build: standalone tsc+24 teste ✅; embed tsc+build ✅; deploy rules ✅ + hosting ✅. Verificat local: ready-gate hidratează Day 8, toggle Domain↔PvP fără pierdere, zero erori consolă.

**2026-07-12 - Task Started (Tech Tree + Momentum)**
> Prompt: "tech tree" + cerințe: toate cele 4 ramuri; **efecte încrucișate subtile** („o victorie ar trebui să aducă și un boost temporar în economie, nu doar loot, și un XP boost temporar pentru unitățile în antrenament"); **un admin Warlord separat** de unde se configurează totul; context viitor: mai multe **Arene** PvP (vanilla / armate reale / custom sandbox).
> Plan: nucleu pur `logic/research/` cu definițiile ca DATE (`resolveCatalog(overrides)` → admin-ul de mai târziu doar suprascrie, fără migrare) + UN SINGUR obiect `Modifiers` agregat din cercetări ȘI buff-uri temporare (aceeași cale de efect, nu două sisteme). Cercetarea afectează DOMENIUL (producție/antrenament/upkeep/pradă), NU stat-urile de luptă — motorul rămâne sigilat (3 copii byte-identice) și PvP-ul rămâne vanilla; avantajul se propagă onest prin trupe mai bune. Arena „armate reale" devine ulterior o decizie de includere a obiectului `Modifiers`.
> Model: Claude Opus 4.8

### Session 2 — 2026-06-20

**2026-06-20 - Task Started**
> Prompt: "toate suna bine, vreau ca inainte sa adaugi ceva, sa iti faci un plan de implementare si sa verifici apoi, daca codul actual este corect, optim si sa il aduci up to speed" + "nu vreau sa modifci nimic in folderul apps, vreau doar sa intelegi modul de lucru pe care il vreau" + "ok, deci, vreau sa intelegi modul de lucru din apps si sa aplici pentru warlord, acum, continua cu dezvoltarea jocului"
> Plan: Aplică metodologia din Apps (CLAUDE.md + DEVLOG), continuă cu Fazele 3.1-3.4 din plan
> Model: Claude Sonnet 4.6

**2026-06-20 - Task Completed**
> Model: Claude Sonnet 4.6
> Changes:
> - `CLAUDE.md` creat — reguli permanente, arhitectură, capcane cunoscute
> - `DEVLOG.md` creat — metodologie + session log
> - `src/logic/economy.ts`: `dailyUpkeepCopper()` — cost zilnic per soldat (tip × rank); `dailyFoodConsumption()` — consum hrană per soldat; `RESOURCE_BUILDING_BASE_VALUE` include FOOD; `FARM` adăugat la `BuildingCostCopper`, `ResourceBuildingCosts`, `BuildingOutputChoices`
> - `src/logic/types.ts`: `FOOD` adăugat la `ResourceType`; `FARM` adăugat la `Building.type`; `morale: number` adăugat pe `Unit`
> - `src/logic/units.ts`: `computeReady()` aplică factor morale (50%–100%); `applyMoraleChange()` — modifică morale zilnic bazat pe upkeep + hrană; `mergeUnits()` calculează morale ponderat; `splitUnit()` propagă morale
> - `src/logic/events.ts` creat — 6 tipuri de evenimente aleatorii (RAID, EPIDEMIE, etc.); `rollDailyEvent()` cu 15% șansă/zi
> - `src/logic/registry.ts`: FOOD înregistrat ca item
> - `src/state/useGameState.tsx`: `runDailyTick()` integrează upkeep + consum hrană + morale update + evenimente aleatorii; unit creat cu `morale: 100`
> - `src/state/useEconomy.ts`: FOOD în resources inițiale
> Build: `npx tsc --noEmit` ✅ | `npm run build` ✅ (3.31s)

### Session 1 — 2026-06-20

**2026-06-20 - Task Started**
> Prompt: "intentionez sa adaug complexitate jocului, vreau sa imi dai sugestii"
> Plan: Audit complet codebase + identificare buguri + plan de implementare features noi
> Model: Claude Sonnet 4.6

**2026-06-20 - Task Completed**
> Model: Claude Sonnet 4.6
> Changes:
> - `src/logic/units.ts`: Fix `computeReady()` (returna 0 fără constrângeri → returna `size`); fix `splitUnit()` horses ca `{active,inactive}` nu scalar; curățat comentarii verbose din `requiredCountsFor()`; extras helpers `splitScalarEquip`/`subtractScalarEquip`
> - `src/logic/economy.ts`: Fix Lumber Mill — nu mai e hardcodat la 10 WOOD, respectă `focusCoinPct` via `RESOURCE_BUILDING_BASE_VALUE`
> - `src/logic/batches.ts`: Eliminat bloc comentat imens (implementare veche); formula `batchSlots` corectată la `Math.min(level + 1, 5)`
> - `src/logic/registry.ts`: Adăugată validare la `registerItem()`/`registerUnit()` + warning la duplicate ID
> - `src/logic/training.ts`: `setWallet(() => res.wallet)` → `setWallet(w => w - res.spent)`; eliminat comentarii narative; ordine corectă checks-before-mutations
> - `src/state/useGameState.tsx`: Fix stale closure în `doMergeIfReady()`; `setWallet()` scos din callbacks setState în `sell()`; `econ.resources` adăugat la useEffect deps
> - `src/state/useBarracks.ts`: `recruit()` blendează corect `avgXP` în loc să reseteze la 0
> - `CLAUDE.md` + `DEVLOG.md` create (metodologie din Apps aplicată)
> Build: `npx tsc --noEmit` ✅ fără erori

## 2026-08-24 — Rezervorul de cazarmă păstrează un TOTAL, nu o medie

**Task Started:** 2026-08-24 · model: Claude Opus 5
**Prompt:** „eu sunt remote cateva zile si nu pot verifica nimic, vreau sa continui tu cu ce poti singur"

**Ce era stricat.** Un slot din `barracks[type][rank]` stoca `{ count, avgXP }` — o MEDIE. Trei
locuri separate re-derivau media și o podeau la fiecare scriere (o serie care termină, o unitate
desființată, o unitate formată), deci pierderea se compunea în loc să se anuleze. Un om putea
face drumul rezervor → unitate → rezervor și să se întoarcă valorând mai puțin, fără nicio
eroare și fără niciun loc unde să se vadă.

`RecruitPool` fusese DEJA reparat exact așa, stocând un total, iar comentariul lui explică de ce.
Unul din cele două rezervoare a fost reparat și celălalt lăsat pe forma veche. Ăsta e celălalt.

**Ce am măsurat.** Ferma raportată demult (completezi → desființezi la nesfârșit) **nu se
reproduce** — drumul PIERDE experiență, nu fabrică: 600 intrate, 550 ieșite. Defectul real era
invers decât fusese raportat.

**Livrat.** `logic/barracksPool.ts` (pur, 11 teste) + cele trei locuri schimbate + hidratare
adevărată în `useBarracks` (avea `saved?.barracks ?? emptyBarracks()` — ușă necoercitată, exact
forma care face din `econ.buildings` singura felie pe care o valoare stricată o poate otrăvi).

**`SAVE_SCHEMA` 10 → 11.** Prima intrare care SCHIMBĂ o formă, nu adaugă un câmp, și cea mai
urâtă de întâlnit pentru un build vechi: citește `avgXP` de pe un slot care nu-l mai are, deci
prima fuziune scrie `NaN` în rezervor și în fiecare unitate completată de-acolo. Înainte e sigur:
`hydratePool` migrează `count * avgXP`, exact numărul pe care forma veche încerca să-l reprezinte.

**Verificat pe viu, nu doar în teste** (localhost, save real, restaurat după):
- plantat un save de forma VECHE (schema 10, `avgXP`) → după reload: 10×121=1210, 40×30=1200,
  3×333=999, niciun `avgXP` rămas nicăieri, niciun NaN, schema rescrisă la 11
- format o unitate din rezervor prin UI → a ieșit cu 10@121 + 40@30 = **2410 XP întregi**
- desființat-o → rezervorul a primit înapoi **2410, pierdere 0**

`npx tsc --noEmit` verde · 596 teste verzi (27 fișiere) · `npm run build` verde.

**Task Completed:** 2026-08-24

## 2026-08-24 — Fântâna de XP: raportată de o săptămână, NU se reproduce

**Model:** Claude Opus 5

Am probat numeric bucla „completezi → desființezi → repeți" ținută ca defect DESCHIS. **Nu se
reproduce.** Ca raportul să fie corect trebuiau două lucruri adevărate simultan; doar unul a fost
vreodată:

1. Completarea trebuia să CREEZE experiență. Crea — `xpBonus = floor(avgXP * 0.10)` se adăuga
   deasupra. Între timp `reinforceBuckets` a fost rescris ca **transfer**: veteranii sunt
   debitați întâi și elevii primesc exact cât s-a debitat, iar cei 10% sunt un **plafon** pe cât
   dau veteranii, nu XP nou.
2. Desființarea trebuia s-o păstreze. Făcea invers — slotul de forma mediei pierdea XP la fiecare
   fuziune, exact bug-ul închis azi.

Deci bucla PIERDEA experiență, iar raportul avea semnul invers.

`logic/xpConservation.test.ts`: peste 2000 de cazuri aleatorii `reinforceBuckets` nu întoarce
niciodată mai mult decât a primit; peste 500 de cicluri complete, totalul nu urcă niciodată peste
punctul de plecare. Testul există ca reparația de azi (scoaterea pierderii) să nu poată deveni
tăcut o fântână.

`npx tsc --noEmit` verde · 598 teste verzi.
