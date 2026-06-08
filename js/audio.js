// audio.js — extracted from index.html (P0 mechanical split, verbatim)
        let isMuted = false;

        function toggleMute() {
            isMuted = !isMuted;
            const a = document.getElementById('bgm');
            if (a) {
                if (isMuted) a.volume = 0;
                else a.volume = Babs.CONFIG.audio.bgmVolume;
            }
            const btn = document.getElementById('btn-mute');
            if (btn) btn.innerHTML = isMuted ? '🔇 Muted' : '🔊 Sound On';
        }

        // Fire a one-shot sound effect element at a given volume.
        function playSfx(id, vol) {
            if (isMuted) return;
            const a = document.getElementById(id);
            if (!a) return;
            try { a.currentTime = 0; a.volume = vol == null ? Babs.CONFIG.audio.sfxVolume : vol; const p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
        }
        // Panic scream, throttled so a whole tower of panicking residents doesn't overlap.
        let panicCooldown = 0;
        function playPanic() { if (panicCooldown > 0) return; panicCooldown = Babs.CONFIG.audio.panicCooldownFrames; playSfx('sfx-panic', 0.5); }
        function playCrush() { playSfx('sfx-crush', 0.6); }   // building crashing down
        function playChime() { playSfx('sfx-chime', 0.5); }   // perfect drop
        function playWind() { playSfx('sfx-wind', 0.5); }     // a gust is coming
        function playExplode() { playSfx('sfx-explode', 0.6); } // zap blows a house apart

        // Flash an on-screen alert that wind is coming, and which way.
        let windAlertTimer = null;
        function announceWind(w) {
            const el = document.getElementById('wind-alert');
            if (!el) return;
            const right = w > 0;
            el.innerHTML = (right ? '' : '&larr; ') + 'WINDY' + (right ? ' &rarr;' : '');
            el.className = 'absolute top-[96px] sm:top-[116px] left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full text-white font-black bubbly-font text-sm sm:text-base shadow-lg pointer-events-none ' + (right ? 'bg-cyan-500/90' : 'bg-indigo-500/90');
            el.style.opacity = '1';
            if (windAlertTimer) clearTimeout(windAlertTimer);
            windAlertTimer = setTimeout(function () { el.style.opacity = '0'; }, Babs.CONFIG.wind.alertMs);
        }
        // Start the looping theme quietly (called from the START button, which is a user gesture
        // browsers allow playback). Safe to call repeatedly.
        function startMusic() {
            const a = document.getElementById('bgm');
            if (!a) return;
            a.volume = isMuted ? 0 : Babs.CONFIG.audio.bgmVolume;
            try { a.currentTime = 0; } catch (e) {}
            const p = a.play();
            if (p && p.catch) p.catch(function () {});
        }
        // Stop the music (when returning to the menu).
        function stopMusic() {
            const a = document.getElementById('bgm');
            if (!a) return;
            a.pause();
            try { a.currentTime = 0; } catch (e) {}
        }

        // ---------------------------------------------------------------------------
        // Procedural sound effects (Web Audio)
        // ---------------------------------------------------------------------------
        let audioCtx = null;
        function initAudio() {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        function playSound(type) {
            try {
                initAudio();
                if (!audioCtx) return;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain); gain.connect(audioCtx.destination);
                const now = audioCtx.currentTime;
                if (type === 'drop') {
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                    osc.start(now); osc.stop(now + 0.3);
                } else if (type === 'hit') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(120, now);
                    osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
                    gain.gain.setValueAtTime(0.3, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                    osc.start(now); osc.stop(now + 0.25);
                } else if (type === 'perfect') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523.25, now);
                    osc.frequency.setValueAtTime(659.25, now + 0.1);
                    osc.frequency.setValueAtTime(783.99, now + 0.2);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                    osc.start(now); osc.stop(now + 0.4);
                } else if (type === 'wobble') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(220, now);
                    osc.frequency.linearRampToValueAtTime(280, now + 0.15);
                    osc.frequency.linearRampToValueAtTime(220, now + 0.3);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                    osc.start(now); osc.stop(now + 0.3);
                } else if (type === 'spell') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(300, now);
                    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                    osc.start(now); osc.stop(now + 0.4);
                } else if (type === 'collapse') {
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(100, now);
                    osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
                    const filter = audioCtx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(150, now);
                    filter.frequency.exponentialRampToValueAtTime(40, now + 0.8);
                    osc.disconnect(gain); osc.connect(filter); filter.connect(gain);
                    gain.gain.setValueAtTime(0.4, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
                    osc.start(now); osc.stop(now + 0.8);
                } else if (type === 'click') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                    osc.start(now); osc.stop(now + 0.08);
                }
            } catch (e) { /* ignore */ }
        }

        // ---------------------------------------------------------------------------
        // AudioSystem: the ONLY place that turns game events into sound. Game logic
        // emits domain events on Babs.bus; this maps each to the right cue. Adding or
        // muting a sound is a one-line change here, with no edits to gameplay code.
        // ---------------------------------------------------------------------------
        Babs.AudioSystem = (function () {
            const bus = Babs.bus;
            const map = {
                'house:dropped':    () => playSound('drop'),
                'house:perfect':    () => { playSound('perfect'); playChime(); },
                'house:settled':    () => playSound('hit'),
                'house:wobbly':     () => playSound('wobble'),
                'house:missed':     () => playSound('wobble'),
                'level:up':         () => playSound('spell'),
                'lane:collapsed':   () => playSound('collapse'),
                'lane:panic':       () => playPanic(),
                'sabotage:junk':    () => playSound('wobble'),
                'sabotage:wind':    () => playSound('wobble'),
                'sabotage:zap':     () => playExplode(),
                'spell:queued':     () => playSound('spell'),
                'spell:noenergy':   () => playSound('wobble'),
                'demolition:start': () => { playCrush(); playPanic(); },
                'demolition:step':  () => playSound('collapse'),
                'wind:gust':        () => playWind(),
                'game:playing':     () => { playSound('perfect'); startMusic(); },
                'game:reset':       () => stopMusic()
            };
            for (const evt in map) bus.on(evt, map[evt]);
            return { map: map };
        })();
