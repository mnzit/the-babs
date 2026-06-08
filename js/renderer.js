// renderer.js — Babs.LaneRenderer: ALL canvas drawing for a lane (Single Responsibility).
//
// The renderer reads lane state through this.lane and never mutates gameplay; the
// Lane delegates render()/resize() here. Drawing was split out of Lane so the game
// logic and the presentation can change independently. House-type decoration is
// dispatched to Babs.Houses strategies (the renderer passes itself as `chars`).

window.Babs = window.Babs || {};

Babs.LaneRenderer = function (lane) {
    this.lane = lane;
    this.ctx = lane.ctx;        // canvas context is stable for the life of the lane
    this.canvas = lane.canvas;
};
        // ---------------------------------------------------------------------------
        // Lane rendering
        // ---------------------------------------------------------------------------
        Babs.LaneRenderer.prototype.resize = function () {
            const dpr = window.devicePixelRatio || 1;
            const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
            const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
            if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
        };

        Babs.LaneRenderer.prototype.render = function () {
            this.resize();
            const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, W, H);
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#0284c7'); bg.addColorStop(0.5, '#bae6fd'); bg.addColorStop(1, '#bae6fd');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            const scale = H / CANVAS_HEIGHT;
            const offX = (W - CANVAS_WIDTH * scale) / 2;
            ctx.setTransform(scale, 0, 0, scale, offX, 0);

            ctx.save();
            ctx.translate(0, this.lane.cameraYOffset);
            this.drawBackground();
            this.drawPlatform();
            this.drawBlocks();
            this.drawJunk();
            if (!this.lane.demolishing) this.drawCrane();
            this.drawParticles();
            ctx.restore();
            if (!this.lane.demolishing) this.drawFlagHUD();

            // sabotage flash tint
            if (this.lane.flash > 0) { ctx.fillStyle = `rgba(239,68,68,${0.18 * this.lane.flash})`; ctx.fillRect(0, -this.lane.cameraYOffset, CANVAS_WIDTH, CANVAS_HEIGHT); }

            // screen-space wind streaks + lane header + toast
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.drawWind(W, H);
            this.drawHeader(W, scale, offX);
            this.drawToast(W, H);
        };

        // Thin curvy wind lines that flow across the screen in the wind's direction.
        Babs.LaneRenderer.prototype.drawWind = function (W, H) {
            if (Math.abs(this.lane.currentWind) < 0.3) return;
            const ctx = this.ctx;
            const dir = this.lane.currentWind > 0 ? 1 : -1;
            const strength = Math.min(1, Math.abs(this.lane.currentWind) / 1.3);
            const sc = W / 550;
            const lines = 9, len = W * 0.2 * (0.6 + 0.4 * strength);
            const speed = 0.12 + 0.07 * Math.abs(this.lane.currentWind);
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.32 + 0.3 * strength) + ')';
            ctx.lineWidth = 1.8 * sc; ctx.lineCap = 'round';
            for (let i = 0; i < lines; i++) {
                const phase = (i * 0.61803) % 1;
                const prog = (this.lane.swingTime * speed + phase * 1.7) % 1;
                const span = W + 2 * len;
                const headX = dir > 0 ? (prog * span - len) : (W + len - prog * span);
                const y = H * (0.08 + 0.84 * phase) + Math.sin(this.lane.swingTime * 1.5 + i) * 5 * sc;
                ctx.beginPath();
                const N = 7;
                for (let s = 0; s <= N; s++) {
                    const t2 = s / N;
                    const px = headX - dir * len * t2;
                    const py = y + Math.sin(t2 * Math.PI * 1.7 + this.lane.swingTime * 3 + i) * 3.4 * sc;
                    if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            ctx.restore();
        };

        Babs.LaneRenderer.prototype.drawBackground = function () {
            const ctx = this.ctx;
            const sky = ctx.createLinearGradient(0, -1500, 0, CANVAS_HEIGHT);
            sky.addColorStop(0, '#0284c7'); sky.addColorStop(0.4, '#bae6fd'); sky.addColorStop(1, '#bae6fd');
            ctx.fillStyle = sky; ctx.fillRect(-4000, -3000, CANVAS_WIDTH + 8000, CANVAS_HEIGHT + 3500);
            ctx.fillStyle = 'rgba(255,253,224,0.95)';
            ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 100, 220 - this.lane.cameraYOffset * 0.25, 45, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,253,224,0.2)';
            ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 100, 220 - this.lane.cameraYOffset * 0.25, 75, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(120, 260 - this.lane.cameraYOffset * 0.35, 40, 0, Math.PI * 2);
            ctx.arc(160, 250 - this.lane.cameraYOffset * 0.35, 50, 0, Math.PI * 2);
            ctx.arc(200, 260 - this.lane.cameraYOffset * 0.35, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6ee7b7'; ctx.beginPath(); ctx.arc(100, PLATFORM_Y + 160, 250, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#34d399'; ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 120, PLATFORM_Y + 180, 230, 0, Math.PI * 2); ctx.fill();
        };

        Babs.LaneRenderer.prototype.drawPlatform = function () {
            const ctx = this.ctx, pos = this.lane.ground.position;
            ctx.fillStyle = '#d97706';
            ctx.beginPath(); ctx.roundRect(pos.x - (CANVAS_WIDTH - 120) / 2 - 5, pos.y - 15, CANVAS_WIDTH - 110, 30, 8); ctx.fill();
            ctx.strokeStyle = '#78350f'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#fbbf24'; ctx.fillRect(pos.x - (CANVAS_WIDTH - 120) / 2 + 10, pos.y - 11, CANVAS_WIDTH - 140, 8);
        };

        Babs.LaneRenderer.prototype.drawHouse = function (block, emotion, isTop) {
            const ctx = this.ctx;
            const x = block.position.x, y = block.position.y, angle = block.angle;
            const w = block.boxWidth || DEFAULT_BOX_WIDTH, h = block.boxHeight || DEFAULT_BOX_HEIGHT;
            const st = HOUSE_STYLES[(block.styleIndex || 0) % HOUSE_STYLES.length];
            const k = h / DEFAULT_BOX_HEIGHT;
            const t = this.lane.swingTime, ph = block.guyPhase || 0;
            const color = block.playerCreator ? block.playerCreator.color : '#3b82f6';
            const type = block.houseType || 0;
            const dark = '#3f2a18';
            ctx.save(); ctx.translate(x, y); ctx.rotate(angle);

            // wooden scaffold "new level" -- a plank on criss-cross stilts bridging to the tower
            if (block.isScaffold) {
                const ly = block.legY || 26, dx = block.supDx || 0, sw2 = block.supW || DEFAULT_BOX_WIDTH, beamB = h / 2;
                ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = Math.max(3, w * 0.028); ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-w / 2 + 5, beamB); ctx.lineTo(dx - sw2 / 2 + 8, ly);     // outer legs
                ctx.moveTo(w / 2 - 5, beamB); ctx.lineTo(dx + sw2 / 2 - 8, ly);
                ctx.moveTo(-w / 2 + 5, beamB); ctx.lineTo(dx + sw2 * 0.18, ly);      // criss-cross
                ctx.moveTo(w / 2 - 5, beamB); ctx.lineTo(dx - sw2 * 0.18, ly);
                const midY = beamB + (ly - beamB) * 0.55;                            // a horizontal tie
                ctx.moveTo(dx - sw2 / 2 + 8, midY); ctx.lineTo(dx + sw2 / 2 - 8, midY);
                ctx.stroke();
                ctx.fillStyle = '#b5803a'; ctx.strokeStyle = '#5c3a13'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 3); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = 'rgba(92,58,19,0.45)'; ctx.lineWidth = 1.5;
                for (let px = -w / 2 + 9; px < w / 2 - 4; px += 14) { ctx.beginPath(); ctx.moveTo(px, -h / 2 + 2); ctx.lineTo(px, h / 2 - 2); ctx.stroke(); }
                ctx.restore();
                return;
            }

            // a sabotaged "junk house": a heavy dark metal block stamped with the saboteur's name
            if (block.isJunkHouse) {
                ctx.fillStyle = '#475569'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4.5;
                ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#64748b'; ctx.beginPath(); ctx.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, (h - 8) * 0.4, 4); ctx.fill();
                ctx.fillStyle = '#ef4444'; ctx.fillRect(-w / 2, -3, w, 6);
                if (block.byName) {
                    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
                    ctx.font = 'bold ' + Math.round(Math.max(8, w * 0.15)) + 'px Fredoka';
                    ctx.fillText(block.byName, 0, h * 0.2);
                    ctx.textAlign = 'left';
                }
                ctx.restore();
                return;
            }

            ctx.strokeStyle = dark; ctx.lineWidth = 4.5;
            const moldingH = 9 * k;
            ctx.fillStyle = st.trim;
            ctx.beginPath(); ctx.roundRect(-w / 2 - 4, -h / 2, w + 8, moldingH, 3); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.roundRect(-w / 2 - 4, h / 2 - moldingH, w + 8, moldingH, 3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = st.wall;
            ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + moldingH, w, h - moldingH * 2, 0); ctx.fill(); ctx.stroke();

            const walk = (sp) => Math.sin(t * sp + ph);
            const face = (sp) => (Math.cos(t * sp + ph) >= 0 ? 1 : -1);

            // Type-specific decoration + resident(s) come from the house-type strategy.
            Babs.Houses.get(type).draw({
                ctx: ctx, w: w, h: h, k: k, t: t, ph: ph, color: color, st: st, dark: dark,
                emotion: emotion, isTop: isTop, walk: walk, face: face,
                block: block, chars: this
            });

            if (block.sabotageActive === 'ice') { ctx.fillStyle = 'rgba(186,230,253,0.45)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12); ctx.fill(); }
            ctx.restore();
        };

        // The hatted character (inspired by the runner you shared). Drawn standing on (cx,cy) as the
        // FEET; he walks (legs/arms swing, body bobs) and panics (arms up, wide eyes, open mouth,
        // shaking). `facing` flips him; `squish` flattens him (used when a house lands on his roof).
        Babs.LaneRenderer.prototype.drawGuy = function (cx, cy, s, emotion, t, phase, color, facing, squish, girl) {
            const ctx = this.ctx;
            const panic = emotion === 'panic';
            facing = facing || 1; squish = (squish == null) ? 1 : squish;
            const c = t * (panic ? 17 : 9) + phase;
            const legR = Math.sin(c) * 0.55;
            const lift = (panic ? Math.sin(c) : Math.abs(Math.sin(c)) * 0.8) * 1.4 * s;
            const shake = panic ? Math.sin(t * 46 + phase) * 1.1 * s : 0;
            const bw = 11 * s, bh = 13 * s, legLen = 6.5 * s, dark = '#1f2937';
            const hipY = -legLen, bodyCY = hipY - bh / 2;
            const rr = (x, yy, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, yy, w, h, r); };
            ctx.save();
            ctx.translate(cx + shake, cy - lift);
            ctx.scale(facing, squish);
            // legs
            const leg = (hx, rot) => {
                ctx.save(); ctx.translate(hx, hipY); ctx.rotate(rot);
                ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 1 * s;
                rr(-1.4 * s, 0, 2.8 * s, legLen + 0.5 * s, 1.3 * s); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#3b6fb5'; rr(-1.4 * s, 0, 2.8 * s, legLen * 0.55, 1.3 * s); ctx.fill();
                ctx.restore();
            };
            leg(-bw * 0.26, legR); leg(bw * 0.26, -legR);
            // body group
            ctx.save(); ctx.translate(0, bodyCY);
            ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 1.5 * s;
            rr(-bw / 2, -bh / 2, bw, bh, 3.5 * s); ctx.fill(); ctx.stroke();
            ctx.save(); rr(-bw / 2, -bh / 2, bw, bh, 3.5 * s); ctx.clip();
            ctx.fillStyle = color; ctx.fillRect(-bw / 2, bh * 0.1, bw, bh);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-bw * 0.2, bh * 0.1); ctx.lineTo(bw * 0.2, bh * 0.1); ctx.lineTo(0, bh * 0.36); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.moveTo(-1 * s, bh * 0.16); ctx.lineTo(1 * s, bh * 0.16); ctx.lineTo(0, bh * 0.46); ctx.closePath(); ctx.fill();
            ctx.restore();
            const hatH = bh * 0.5;
            ctx.fillStyle = color; ctx.strokeStyle = dark; ctx.lineWidth = 1.5 * s;
            ctx.beginPath();
            ctx.moveTo(-bw / 2, -bh / 2 + 1 * s); ctx.lineTo(-bw / 2, -bh / 2 - hatH + 4 * s);
            ctx.quadraticCurveTo(-bw / 2, -bh / 2 - hatH, -bw / 2 + 4 * s, -bh / 2 - hatH);
            ctx.lineTo(bw / 2 - 4 * s, -bh / 2 - hatH); ctx.quadraticCurveTo(bw / 2, -bh / 2 - hatH, bw / 2, -bh / 2 - hatH + 4 * s);
            ctx.lineTo(bw / 2, -bh / 2 + 1 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
            rr(-bw / 2 - 1.5 * s, -bh / 2 - 1.5 * s, bw + 3 * s, 2.5 * s, 1 * s); ctx.fill(); ctx.stroke();
            const ey = -bh * 0.04, eR = (panic ? 1.7 : 1.2) * s;
            if (panic) {
                ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 0.8 * s;
                ctx.beginPath(); ctx.arc(-bw * 0.2, ey, eR, 0, Math.PI * 2); ctx.arc(bw * 0.2, ey, eR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-bw * 0.2, ey - eR * 0.2, eR * 0.5, 0, Math.PI * 2); ctx.arc(bw * 0.2, ey - eR * 0.2, eR * 0.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, bh * 0.06, 1.6 * s, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = dark;
                ctx.beginPath(); ctx.arc(-bw * 0.2, ey, eR, 0, Math.PI * 2); ctx.arc(bw * 0.2, ey, eR, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = dark; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(-1.5 * s, bh * 0.06); ctx.lineTo(1.5 * s, bh * 0.06); ctx.stroke();
            }
            const arm = (sx, rot) => {
                ctx.save(); ctx.translate(sx, -bh * 0.12); ctx.rotate(rot);
                ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 1 * s; rr(-1.3 * s, 0, 2.6 * s, 6 * s, 1.2 * s); ctx.fill(); ctx.stroke();
                ctx.fillStyle = color; rr(-1.3 * s, 0, 2.6 * s, 3 * s, 1.2 * s); ctx.fill();
                ctx.restore();
            };
            if (panic) { const wv = Math.sin(t * 24 + phase) * 0.35; arm(-bw * 0.48, -2.5 - wv); arm(bw * 0.48, 2.5 + wv); }
            else { arm(-bw * 0.48, 0.3 - legR); arm(bw * 0.48, -0.3 + legR); }
            if (girl) {
                // skirt over the hips
                ctx.fillStyle = color; ctx.strokeStyle = dark; ctx.lineWidth = 1.2 * s;
                ctx.beginPath();
                ctx.moveTo(-bw * 0.42, bh * 0.34); ctx.lineTo(bw * 0.42, bh * 0.34);
                ctx.lineTo(bw * 0.66, bh / 2 + 3.5 * s); ctx.lineTo(-bw * 0.66, bh / 2 + 3.5 * s);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                // pink bow on top of the hat
                const byo = -bh / 2 - hatH;
                ctx.fillStyle = '#f472b6';
                ctx.beginPath(); ctx.moveTo(0, byo); ctx.lineTo(-4 * s, byo - 3 * s); ctx.lineTo(-4 * s, byo + 3 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, byo); ctx.lineTo(4 * s, byo - 3 * s); ctx.lineTo(4 * s, byo + 3 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(0, byo, 1.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            }
            ctx.restore();
            ctx.restore();
        };

        // Just the head + hat (for the window-peek houses), bobbing and looking left/right.
        Babs.LaneRenderer.prototype.drawHead = function (cx, cy, s, emotion, t, phase, color, facing) {
            const ctx = this.ctx; const panic = emotion === 'panic'; facing = facing || 1;
            const bob = Math.sin(t * 2 + phase) * 0.8 * s;
            const bw = 11 * s, bh = 10 * s, dark = '#1f2937';
            const rr = (x, yy, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, yy, w, h, r); };
            ctx.save(); ctx.translate(cx, cy - bob); ctx.scale(facing, 1);
            ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 1.5 * s;
            rr(-bw / 2, -bh / 2, bw, bh, 3 * s); ctx.fill(); ctx.stroke();
            const hatH = bh * 0.55; ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(-bw / 2, -bh / 2 + 1 * s); ctx.lineTo(-bw / 2, -bh / 2 - hatH + 4 * s);
            ctx.quadraticCurveTo(-bw / 2, -bh / 2 - hatH, -bw / 2 + 4 * s, -bh / 2 - hatH);
            ctx.lineTo(bw / 2 - 4 * s, -bh / 2 - hatH); ctx.quadraticCurveTo(bw / 2, -bh / 2 - hatH, bw / 2, -bh / 2 - hatH + 4 * s);
            ctx.lineTo(bw / 2, -bh / 2 + 1 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
            rr(-bw / 2 - 1.5 * s, -bh / 2 - 1.5 * s, bw + 3 * s, 2.5 * s, 1 * s); ctx.fill(); ctx.stroke();
            const ey = -bh * 0.02, eR = (panic ? 1.6 : 1.2) * s;
            if (panic) {
                ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 0.8 * s;
                ctx.beginPath(); ctx.arc(-bw * 0.2, ey, eR, 0, Math.PI * 2); ctx.arc(bw * 0.2, ey, eR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-bw * 0.2, ey - eR * 0.2, eR * 0.5, 0, Math.PI * 2); ctx.arc(bw * 0.2, ey - eR * 0.2, eR * 0.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, bh * 0.24, 1.5 * s, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = dark;
                ctx.beginPath(); ctx.arc(-bw * 0.2, ey, eR, 0, Math.PI * 2); ctx.arc(bw * 0.2, ey, eR, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = dark; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(-1.5 * s, bh * 0.24); ctx.lineTo(1.5 * s, bh * 0.24); ctx.stroke();
            }
            ctx.restore();
        };

        Babs.LaneRenderer.prototype.drawBlocks = function () {
            // find the top SETTLED house so rooftop residents only get squished once a house
            // actually lands on them (the still-falling block is excluded).
            let topBlock = null, topY = Infinity;
            this.lane.blocks.forEach(b => { if (b === this.lane.pending) return; if (b.position.y < topY) { topY = b.position.y; topBlock = b; } });
            this.lane.blocks.forEach(b => {
                const panic = this.lane.demolishing || Math.abs(b.angle) > 0.22 || Math.abs(b.angularSpeed || 0) > 0.06;
                // Scream only on a real "about to fall" tilt (or demolition), edge-triggered.
                const screamWorthy = this.lane.demolishing || Math.abs(b.angle) > 0.3;
                if (screamWorthy && !b.wasPanicking) Babs.bus.emit('lane:panic', { lane: this, block: b });
                b.wasPanicking = screamWorthy;
                this.drawHouse(b, panic ? 'panic' : 'idle', b === topBlock);
                if (b.starSparkles) this.drawSparkles(b.position.x, b.position.y);
            });
        };

        Babs.LaneRenderer.prototype.drawJunk = function () {
            const ctx = this.ctx;
            this.lane.junk.forEach(j => {
                ctx.save(); ctx.translate(j.position.x, j.position.y); ctx.rotate(j.angle);
                ctx.fillStyle = '#475569'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.roundRect(-j.boxWidth / 2, -j.boxHeight / 2, j.boxWidth, j.boxHeight, 6); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#ef4444'; ctx.fillRect(-j.boxWidth / 2, -j.boxHeight * 0.32, j.boxWidth, 5);
                if (j.byName) {
                    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
                    ctx.font = 'bold ' + Math.round(Math.max(8, j.boxWidth * 0.16)) + 'px Fredoka';
                    ctx.fillText(j.byName, 0, j.boxHeight * 0.18);
                    ctx.textAlign = 'left';
                }
                ctx.restore();
            });
        };

        Babs.LaneRenderer.prototype.drawBalancers = function (top) {
            const ctx = this.ctx, h = top.boxHeight || DEFAULT_BOX_HEIGHT;
            ctx.save(); ctx.translate(top.position.x, top.position.y - h / 2); ctx.rotate(top.angle);
            [{ o: -22, c: this.lane.accent, i: 0 }, { o: 22, c: '#ec4899', i: 1 }].forEach(bab => {
                ctx.save(); ctx.translate(bab.o, -12);
                const shake = Math.sin(this.lane.swingTime * 4 + bab.i) * 3;
                ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(-4, 14); ctx.lineTo(-6 + shake, 4); ctx.moveTo(4, 14); ctx.lineTo(6 - shake, 4); ctx.stroke();
                ctx.fillStyle = bab.c; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, Math.PI * 2); ctx.arc(4, -4, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-4, -6, 2, 0, Math.PI * 2); ctx.arc(4, -6, 2, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            });
            ctx.restore();
        };

        Babs.LaneRenderer.prototype.drawSparkles = function (cx, cy) {
            const ctx = this.ctx; ctx.save(); ctx.fillStyle = '#facc15';
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3 + this.lane.swingTime; const d = 65 + Math.sin(this.lane.swingTime * 3) * 8;
                ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        };

        // A toothed gear/cog. Drawn centred at (cx,cy), rotated by `ang`.
        Babs.LaneRenderer.prototype.drawGear = function (cx, cy, r, teeth, ang, fill, stroke, hub) {
            const ctx = this.ctx;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
            ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
            const n = teeth * 2, tooth = r * 0.24;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const a = (i / n) * Math.PI * 2;
                const rad = (i % 2 === 0) ? r + tooth : r;
                const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = hub || '#b45309'; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = stroke;
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.09, 0, Math.PI * 2); ctx.fill(); }
            ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        };

        Babs.LaneRenderer.prototype.drawCrane = function () {
            const ctx = this.ctx;
            // gantry beam
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 14;
            ctx.beginPath(); ctx.moveTo(30, this.lane.pivotY - 20); ctx.lineTo(CANVAS_WIDTH - 30, this.lane.pivotY - 20); ctx.stroke();

            const swingSpeed = 1.75 + this.lane.successfulDrops * 0.04, thetaMax = 0.52;
            const windAngle = this.lane.currentWind * 0.05;
            const swingAngle = thetaMax * Math.sin(this.lane.swingTime * swingSpeed) + windAngle;
            const bx = pivotX + ropeLength * Math.sin(swingAngle);
            const by = this.lane.pivotY + ropeLength * Math.cos(swingAngle);
            const mainR = 14;

            // rope from the pulley centre to the block (drawn before the gears so they appear to wrap it)
            let ex, ey;
            if (this.lane.isHanging && this.lane.hanging) {
                const hangAngle = -swingAngle;
                const bh = this.lane.hanging.boxHeight || DEFAULT_BOX_HEIGHT;
                Body.setPosition(this.lane.hanging, { x: bx, y: by });
                Body.setAngle(this.lane.hanging, hangAngle);
                Body.setVelocity(this.lane.hanging, { x: 0, y: 0 });
                Body.setAngularVelocity(this.lane.hanging, 0);
                ex = pivotX + (ropeLength - bh / 2) * Math.sin(swingAngle);
                ey = this.lane.pivotY + (ropeLength - bh / 2) * Math.cos(swingAngle);
                ctx.strokeStyle = '#78350f'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(pivotX, this.lane.pivotY); ctx.lineTo(ex, ey); ctx.stroke();
            }

            // mounting bracket + the gear pulley that spins as the camera pans up the tower
            ctx.fillStyle = '#334155'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(pivotX - 7, this.lane.pivotY - 24, 14, 16, 3); ctx.fill(); ctx.stroke();
            const ga = this.lane.cameraYOffset * 0.05;
            this.drawGear(pivotX + 17, this.lane.pivotY - 9, 8, 8, -ga * 1.75, '#94a3b8', '#475569', '#64748b'); // small gear (meshes, opposite)
            this.drawGear(pivotX, this.lane.pivotY, mainR, 10, ga, '#64748b', '#1e293b', '#b45309');             // main pulley

            if (this.lane.isHanging && this.lane.hanging) this.drawHouse(this.lane.hanging, 'idle', true);
        };

        Babs.LaneRenderer.prototype.drawFlagHUD = function () {
            if (this.lane.blocks.length === 0) return;
            const ctx = this.ctx; let topY = PLATFORM_Y;
            this.lane.blocks.forEach(b => { if (b.position.y < topY) topY = b.position.y; });
            const y = topY + this.lane.cameraYOffset;
            ctx.save();
            ctx.strokeStyle = 'rgba(100,116,139,0.55)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
            ctx.restore();
            ctx.save(); ctx.translate(20, y - 14);
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 25); ctx.lineTo(0, -10); ctx.stroke();
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(30, -2); ctx.lineTo(0, 6); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#334155'; ctx.font = 'bold 12px Fredoka';
            ctx.fillText((this.lane.successfulDrops * 10).toFixed(0) + ' m', 36, 12);
            ctx.restore();
        };

        Babs.LaneRenderer.prototype.drawParticles = function () {
            const ctx = this.ctx;
            for (let i = this.lane.particles.length - 1; i >= 0; i--) {
                const p = this.lane.particles[i];
                if (p.gravity) p.vy += 0.35;            // debris falls
                p.x += p.vx; p.y += p.vy; p.life -= p.decay;
                if (p.life <= 0) { this.lane.particles.splice(i, 1); continue; }
                ctx.fillStyle = p.color;
                if (p.square) {
                    const s = p.size * (0.5 + p.life * 0.5);
                    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
                } else {
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + p.life * 0.6), 0, Math.PI * 2); ctx.fill();
                }
            }
        };

        Babs.LaneRenderer.prototype.drawHeader = function (W, scale, offX) {
            // Only used in battle mode (solo uses the DOM HUD). Draw name/height/wind/combo.
            if (gameMode !== 'battle') return;
            const ctx = this.ctx; const pad = 10 * scale;
            ctx.font = `bold ${Math.round(20 * scale)}px Fredoka`;
            ctx.textAlign = 'left'; ctx.fillStyle = this.lane.accent;
            const nm = this.lane.player().name + (this.lane.player().wins ? '  ★' + this.lane.player().wins : '');
            ctx.fillText(nm, pad, 28 * scale);
            ctx.fillStyle = '#1e293b'; ctx.font = `bold ${Math.round(15 * scale)}px Fredoka`;
            ctx.fillText((this.lane.successfulDrops * 10).toFixed(0) + ' m  -  ' + this.windLabel(), pad, 48 * scale);
            // combo pips
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = i < this.lane.combo ? '#10b981' : 'rgba(255,255,255,0.6)';
                ctx.beginPath(); ctx.arc(pad + 8 * scale + i * 16 * scale, 64 * scale, 5 * scale, 0, Math.PI * 2); ctx.fill();
            }
            if (!this.lane.alive) {
                ctx.fillStyle = 'rgba(15,23,42,0.55)'; ctx.fillRect(0, 0, W, this.canvas.height);
                ctx.fillStyle = '#fca5a5'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(34 * scale)}px Fredoka`;
                ctx.fillText('FELL', W / 2, this.canvas.height / 2); ctx.textAlign = 'left';
            }
        };

        Babs.LaneRenderer.prototype.windLabel = function () {
            if (Math.abs(this.lane.currentWind) < 0.3) return 'Calm';
            return (Math.abs(this.lane.currentWind * 9)).toFixed(1) + ' ' + (this.lane.currentWind > 0 ? 'Right' : 'Left');
        };

        Babs.LaneRenderer.prototype.drawToast = function (W, H) {
            if (!this.lane._toast) return;
            const ctx = this.ctx; const a = Math.min(1, this.lane._toast.t / 30);
            ctx.globalAlpha = a; ctx.textAlign = 'center';
            ctx.font = `900 ${Math.round(W * 0.06)}px Fredoka`;
            ctx.fillStyle = this.lane._toast.color; ctx.fillText(this.lane._toast.text, W / 2, H * 0.34);
            ctx.globalAlpha = 1; ctx.textAlign = 'left';
        };
