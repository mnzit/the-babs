// net.js — extracted from index.html (P0 mechanical split, verbatim)
        // ---------------------------------------------------------------------------
        // Serverless WebRTC controllers. Host shows an offer QR; the phone scans it,
        // replies with its own answer QR; the host scans that back. Then a peer-to-peer
        // data channel carries drop/spell inputs over WiFi with no server at all.
        // ---------------------------------------------------------------------------
        const peers = {};          // slot -> { pc, dc, connected }
        let pairScan = null;       // active camera scan loop control

        // Send a message to every connected phone controller.
        function broadcastToControllers(obj) {
            const s = JSON.stringify(obj);
            for (const k in peers) { const dc = peers[k] && peers[k].dc; if (dc && dc.readyState === 'open') { try { dc.send(s); } catch (e) {} } }
        }

        // Remote inputs map to a lane just like local taps.
        function remoteDrop(slot) { const li = gameMode === 'battle' ? (slot - 1) : 0; if (lanes[li]) lanes[li].drop(); }
        function remoteSpell(slot, spell) { const li = gameMode === 'battle' ? (slot - 1) : 0; if (lanes[li] && gameMode !== 'battle') lanes[li].queueSpell(spell); }

        // A controller named themselves on their phone -> apply it everywhere.
        function setPlayerName(slot, name) {
            const p = players[slot - 1];
            if (!p) return;
            p.name = (name || '').trim() || p.name;
            updateLobbyUI();
            const el = document.getElementById('p' + slot + '-name'); if (el) el.innerText = p.name;
            if (typeof updateControllerUI === 'function') updateControllerUI();
        }

        function slotCount() { return Math.min(4, players.length); }   // one phone per player

        function buildPairList() {
            const list = document.getElementById('pair-list');
            if (list) {
                list.innerHTML = '';
                for (let s = 1; s <= slotCount(); s++) {
                    const connected = peers[s] && peers[s].connected;
                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200';
                    row.innerHTML = `<span class="text-sm font-bold text-slate-700">Player ${s}</span>
                        <span class="text-[11px] font-bold ${connected ? 'text-emerald-600' : 'text-slate-400'}">${connected ? 'connected' : 'not paired'}</span>`;
                    list.appendChild(row);
                }
            }
            // a single button pairs every unpaired phone in turn (auto-advance)
            const btn = document.getElementById('btn-pair-phones');
            if (btn) {
                const free = nextFreeSlotsCount(), total = slotCount();
                btn.disabled = free === 0;
                btn.classList.toggle('opacity-50', free === 0);
                btn.innerText = free === 0 ? 'All Phones Paired' : (free < total ? 'Pair Next Phone' : 'Pair Phones');
            }
        }
        function markSlotConnected(slot, ok) { if (peers[slot]) peers[slot].connected = ok; buildPairList(); }

        // STUN gives each peer a real-IP reflexive candidate so same-WiFi devices can actually
        // reach each other (without it, browsers only expose obfuscated .local mDNS candidates
        // that often fail to connect across devices).
        const RTC_CONFIG = { iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ] };

        // base45 (RFC 9285) packs binary into QR's efficient ALPHANUMERIC charset, so the QR has
        // far fewer modules than base64 (which forces dense byte-mode) -> much easier to scan.
        const B45 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
        function b45encode(bytes) {
            let out = '';
            for (let i = 0; i < bytes.length; i += 2) {
                if (i + 1 < bytes.length) {
                    let x = bytes[i] * 256 + bytes[i + 1];
                    const c = x % 45; x = (x - c) / 45; const d = x % 45; const e = (x - d) / 45;
                    out += B45[c] + B45[d] + B45[e];
                } else {
                    let x = bytes[i]; const c = x % 45; const d = (x - c) / 45;
                    out += B45[c] + B45[d];
                }
            }
            return out;
        }
        function b45decode(str) {
            const out = [];
            for (let i = 0; i < str.length;) {
                const rem = str.length - i;
                if (rem >= 3) { const n = B45.indexOf(str[i]) + B45.indexOf(str[i + 1]) * 45 + B45.indexOf(str[i + 2]) * 2025; out.push((n >> 8) & 0xff, n & 0xff); i += 3; }
                else if (rem === 2) { const n = B45.indexOf(str[i]) + B45.indexOf(str[i + 1]) * 45; out.push(n & 0xff); i += 2; }
                else break;
            }
            return new Uint8Array(out);
        }
        function packSDP(desc) {
            const json = JSON.stringify({ t: desc.type[0], s: desc.sdp });
            return b45encode(pako.deflate(json));
        }
        function unpackSDP(str) {
            const j = JSON.parse(pako.inflate(b45decode(str.trim().toUpperCase()), { to: 'string' }));
            return { type: j.t === 'o' ? 'offer' : 'answer', sdp: j.s };
        }
        // Don't wait for ICE gathering to fully "complete" (that blocks on every STUN server
        // answering or timing out — up to seconds). On same-WiFi all we need is one
        // server-reflexive (real-IP) candidate, which STUN returns in a few hundred ms; grab a
        // short grace beat to collect a couple more, then go. Hard cap as a fallback.
        function waitIce(pc) {
            return new Promise(res => {
                if (pc.iceGatheringState === 'complete') return res();
                let done = false, graceTimer = null;
                const finish = () => {
                    if (done) return; done = true;
                    pc.removeEventListener('icecandidate', onCand);
                    pc.removeEventListener('icegatheringstatechange', onState);
                    clearTimeout(graceTimer); clearTimeout(hardTimer);
                    res();
                };
                const onCand = (e) => {
                    if (!e.candidate) return finish();   // null candidate = gathering finished
                    // a reflexive candidate is enough to connect across devices on the same WiFi
                    if (/ typ srflx /.test(e.candidate.candidate) && !graceTimer) graceTimer = setTimeout(finish, 250);
                };
                const onState = () => { if (pc.iceGatheringState === 'complete') finish(); };
                pc.addEventListener('icecandidate', onCand);
                pc.addEventListener('icegatheringstatechange', onState);
                const hardTimer = setTimeout(finish, 1500);   // fallback cap (was 3500)
            });
        }
        function watchIce(pc, setStatus) {
            pc.oniceconnectionstatechange = () => {
                const s = pc.iceConnectionState;
                if (s === 'checking') setStatus('connecting over WiFi...');
                else if (s === 'connected' || s === 'completed') setStatus('connected!');
                else if (s === 'failed') setStatus('could not connect - same WiFi? avoid guest networks');
                else if (s === 'disconnected') setStatus('connection dropped');
            };
        }

        // ---- Camera QR scanning (jsQR) ----
        // opts.continuous keeps the camera running and fires onResult for every NEW code (so the
        // host can pair phone after phone off one camera); same code is debounced for ~1.5s.
        async function scanQR(videoEl, onResult, opts) {
            opts = opts || {};
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoEl.srcObject = stream; await videoEl.play();
            const c = document.createElement('canvas'); const cx = c.getContext('2d');
            const ctrl = { stop() { cancelAnimationFrame(ctrl.raf); stream.getTracks().forEach(t => t.stop()); } };
            let lastData = null, lastAt = 0;
            function tick() {
                if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
                    c.width = videoEl.videoWidth; c.height = videoEl.videoHeight;
                    cx.drawImage(videoEl, 0, 0, c.width, c.height);
                    const img = cx.getImageData(0, 0, c.width, c.height);
                    const code = (typeof jsQR !== 'undefined') ? jsQR(img.data, img.width, img.height) : null;
                    if (code && code.data) {
                        if (!opts.continuous) { ctrl.stop(); onResult(code.data); return; }
                        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                        if (code.data !== lastData || now - lastAt > 1500) { lastData = code.data; lastAt = now; onResult(code.data); }
                    }
                }
                ctrl.raf = requestAnimationFrame(tick);
            }
            ctrl.raf = requestAnimationFrame(tick);
            return ctrl;
        }

        function makeQR(el, text) {
            const qr = qrcode(0, 'L');               // auto version, low EC = fewest modules
            qr.addData(text.toUpperCase(), 'Alphanumeric');
            qr.make();
            const size = Math.min(360, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.82));
            el.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
            const svg = el.querySelector('svg');
            if (svg) { svg.setAttribute('width', size); svg.setAttribute('height', size); svg.style.width = size + 'px'; svg.style.height = size + 'px'; svg.style.display = 'block'; }
        }

        // ---- HOST side ----
        // One offer can only complete ONE peer connection, so to pair several phones from a
        // single screen the host shows one QR at a time and AUTO-ADVANCES: a phone pairs, then
        // the host instantly builds a fresh offer for the next free slot and refreshes the QR,
        // all while the same camera keeps scanning for the next phone's reply. One button, no
        // per-player clicking.
        let pairSlot = null, pairAuto = false;
        function setPairStatus(t) { const el = document.getElementById('pair-status'); if (el) el.innerText = t; }
        function nextFreeSlot() { for (let s = 1; s <= slotCount(); s++) if (!(peers[s] && peers[s].connected)) return s; return null; }

        // Build an offer + QR for one slot (shared by single-pair and the auto-advance loop).
        async function hostOfferSlot(slot) {
            pairSlot = slot;
            const pc = new RTCPeerConnection(RTC_CONFIG);
            watchIce(pc, setPairStatus);
            const dc = pc.createDataChannel('ctrl');
            peers[slot] = { pc, dc, connected: false };
            dc.onopen = () => { markSlotConnected(slot, true); try { dc.send(JSON.stringify({ a: 'welcome', slot: slot })); } catch (_) {} onSlotConnected(slot); };
            dc.onclose = () => markSlotConnected(slot, false);
            dc.onmessage = (e) => {
                let m; try { m = JSON.parse(e.data); } catch (_) { return; }
                if (m.a === 'drop') remoteDrop(slot);
                else if (m.a === 'spell') remoteSpell(slot, m.s);
                else if (m.a === 'playagain') { if (!matchActive) playAgain(); }
                else if (m.a === 'name' && players[slot - 1]) { setPlayerName(slot, m.n); }
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await waitIce(pc);
            const qr = document.getElementById('pair-qr'); if (qr) makeQR(qr, packSDP(pc.localDescription));
            const paired = slotCount() - (nextFreeSlotsCount());
            setPairStatus(pairAuto ? `Scan with Player ${slot}'s phone  (${paired}/${slotCount()} paired)` : `Scan with Player ${slot}'s phone`);
        }
        function nextFreeSlotsCount() { let n = 0; for (let s = 1; s <= slotCount(); s++) if (!(peers[s] && peers[s].connected)) n++; return n; }

        // A slot just connected: in auto mode, roll straight to the next phone; else close.
        function onSlotConnected(slot) {
            if (!pairAuto) { closePairModal(); return; }
            const next = nextFreeSlot();
            if (!next) { setPairStatus('All phones paired!'); setTimeout(closePairModal, 1200); return; }
            hostOfferSlot(next);   // refresh the QR for the next phone; the camera keeps scanning
        }

        // The one camera scan that serves every phone in turn.
        async function startAnswerScan() {
            try {
                if (pairScan) pairScan.stop();
                pairScan = await scanQR(document.getElementById('pair-video'), async (data) => {
                    try {
                        const ans = unpackSDP(data);
                        if (ans.type !== 'answer') return;                 // ignore stray offer QRs
                        const s = pairSlot;
                        if (!peers[s] || peers[s].connected) return;       // already paired / nothing pending
                        await peers[s].pc.setRemoteDescription(ans);
                        setPairStatus(`Player ${s} replied, connecting...`);
                    } catch (e) { setPairStatus('invalid code, try again'); }
                }, { continuous: true });
            } catch (e) { setPairStatus('camera blocked/missing: ' + e.message); }
        }

        function openPairModal(title) {
            const t = document.getElementById('pair-title'); if (t) t.innerText = title;
            setPairStatus('Starting camera...');
            const modal = document.getElementById('pair-modal');
            modal.classList.remove('hidden'); modal.classList.add('flex');
        }

        // One-button entry point: pair every unpaired phone, one after another.
        async function startPairing() {
            const slot = nextFreeSlot();
            if (!slot) return;                  // everyone already connected
            pairAuto = true;
            openPairModal('Pair Phones');
            await hostOfferSlot(slot);
            startAnswerScan();
        }

        // Single-slot pair (used for targeted re-pairing and by the test harness).
        async function hostPair(slot) {
            pairAuto = false;
            openPairModal('Pair Player ' + slot);
            await hostOfferSlot(slot);
            startAnswerScan();
        }

        function closePairModal() {
            if (pairScan) { pairScan.stop(); pairScan = null; }
            pairAuto = false; pairSlot = null;
            const modal = document.getElementById('pair-modal');
            modal.classList.add('hidden'); modal.classList.remove('flex');
        }

        // ---- PHONE / JOIN side ----
        let joinPC = null, joinDC = null, joinScan = null;
        function enterJoinMode() {
            const ov = document.getElementById('join-overlay');
            ov.classList.remove('hidden'); ov.classList.add('flex');
            document.getElementById('join-step1').classList.remove('hidden');
            document.getElementById('join-step2').classList.add('hidden');
            document.getElementById('join-status').innerText = '';
        }

        async function joinStartScan() {
            document.getElementById('join-status').innerText = 'point at the host code...';
            try {
                joinScan = await scanQR(document.getElementById('join-video'), async (data) => {
                    try { await joinFromOffer(data); } catch (e) { document.getElementById('join-status').innerText = 'invalid code, try again'; }
                });
            } catch (e) { document.getElementById('join-status').innerText = 'camera blocked: ' + e.message; }
        }

        async function joinFromOffer(text) {
            const pc = new RTCPeerConnection(RTC_CONFIG);
            watchIce(pc, (t) => { const el = document.getElementById('join-status'); if (el) el.innerText = t; });
            joinPC = pc;
            pc.ondatachannel = (e) => { joinDC = e.channel; wireJoinChannel(); };
            await pc.setRemoteDescription(unpackSDP(text));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            await waitIce(pc);
            document.getElementById('join-step1').classList.add('hidden');
            document.getElementById('join-step2').classList.remove('hidden');
            document.getElementById('join-status').innerText = 'show this to the host';
            makeQR(document.getElementById('join-qr'), packSDP(pc.localDescription));
        }

        function wireJoinChannel() {
            joinDC.onopen = () => showNamePrompt();
            joinDC.onclose = () => { const s = document.getElementById('cv-status'); if (s) { s.innerText = 'disconnected'; s.className = 'text-xs font-bold px-2 py-1 rounded bg-rose-500/20 text-rose-300'; } };
            joinDC.onmessage = (e) => {
                let m; try { m = JSON.parse(e.data); } catch (_) { return; }
                if (m.a === 'welcome') { const el = document.getElementById('cv-name'); if (el) el.innerText = 'Player ' + m.slot; }
                else if (m.a === 'gameover') setControllerMode('again');
                else if (m.a === 'playing') setControllerMode('drop');
            };
        }
        function cvSend(obj) { if (joinDC && joinDC.readyState === 'open') joinDC.send(JSON.stringify(obj)); }
        let cvWired = false, cvMode = 'drop';

        // Swap the phone's big button between DROP (in game) and PLAY AGAIN (game over).
        function setControllerMode(mode) {
            cvMode = mode;
            const btn = document.getElementById('cv-drop');
            const label = document.getElementById('cv-drop-label');
            const sub = document.getElementById('cv-drop-sub');
            if (!btn) return;
            if (mode === 'again') {
                if (label) label.innerText = 'PLAY AGAIN';
                if (sub) sub.innerText = 'tap to restart';
                btn.className = 'flex-1 my-4 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 active:scale-95 transition-transform flex flex-col items-center justify-center shadow-2xl';
                if (label) label.classList.remove('text-6xl'); if (label) label.classList.add('text-5xl');
            } else {
                if (label) { label.innerText = 'DROP'; label.classList.remove('text-5xl'); label.classList.add('text-6xl'); }
                if (sub) sub.innerText = 'tap to drop your house';
                btn.className = 'flex-1 my-4 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 active:scale-95 transition-transform flex flex-col items-center justify-center shadow-2xl';
            }
        }

        window.submitControllerName = function () {
            const nameInput = document.getElementById('cn-input');
            const v = nameInput.value.trim();
            if (v) {
                cvSend({ a: 'name', n: v });
                document.getElementById('cv-name').innerText = v;
            }
            document.getElementById('controller-name-prompt').classList.add('hidden');
            document.getElementById('controller-name-prompt').classList.remove('flex');
            showControllerView();
        };

        function showNamePrompt() {
            document.getElementById('join-overlay').classList.add('hidden');
            const prompt = document.getElementById('controller-name-prompt');
            prompt.classList.remove('hidden'); prompt.classList.add('flex');
        }

        function showControllerView() {
            const cv = document.getElementById('controller-view');
            cv.classList.remove('hidden'); cv.classList.add('flex');
            if (cvWired) return; // only bind listeners once
            cvWired = true;
            const drop = document.getElementById('cv-drop');
            const fire = (e) => { e.preventDefault(); if (navigator.vibrate) navigator.vibrate(15); cvSend({ a: cvMode === 'again' ? 'playagain' : 'drop' }); };
            drop.addEventListener('touchstart', fire, { passive: false });
            drop.addEventListener('mousedown', fire);
            document.querySelectorAll('.cv-spell').forEach(b => {
                const f = (e) => { e.preventDefault(); cvSend({ a: 'spell', s: b.dataset.cspell }); };
                b.addEventListener('touchstart', f, { passive: false }); b.addEventListener('mousedown', f);
            });
            window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); cvSend({ a: 'drop' }); } });
        }

        // ---------------------------------------------------------------------------
        // NetBridge: the controllers' link to the game. It listens on Babs.bus and
        // pushes match state to the phones, and refreshes the pairing list when the
        // lobby changes — so game logic never calls broadcastToControllers directly
        // and there is no fragile monkey-patch of updateLobbyUI.
        // ---------------------------------------------------------------------------
        Babs.NetBridge = (function () {
            Babs.bus.on('state:playing', function () { broadcastToControllers({ a: 'playing' }); });
            Babs.bus.on('state:gameover', function () { broadcastToControllers({ a: 'gameover' }); });
            Babs.bus.on('lobby:updated', function () { buildPairList(); });
            return { };
        })();
        buildPairList();
