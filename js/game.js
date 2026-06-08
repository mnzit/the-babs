// game.js — extracted from index.html (P0 mechanical split, verbatim)

        // ---------------------------------------------------------------------------
        // Players & lobby
        // ---------------------------------------------------------------------------
        const COLOR_POOL = ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981', '#f97316'];
        let players = [ { id: 1, name: "Player 1", color: COLOR_POOL[0], isAI: false } ];
        let gameMode = 'selfish';
        let matchActive = false;
        // Hazard toggles (on by default).
        // Hazard enable/disable is owned by Babs.Hazards (see hazards.js). The lobby
        // toggle buttons are generated from the registry, so a new hazard auto-appears.
        function buildHazardToggles() {
            const c = document.getElementById('hazard-toggles');
            if (!c) return;
            c.innerHTML = '';
            Babs.Hazards.all().forEach(h => {
                const btn = document.createElement('button');
                btn.id = 'fx-' + h.id;
                btn.innerText = h.label;
                btn.onclick = () => toggleFx(h.id);
                c.appendChild(btn);
            });
            updateHazardUI();
        }
        function toggleFx(which) {
            playSound('click');
            Babs.Hazards.toggle(which);
            updateHazardUI();
        }
        function updateHazardUI() {
            Babs.Hazards.all().forEach(h => {
                const el = document.getElementById('fx-' + h.id); if (!el) return;
                el.className = 'py-2 rounded-xl text-xs font-black bubbly-font border transition-all ' +
                    (h.enabled ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-100 text-slate-400 border-slate-200');
            });
        }
        let lanes = [];
        let windTimer = null;

        function setMode(mode) {
            playSound('click');
            gameMode = mode;
            [['selfish','btn-mode-selfish'],['battle','btn-mode-battle'],['coop','btn-mode-coop']].forEach(([m,id]) => {
                const el = document.getElementById(id);
                el.classList.toggle('border-indigo-500', mode === m);
                el.classList.toggle('bg-white', mode === m);
                el.classList.toggle('border-slate-200', mode !== m);
                el.classList.toggle('opacity-70', mode !== m);
            });
            const badge = document.getElementById('game-mode-badge');
            const label = mode === 'selfish' ? 'Solo Mode' : (mode === 'battle' ? 'Battle Mode' : 'Co-op Mode');
            badge.innerText = label;

            if (mode === 'battle') {
                while (players.length < 2) addPlayer();   // 2-4 towers
            } else if (mode === 'selfish') {
                if (players.length > 1) players = players.slice(0, 1);
            }
            updateLobbyUI();
        }

        function updateLobbyUI() {
            const c = document.getElementById('lobby-player-slots');
            c.innerHTML = '';
            players.forEach((p, idx) => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200';
                row.innerHTML = `
                    <span class="w-3.5 h-3.5 rounded-full shrink-0" style="background-color:${p.color}"></span>
                    <input value="${p.name.replace(/"/g,'&quot;')}" maxlength="14" oninput="renamePlayer(${idx}, this.value)"
                        class="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400">
                    ${p.wins ? `<span class="text-[11px] font-black text-amber-500 shrink-0">★${p.wins}</span>` : ''}
                    <button onclick="toggleAI(${idx})" class="text-[10px] font-semibold px-2 py-1 rounded shrink-0 ${p.isAI ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-teal-100 text-teal-700 border border-teal-200'}">${p.isAI ? 'AI' : 'Human'}</button>
                    ${players.length > 1 ? `<button onclick="removePlayer(${idx})" class="text-xs text-rose-500 hover:text-rose-600 font-bold px-1 shrink-0">remove</button>` : ''}`;
                c.appendChild(row);
            });
            const maxPlayers = gameMode === 'selfish' ? 1 : 4;   // solo is always a single player
            if (players.length < maxPlayers) {
                const add = document.createElement('button');
                add.className = 'w-full flex items-center justify-center p-2 rounded-xl border border-dashed border-indigo-500/40 hover:bg-indigo-50 text-indigo-500 text-xs font-bold transition-all';
                add.innerText = 'ADD PLAYER';
                add.onclick = addPlayer;
                c.appendChild(add);
            }
            document.getElementById('player-count-label').innerText = players.length + (players.length === 1 ? ' player' : ' players');
            document.getElementById('battle-note').classList.toggle('hidden', !(gameMode === 'battle' && (players.length < 2 || players.length > 4)));
            Babs.bus.emit('lobby:updated', {});   // NetBridge refreshes the pairing list (see net.js)
        }

        function renamePlayer(idx, val) { players[idx].name = val.trim() || ('Player ' + (idx + 1)); }
        function toggleAI(idx) { playSound('click'); players[idx].isAI = !players[idx].isAI; updateLobbyUI(); }
        function removePlayer(idx) { playSound('click'); players.splice(idx, 1); updateLobbyUI(); }
        function addPlayer() {
            const max = gameMode === 'selfish' ? 1 : 4;
            if (players.length >= max) return;
            playSound('click');
            const i = players.length;
            players.push({ id: i + 1, name: 'Player ' + (i + 1), color: COLOR_POOL[i % COLOR_POOL.length], isAI: false });
            updateLobbyUI();
        }
        // ---------------------------------------------------------------------------
        // Match flow, controls, combo cross-effects, loop
        // ---------------------------------------------------------------------------
        let canvas0, canvas1;

        window.onload = function () {
            buildLanes(); // idle background
            buildHazardToggles();
            updateLobbyUI();
            requestAnimationFrame(gameLoop);

            // P1 = Space, P2 = Enter (the rest tap their own tower or a button, or use a phone)
            window.addEventListener('keydown', function (e) {
                if (e.code === 'Space') { e.preventDefault(); if (lanes[0]) lanes[0].drop(); }
                else if (e.code === 'Enter') { e.preventDefault(); if (lanes[1]) lanes[1].drop(); }
            });
            window.addEventListener('resize', function () { lanes.forEach(l => l.resize()); });
        };

        // Build 1 lane (solo/co-op) or 2-4 lanes (battle, one tower per player). Each lane gets its
        // own freshly-created canvas, and tapping a tower drops that tower.
        function buildLanes() {
            const lanesEl = document.getElementById('lanes');
            lanesEl.innerHTML = '';
            const count = gameMode === 'battle' ? Math.max(2, Math.min(4, players.length)) : 1;
            lanes = [];
            for (let i = 0; i < count; i++) {
                const wrap = document.createElement('div');
                wrap.className = 'relative flex-1 h-full' + (i > 0 ? ' border-l-4 border-white/50' : '');
                const cv = document.createElement('canvas');
                cv.className = 'w-full h-full block touch-none';
                wrap.appendChild(cv); lanesEl.appendChild(wrap);
                const lanePlayers = gameMode === 'battle' ? [players[i] || players[0]] : players.slice();
                const lane = new Lane(cv, lanePlayers, (lanePlayers[0] || players[0]).color, {
                    config: Babs.CONFIG, bus: Babs.bus, houses: Babs.Houses, evaluator: Babs.StackEvaluator
                });
                cv.addEventListener('pointerdown', function (e) { e.preventDefault(); lane.drop(); });
                lanes.push(lane);
            }
            lanes.forEach(l => l.players.forEach(p => { if (p.spellEnergy === undefined) p.spellEnergy = 2; }));
        }

        // Build the per-player drop buttons for battle mode.
        function buildBattleControls() {
            const bc = document.getElementById('battle-controls');
            bc.innerHTML = '';
            lanes.forEach((lane, i) => {
                const p = lane.player();
                const btn = document.createElement('button');
                btn.className = 'pointer-events-auto flex-1 min-w-0 py-3 rounded-2xl border-4 border-white/80 shadow-lg active:scale-95 transition-all text-white';
                btn.style.background = `linear-gradient(135deg, ${p.color}, ${p.color}cc)`;
                const key = i === 0 ? 'SPACE' : (i === 1 ? 'ENTER' : 'tap');
                btn.innerHTML = `<div id="p${i + 1}-name" class="font-black text-sm sm:text-lg bubbly-font uppercase leading-none truncate px-1">${p.name}</div><div class="text-[9px] text-white/80 font-bold mt-0.5">tap / ${key}</div>`;
                btn.addEventListener('pointerdown', function (e) { e.preventDefault(); lane.drop(); });
                bc.appendChild(btn);
            });
        }

        function startGame() {
            if (gameMode === 'battle' && (players.length < 2 || players.length > 4)) { updateLobbyUI(); return; }
            Babs.bus.emit('game:playing', {});
            buildLanes();
            Babs.StateMachine.to('playing');
            lanes.forEach(l => { l.players.forEach(p => p.spellEnergy = 2); l.spawnHanging(); });

            // visibility
            const battle = gameMode === 'battle';
            if (battle) buildBattleControls();
            document.getElementById('battle-controls').classList.toggle('hidden', !battle);
            document.getElementById('battle-controls').classList.toggle('flex', battle);
            document.getElementById('solo-controls').classList.toggle('hidden', battle);
            document.getElementById('turn-hud').classList.toggle('hidden', battle);
            document.getElementById('solo-stats').classList.toggle('hidden', battle);
            document.getElementById('lobby-modal').classList.add('opacity-0', 'pointer-events-none');
            document.getElementById('gameover-modal').classList.add('hidden');
            document.getElementById('gameover-modal').classList.remove('flex');

            updateControllerUI();
            // phones are notified via NetBridge subscribing to 'state:playing' (see net.js)
            lanes.forEach(l => { if (l.player().isAI) l.runAI(); });

            if (windTimer) clearTimeout(windTimer);
            gameWind = 0; lanes.forEach(l => { l.targetWind = 0; });
            windTimer = setTimeout(scheduleWind, Babs.CONFIG.wind.firstDelayMin + Math.random() * Babs.CONFIG.wind.firstDelayRange);
        }

        // One shared, random wind for the whole arena. When a gust starts it warns the player
        // (on screen + sound) and pushes every falling house that way; then it calms down again.
        let gameWind = 0;
        function scheduleWind() {
            if (!matchActive) return;
            const wc = Babs.CONFIG.wind;
            if (Babs.Hazards.get('wind').enabled && Math.random() < wc.gustChance) {   // a gust (only if wind is enabled)
                const dir = Math.random() < 0.5 ? -1 : 1;
                gameWind = dir * (wc.gustMin + Math.random() * wc.gustRange);
                announceWind(gameWind);
                Babs.bus.emit('wind:gust', { magnitude: gameWind });
            } else {
                gameWind = 0;                              // calm
            }
            lanes.forEach(l => { l.targetWind = gameWind; });
            windTimer = setTimeout(scheduleWind, wc.cadenceMin + Math.random() * wc.cadenceRange);
        }

        // combo: a 3-perfect streak sabotages a random RIVAL tower (battle only). One of three:
        // a gale, a heavy junk house (stamped with your name), or zapping the house they're about
        // to drop (off the crane / mid-fall) so they lose it and slow down.
        function triggerComboEffect(lane) {
            const rivals = lanes.filter(l => l !== lane && l.alive);
            if (!rivals.length) return;
            const enemy = rivals[Math.floor(Math.random() * rivals.length)];
            const by = lane.player().name;
            // pick a random ENABLED combo sabotage from the registry and apply it
            const effects = Babs.Hazards.enabled('combo');
            if (!effects.length) return;
            const choice = effects[Math.floor(Math.random() * effects.length)];
            choice.apply(enemy, by);
        }

        // Battle: any tower that falls LEAD_HOUSES (5 = 50 m) behind the leader is knocked out.
        // Last tower standing wins.
        const LEAD_HOUSES = Babs.CONFIG.battle.leadHouses;
        function checkBattleLead() {
            if (gameMode !== 'battle' || lanes.length < 2 || !matchActive) return;
            const alive = lanes.filter(l => l.alive);
            const leader = Math.max.apply(null, alive.map(l => l.successfulDrops));
            alive.forEach(l => {
                if (l.alive && leader - l.successfulDrops >= LEAD_HOUSES) { l.toast('OUT-CLIMBED', '#f43f5e'); endLane(l, l.player()); }
            });
        }

        function endLane(lane, loser) {
            lane.alive = false;
            if (gameMode === 'battle') {
                const survivors = lanes.filter(l => l.alive);
                if (survivors.length <= 1) {
                    const winner = survivors[0] || null;
                    endGame(winner ? winner.player() : null, loser, true);
                }
            } else {
                endGame(null, loser, false);
            }
        }

        let demoActive = false, demoModalShown = false;

        // ---------------------------------------------------------------------------
        // GameStateMachine: the single authority for the match phase. Transitioning
        // here is what writes the legacy flags matchActive / demoActive / demoModalShown
        // (still read by lane logic, the loop, and tests), so the booleans can never
        // drift out of a valid combination.
        //   lobby -> playing -> demolition -> gameover -> (playing | lobby)
        // ---------------------------------------------------------------------------
        Babs.StateMachine = (function () {
            const FLAGS = {
                lobby:      { match: false, demo: false, modal: false },
                playing:    { match: true,  demo: false, modal: false },
                demolition: { match: false, demo: true,  modal: false },
                gameover:   { match: false, demo: true,  modal: true  }
            };
            let current = 'lobby';
            return {
                is: function (s) { return current === s; },
                state: function () { return current; },
                to: function (s) {
                    if (!FLAGS[s]) return;
                    current = s;
                    matchActive = FLAGS[s].match;
                    demoActive = FLAGS[s].demo;
                    demoModalShown = FLAGS[s].modal;
                    Babs.bus.emit('state:' + s, {});
                }
            };
        })();

        function endGame(winner, loser, battle) {
            if (Babs.StateMachine.is('demolition') || Babs.StateMachine.is('gameover')) return;   // a game-over sequence is already running
            if (windTimer) { clearInterval(windTimer); windTimer = null; }
            // Don't show the modal yet -- first play the demolition, then reveal it (see gameLoop).
            Babs.StateMachine.to('demolition');
            ['solo-controls', 'battle-controls', 'turn-hud'].forEach(id => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.classList.remove('flex'); } });
            lanes.forEach(l => l.startDemolition());
            const title = document.getElementById('gameover-title');
            const summary = document.getElementById('gameover-summary');
            const stats = document.getElementById('gameover-stats');

            if (battle) {
                if (winner) winner.wins = (winner.wins || 0) + 1;   // tally the win
                title.innerText = winner ? (winner.name + ' WINS') : 'DRAW';
                summary.innerText = (loser ? loser.name + "'s tower fell. " : '') + 'Tallest tower standing wins.';
                stats.className = 'bg-slate-800 border border-slate-700 rounded-2xl p-4 grid gap-3 grid-cols-2';
                stats.innerHTML = lanes.map(l => {
                    const p = l.player(), win = p === winner;
                    return `<div><span class="text-[10px] text-slate-400 uppercase tracking-widest font-bold block truncate">${p.name}${win ? ' (win)' : ''}</span><span class="text-2xl font-black bubbly-font" style="color:${l.accent}">${(l.successfulDrops * 10).toFixed(0)} m</span><span class="text-[11px] font-bold text-amber-400 block">${p.wins || 0} wins total</span></div>`;
                }).join('');
            } else {
                title.innerText = 'TOWER COLLAPSED';
                const drops = lanes[0].successfulDrops;
                summary.innerText = (loser ? loser.name : 'A builder') + ' missed the stack at ' + (drops * 10).toFixed(0) + ' m.';
                stats.innerHTML =
                    `<div><span class="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Final Altitude</span><span class="text-2xl font-black text-indigo-400 bubbly-font">${(drops*10).toFixed(0)} m</span></div>` +
                    `<div><span class="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Houses Stacked</span><span class="text-2xl font-black text-teal-400 bubbly-font">${drops}</span></div>`;
            }
        }

        function resetToLobby() {
            playSound('click');
            Babs.bus.emit('game:reset', {});   // stops music
            Babs.StateMachine.to('lobby');
            if (windTimer) { clearInterval(windTimer); windTimer = null; }
            document.getElementById('lobby-modal').classList.remove('opacity-0', 'pointer-events-none');
            document.getElementById('gameover-modal').classList.add('hidden');
            document.getElementById('gameover-modal').classList.remove('flex');
            buildLanes();
            updateLobbyUI();
        }

        // "Play again" from the game-over screen: same players & mode, straight into a new match.
        function playAgain() {
            document.getElementById('gameover-modal').classList.add('hidden');
            document.getElementById('gameover-modal').classList.remove('flex');
            startGame();
        }

        // Solo spell button hook
        function queueSpell(type) { initAudio(); if (lanes[0]) lanes[0].queueSpell(type); }

        function updateControllerUI() {
            if (gameMode === 'battle') return;
            const lane = lanes[0]; if (!lane) return;
            const p = lane.player();
            document.getElementById('ctrl-player-name').innerText = p.name;
            document.getElementById('ctrl-player-name').style.color = p.color;
            document.getElementById('ctrl-player-color').style.backgroundColor = p.color;
            const hint = document.getElementById('drop-hint');
            if (p.isAI) { document.getElementById('ctrl-turn-prompt').innerText = 'AI thinking...'; if (hint) hint.style.opacity = '0.25'; }
            else { document.getElementById('ctrl-turn-prompt').innerText = 'Tap anywhere to drop!'; if (hint) hint.style.opacity = '1'; }
        }

        function gameLoop() {
            if (panicCooldown > 0) panicCooldown--;
            lanes.forEach(l => {
                if (matchActive && l.alive) l.updatePhysics();
                else if (l.demolishing) l.updateDemolition();
                l.render();
            });
            // once every lane has finished crumbling, reveal the game-over screen
            if (Babs.StateMachine.is('demolition') && lanes.length && lanes.every(l => !l.demolishing)) {
                Babs.StateMachine.to('gameover');
                const m = document.getElementById('gameover-modal');
                m.classList.remove('hidden'); m.classList.add('flex');
                // phones are notified via NetBridge subscribing to 'state:gameover' (see net.js)
            }
            // solo DOM HUD
            if (gameMode !== 'battle' && lanes[0]) {
                const l = lanes[0];
                const mh = document.getElementById('max-height-val'); if (mh) mh.innerText = (l.successfulDrops * 10).toFixed(2) + ' m';
                const wv = document.getElementById('wind-speed-val'); if (wv) wv.innerText = l.windLabel();
            }
            requestAnimationFrame(gameLoop);
        }
