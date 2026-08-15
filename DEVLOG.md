# DEVLOG — Warlord

## Reguli DEVLOG
- **Append-only** — nu se șterg intrări istorice
- Fiecare task are **Task Started** și **Task Completed** cu timestamp, prompt exact, model
- Roadmap-ul e updatat la fiecare sesiune
- Format timestamp: `YYYY-MM-DD HH:MM`

---

## 🚀 Active Roadmap & Backlog

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
