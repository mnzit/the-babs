// lane.js — extracted from index.html (P0 mechanical split, verbatim)
        // ---------------------------------------------------------------------------
        // Lane: a fully self-contained mini-game (own engine, crane, camera, canvas)
        // ---------------------------------------------------------------------------
        function Lane(canvas, lanePlayers, accent) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.players = lanePlayers;        // turn order within this lane
            this.currentPlayerIndex = 0;
            this.accent = accent || '#3b82f6';

            this.engine = Engine.create({ gravity: { y: 1.2 } });
            this.ground = Bodies.rectangle(CANVAS_WIDTH / 2, PLATFORM_Y + 15, CANVAS_WIDTH - 120, 30, { isStatic: true, friction: 1.0 });
            Composite.add(this.engine.world, [this.ground]);

            this.blocks = [];
            this.particles = [];
            this.junk = [];               // sabotage houses dumped by the rival
            this.hanging = null;
            this.isHanging = false;
            this.pending = null; this.pendingFrames = 0;
            this.pivotY = 50; this.targetPivotY = 50;
            this.cameraYOffset = 0; this.targetCameraYOffset = 0;
            this.swingTime = 0;
            this.successfulDrops = 0;
            this.combo = 0;
            this.currentWind = 0; this.targetWind = 0;
            this.alive = true;
            this.sabotage = null;
            this.flash = 0;               // brief screen tint when sabotaged
        }

        Lane.prototype.player = function () { return this.players[this.currentPlayerIndex]; };

        Lane.prototype.spawnHanging = function () {
            if (this.hanging) Composite.remove(this.engine.world, this.hanging);
            let w = DEFAULT_BOX_WIDTH, h = DEFAULT_BOX_HEIGHT, massMult = 1.0;
            if (this.sabotage === 'anvil') { w = DEFAULT_BOX_WIDTH * 1.3; h = DEFAULT_BOX_HEIGHT * 1.15; massMult = 3.5; }
            const s = shrinkScale(this.successfulDrops);
            w *= s; h *= s;
            const b = Bodies.rectangle(CANVAS_WIDTH / 2, this.pivotY + ropeLength, w, h, {
                isSensor: true, isStatic: false,
                friction: this.sabotage === 'ice' ? 0.02 : 0.95,
                frictionStatic: this.sabotage === 'ice' ? 0.02 : 1.0,
                frictionAir: 0.02, restitution: 0
            });
            Body.setMass(b, b.mass * massMult);
            b.boxWidth = w; b.boxHeight = h;
            b.playerCreator = this.player();
            b.sabotageActive = this.sabotage;
            b.eyeState = 'neutral';
            b.styleIndex = Math.floor(Math.random() * HOUSE_STYLES.length); // each house looks different
            b.guyPhase = Math.random() * Math.PI * 2;                       // varied character animation
            Babs.Houses.pickRandom().initBlock(b);                          // pick a house type + seed its props
            this.hanging = b;
            this.isHanging = true;
        };

        Lane.prototype.drop = function () {
            if (!matchActive || !this.alive || !this.isHanging || !this.hanging) return;
            if (this.player().isAI && !this._aiTrigger) return;
            Babs.bus.emit('house:dropped', { lane: this, block: this.hanging });
            this.isHanging = false;
            this.hanging.isSensor = false;
            Composite.add(this.engine.world, this.hanging);
            const swingSpeed = 1.75 + this.successfulDrops * 0.04;
            const thetaMax = 0.52;
            const theta = thetaMax * Math.sin(this.swingTime * swingSpeed);
            const thetaPrime = thetaMax * swingSpeed * Math.cos(this.swingTime * swingSpeed);
            let vx = ropeLength * thetaPrime * Math.cos(theta) * 0.006;
            vx = Math.max(-1.2, Math.min(1.2, vx));
            Body.setVelocity(this.hanging, { x: vx, y: 1.6 });
            this.blocks.push(this.hanging);
            const dropped = this.hanging;
            this.hanging = null;
            dropped.eyeState = 'falling';
            this.pending = dropped; this.pendingFrames = 0;
        };

        Lane.prototype.checkSettle = function () {
            if (!this.pending) return;
            this.pendingFrames++;
            const b = this.pending;
            const speed = Math.hypot(b.velocity.x, b.velocity.y);
            // the moment the house drops past the bottom of the visible screen, it's a miss
            const screenBottom = CANVAS_HEIGHT - this.cameraYOffset;
            const offScreen = b.position.y > screenBottom || b.position.x < -120 || b.position.x > CANVAS_WIDTH + 120;
            const settled = this.pendingFrames > 25 && speed < 0.4;
            const timedOut = this.pendingFrames > 260;
            if (offScreen || settled || timedOut) { const blk = this.pending; this.pending = null; if (offScreen) blk._fellOff = true; this.evaluate(blk); }
        };

        Lane.prototype.evaluate = function (block) {
            if (!matchActive || !this.alive) return;
            const isFirst = this.blocks.length <= 1;
            const supportBlock = isFirst ? null : this.blocks[this.blocks.length - 2];
            const supportX = isFirst ? CANVAS_WIDTH / 2 : supportBlock.position.x;
            const supportW = isFirst ? DEFAULT_BOX_WIDTH : (supportBlock.boxWidth || DEFAULT_BOX_WIDTH);
            const offset = Math.abs(block.position.x - supportX);
            const perfect = offset < (isFirst ? 16 : supportW * 0.13);
            const maxStackOffset = isFirst ? 150 : supportW * 0.7;
            const blockH = block.boxHeight || DEFAULT_BOX_HEIGHT;
            const missedEntirely = block._fellOff || block.position.y > PLATFORM_Y + 100;
            const notOnTop = supportBlock && block.position.y > supportBlock.position.y - blockH * 0.4;

            if (missedEntirely || offset > maxStackOffset || notOnTop) {
                Babs.bus.emit('house:missed', { lane: this, loser: block.playerCreator });
                this.toast('MISSED', '#f43f5e');
                if (missedEntirely) {
                    Composite.remove(this.engine.world, block);
                    const i = this.blocks.indexOf(block); if (i > -1) this.blocks.splice(i, 1);
                }
                this.combo = 0;
                endLane(this, block.playerCreator);
                return;
            }

            this.spawnParticles(block.position.x, block.position.y - blockH / 2, perfect ? 16 : 8);
            this.successfulDrops++;

            if (perfect) {
                Babs.bus.emit('house:perfect', { lane: this, block: block });
                this.combo++;
                block.eyeState = 'happy'; block.starSparkles = true;
                if (this.combo >= 3) {
                    this.combo = 0;
                    this.toast('COMBO! SABOTAGE', '#10b981');
                    triggerComboEffect(this);
                } else {
                    this.toast('PERFECT', '#10b981');
                }
            } else {
                Babs.bus.emit('house:settled', { lane: this, block: block, perfect: false });
                this.combo = 0;
                if (offset > 35) { Babs.bus.emit('house:wobbly', { lane: this, block: block, offset: offset }); this.toast('WOBBLY', '#d97706'); block.eyeState = 'panicked'; }
            }

            // Every 50 m (5 blocks): lock the tower and build a wooden scaffold "new level" -- a
            // wide plank on criss-cross stilts that bridges back over the tower, so you can keep
            // building even when the top house is hanging off the edge.
            if (this.successfulDrops % 5 === 0) {
                this.blocks.forEach(b => { if (!b.isStatic) Body.setStatic(b, true); });
                this.addScaffold();
                this.toast('NEW LEVEL!', '#6366f1'); Babs.bus.emit('level:up', { lane: this, drops: this.successfulDrops });
            }

            // Battle: pull far enough ahead and your rival is out.
            if (gameMode === 'battle') checkBattleLead();
            this.advanceTurn();
        };

        Lane.prototype.advanceTurn = function () {
            if (!matchActive || !this.alive) return;
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            this.sabotage = null;
            this.spawnHanging();
            updateControllerUI();
            if (this.player().isAI) this.runAI();
        };

        Lane.prototype.runAI = function () {
            const self = this;
            setTimeout(function () {
                if (!matchActive || !self.alive || !self.player().isAI) return;
                const timer = setInterval(function () {
                    if (!self.hanging || !self.isHanging) { clearInterval(timer); return; }
                    const targetX = self.blocks.length ? self.blocks[self.blocks.length - 1].position.x : CANVAS_WIDTH / 2;
                    const diff = Math.abs(self.hanging.position.x - targetX);
                    if (diff < 16) { clearInterval(timer); self._aiTrigger = true; self.drop(); self._aiTrigger = false; }
                }, 100);
            }, 1200);
        };

        Lane.prototype.checkCollapse = function () {
            if (!matchActive || !this.alive) return;
            let collapse = false, who = null;
            for (let i = 0; i < this.blocks.length; i++) {
                const b = this.blocks[i];
                if (b.isStatic) continue;
                if (b.position.y > PLATFORM_Y + 70 || b.position.x < -100 || b.position.x > CANVAS_WIDTH + 100) {
                    collapse = true; who = b.playerCreator;
                    Composite.remove(this.engine.world, b); this.blocks.splice(i, 1); i--;
                }
            }
            // A house that slid off the stack and is now resting on the platform
            // beside the tower is a loss — only the foundation may sit on the ground.
            const base = this.blocks[0];
            for (let i = 0; i < this.blocks.length; i++) {
                const b = this.blocks[i];
                if (b === base || b.isScaffold) continue;
                const bh = b.boxHeight || DEFAULT_BOX_HEIGHT;
                const onGround = (b.position.y + bh / 2) >= (PLATFORM_Y - 8);
                const settledOnGround = onGround && b.speed < 1.4;
                if (settledOnGround) { collapse = true; who = b.playerCreator || this.player(); }
            }
            const live = this.blocks.filter(b => !b.isStatic);
            if (live.length >= 3 && live.filter(b => Math.abs(b.angle) > 0.48).length >= 3) { collapse = true; who = this.player(); }
            if (collapse) { Babs.bus.emit('lane:collapsed', { lane: this, who: who }); endLane(this, who); }
        };

        Lane.prototype.queueSpell = function (type) {
            const cost = type === 'anvil' ? 2 : 1;
            const p = this.player();
            if ((p.spellEnergy || 0) < cost) { this.toast('NO ENERGY', '#ef4444'); Babs.bus.emit('spell:noenergy', { lane: this, type: type }); return; }
            Babs.bus.emit('spell:queued', { lane: this, type: type });
            p.spellEnergy -= cost;
            this.sabotage = type;
            this.toast(this.player().name + ' cast ' + type.toUpperCase(), '#ec4899');
            updateControllerUI();
        };

        // sabotage: turn the rival's CURRENT house (on the crane, or the one they're dropping)
        // into a heavy junk house so it wrecks their stack instead of dropping a random block.
        Lane.prototype.dropJunk = function (byName) {
            let target = this.hanging || this.pending;
            if (!target) { this.spawnHanging(); target = this.hanging; }
            if (!target) return;
            target.isJunkHouse = true; target.byName = byName || '';
            const f = 0.68;                              // smaller than the normal house, to trick them
            Body.scale(target, f, f);
            target.boxWidth = (target.boxWidth || DEFAULT_BOX_WIDTH) * f;
            target.boxHeight = (target.boxHeight || DEFAULT_BOX_HEIGHT) * f;
            Body.setMass(target, target.mass * 5);      // ...but secretly a heavy anvil
            this.flash = 1;
            this.toast((byName || 'Rival') + ' swapped your house for JUNK!', '#ef4444');
            Babs.bus.emit('sabotage:junk', { lane: this, byName: byName });
        };

        Lane.prototype.spikeWind = function (byName) {
            this.targetWind = (Math.random() < 0.5 ? -1 : 1) * 2.8;
            this.flash = 1;
            this.toast((byName ? byName + "'s " : '') + 'GALE!', '#0891b2');
            Babs.bus.emit('sabotage:wind', { lane: this, byName: byName });
        };

        // Zap the house they're about to drop -- off the crane or while it's falling -- so they
        // lose it and have to wait for a new one (slows them down).
        Lane.prototype.zapHouse = function (byName) {
            let target = null;
            if (this.pending) {
                target = this.pending; this.pending = null;
                const i = this.blocks.indexOf(target); if (i > -1) this.blocks.splice(i, 1);
                Composite.remove(this.engine.world, target);
            } else if (this.hanging) {
                target = this.hanging; Composite.remove(this.engine.world, this.hanging);
                this.hanging = null; this.isHanging = false;
            }
            if (target) { this.spawnExplosion(target.position.x, target.position.y, target.boxWidth || DEFAULT_BOX_WIDTH); Babs.bus.emit('sabotage:zap', { lane: this, byName: byName }); }
            this.flash = 1;
            this.toast((byName || 'Rival') + ' BLEW UP your house!', '#a855f7');
            const self = this;
            setTimeout(function () { if (matchActive && self.alive && !self.hanging && !self.pending) self.spawnHanging(); }, 700);
        };

        // A big burst: house chunks fly out in every direction + a bright flash.
        Lane.prototype.spawnExplosion = function (x, y, size) {
            const colors = ['#d97706', '#fef3c7', '#78350f', '#3b82f6', '#fbbf24', '#f97316', '#ef4444'];
            for (let i = 0; i < 28; i++) {
                const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 8;
                this.particles.push({
                    x: x + (Math.random() - 0.5) * size * 0.4, y: y + (Math.random() - 0.5) * size * 0.4,
                    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
                    size: Math.random() * 11 + 5, color: colors[(Math.random() * colors.length) | 0],
                    life: 1.0, decay: Math.random() * 0.01 + 0.005, gravity: true, square: true
                });
            }
            for (let i = 0; i < 8; i++) {           // bright fireball puffs
                const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
                this.particles.push({
                    x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                    size: Math.random() * 18 + 12, color: i % 2 ? 'rgba(255,224,130,0.85)' : 'rgba(255,140,60,0.8)',
                    life: 1.0, decay: 0.05
                });
            }
        };

        Lane.prototype.toast = function (text, color) { this._toast = { text: text, color: color || '#3b82f6', t: 90 }; };

        // Build a wooden scaffold platform on top of the current tower: a wide plank raised on
        // criss-cross stilts, nudged back toward the lane centre so it bridges over an
        // overhanging top house and gives the next level a stable, forgiving base.
        Lane.prototype.addScaffold = function () {
            let top = null, topY = Infinity;
            this.blocks.forEach(b => { if (b.position.y < topY) { topY = b.position.y; top = b; } });
            if (!top) return;
            const tw = top.boxWidth || DEFAULT_BOX_WIDTH, th = top.boxHeight || DEFAULT_BOX_HEIGHT;
            const sw = Math.max(DEFAULT_BOX_WIDTH * 1.25, tw * 1.15), sh = 16, gap = 26;
            const topEdge = top.position.y - th / 2;
            // bias the new level back toward the lane centre (where the crane drops) so the bridge
            // re-centres the tower; the legs then slant out to the off-centre house below.
            let sx = top.position.x + (CANVAS_WIDTH / 2 - top.position.x) * 0.7;
            sx = Math.max(sw / 2 + 8, Math.min(CANVAS_WIDTH - sw / 2 - 8, sx));
            const sy = topEdge - gap - sh / 2;
            const beam = Bodies.rectangle(sx, sy, sw, sh, { isStatic: true, friction: 1.0 });
            beam.boxWidth = sw; beam.boxHeight = sh; beam.isScaffold = true;
            beam.legY = gap + sh / 2;                 // local y of the support's top
            beam.supDx = top.position.x - sx;         // horizontal offset to the support house
            beam.supW = tw;
            Composite.add(this.engine.world, beam);
            this.blocks.push(beam);
        };

        Lane.prototype.spawnParticles = function (x, y, count) {
            for (let i = 0; i < count; i++) this.particles.push({
                x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 15,
                vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4 - 1.5,
                size: Math.random() * 22 + 10,
                color: `rgba(${250 + Math.random() * 5}, ${220 + Math.random() * 20}, ${150 + Math.random() * 50}, 0.55)`,
                life: 1.0, decay: Math.random() * 0.03 + 0.015
            });
        };

        Lane.prototype.updatePhysics = function () {
            // Wind blows the falling house sideways (force at the top edge so it also tilts a
            // little, like real wind pushing an object).
            if (this.pending && !this.pending.isStatic) {
                const ph = this.pending.boxHeight || DEFAULT_BOX_HEIGHT;
                const at = { x: this.pending.position.x, y: this.pending.position.y - ph * 0.35 };
                Body.applyForce(this.pending, at, { x: this.currentWind * 0.00011 * this.pending.mass, y: 0 });
            }
            Engine.update(this.engine, 1000 / 60);
            this.checkSettle();
            this.checkCollapse();
            this.swingTime += 0.013;
            this.currentWind += (this.targetWind - this.currentWind) * 0.03;

            // junk that fell away can be forgotten
            this.junk = this.junk.filter(j => j.position.y < PLATFORM_Y + 400);

            let top = PLATFORM_Y;
            this.blocks.forEach(b => { if (b === this.pending) return; const t = b.position.y - (b.boxHeight || DEFAULT_BOX_HEIGHT) / 2; if (t < top) top = t; });
            this.targetPivotY = Math.min(50, top - HANG_OFFSET);
            this.targetCameraYOffset = Math.max(0, 470 - top);
            this.pivotY += (this.targetPivotY - this.pivotY) * 0.08;
            this.cameraYOffset += (this.targetCameraYOffset - this.cameraYOffset) * 0.08;
            if (this.flash > 0) this.flash -= 0.04;
            if (this._toast) { this._toast.t--; if (this._toast.t <= 0) this._toast = null; }
        };

        // ---- Game-over demolition: pan to the base, then a clean bottom-up chain reaction:
        //      the base house shatters to nothing, the tower above drops one slot into its place,
        //      that new base shatters, the rest drop again... all the way up. ----
        Lane.prototype.startDemolition = function () {
            this.demolishing = true;
            this.demoState = 'intro'; this._wait = 0;
            Babs.bus.emit('demolition:start', { lane: this });   // the building starts crashing down
            this.blocks.forEach(b => { b.wasPanicking = true; }); // they're all doomed now
            this.isHanging = false; this.hanging = null;
            this.targetCameraYOffset = 0;        // pan the camera down to the ground
            this.junk.forEach(j => Composite.remove(this.engine.world, j)); this.junk = [];
            // freeze everything so the chain is fully controlled (no chaotic physics)
            this.blocks.forEach(b => { if (!b.isStatic) Body.setStatic(b, true); });
        };

        Lane.prototype.spawnDebris = function (x, y, w) {
            const colors = ['#d97706', '#fef3c7', '#78350f', '#3b82f6', '#fbbf24'];
            for (let i = 0; i < 16; i++) this.particles.push({
                x: x + (Math.random() - 0.5) * w, y: y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 6 - 1,
                size: Math.random() * 9 + 5, color: colors[(Math.random() * colors.length) | 0],
                life: 1.0, decay: Math.random() * 0.012 + 0.006, gravity: true, square: true
            });
        };

        Lane.prototype.breakBlock = function (block) {
            this.spawnDebris(block.position.x, block.position.y, block.boxWidth || DEFAULT_BOX_WIDTH);
            Composite.remove(this.engine.world, block);
            const i = this.blocks.indexOf(block); if (i > -1) this.blocks.splice(i, 1);
            Babs.bus.emit('demolition:step', { lane: this });
        };

        Lane.prototype.lowestBlock = function () {
            let low = null; this.blocks.forEach(b => { if (!low || b.position.y > low.position.y) low = b; });
            return low;
        };

        Lane.prototype.updateDemolition = function () {
            this.swingTime += 0.013;
            this.cameraYOffset += (this.targetCameraYOffset - this.cameraYOffset) * 0.08;
            if (this._toast) { this._toast.t--; if (this._toast.t <= 0) this._toast = null; }
            const FALL_FRAMES = 7;

            if (this.demoState === 'intro') {
                // let the camera settle on the base before we start
                if (++this._wait > 18) this.demoState = 'break';
                return;
            }

            if (this.demoState === 'break') {
                if (this.blocks.length === 0) { this.demolishing = false; return; }
                this.breakBlock(this.lowestBlock());                 // base house shatters to none
                if (this.blocks.length === 0) { this.demolishing = false; return; }
                // set up the drop: shift the rest down so the new base rests on the platform
                const nb = this.lowestBlock();
                const shift = (PLATFORM_Y - (nb.boxHeight || DEFAULT_BOX_HEIGHT) / 2) - nb.position.y;
                if (shift > 0.5) {
                    this.blocks.forEach(b => { b._fromY = b.position.y; b._toY = b.position.y + shift; });
                    this._fall = 0; this.demoState = 'falling';
                } else {
                    this.demoState = 'break'; // already at base, shatter again next frame
                }
                return;
            }

            if (this.demoState === 'falling') {
                this._fall++;
                const t = Math.min(1, this._fall / FALL_FRAMES);
                const e = t * t;                                     // ease-in = falling under gravity
                this.blocks.forEach(b => { Body.setPosition(b, { x: b.position.x, y: b._fromY + (b._toY - b._fromY) * e }); });
                if (t >= 1) this.demoState = 'break';
                return;
            }
        };
        // ---------------------------------------------------------------------------
        // Lane rendering
        // ---------------------------------------------------------------------------
        Lane.prototype.resize = function () {
            const dpr = window.devicePixelRatio || 1;
            const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
            const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
            if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
        };

        Lane.prototype.render = function () {
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
            ctx.translate(0, this.cameraYOffset);
            this.drawBackground();
            this.drawPlatform();
            this.drawBlocks();
            this.drawJunk();
            if (!this.demolishing) this.drawCrane();
            this.drawParticles();
            ctx.restore();
            if (!this.demolishing) this.drawFlagHUD();

            // sabotage flash tint
            if (this.flash > 0) { ctx.fillStyle = `rgba(239,68,68,${0.18 * this.flash})`; ctx.fillRect(0, -this.cameraYOffset, CANVAS_WIDTH, CANVAS_HEIGHT); }

            // screen-space wind streaks + lane header + toast
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.drawWind(W, H);
            this.drawHeader(W, scale, offX);
            this.drawToast(W, H);
        };

        // Thin curvy wind lines that flow across the screen in the wind's direction.
        Lane.prototype.drawWind = function (W, H) {
            if (Math.abs(this.currentWind) < 0.3) return;
            const ctx = this.ctx;
            const dir = this.currentWind > 0 ? 1 : -1;
            const strength = Math.min(1, Math.abs(this.currentWind) / 1.3);
            const sc = W / 550;
            const lines = 9, len = W * 0.2 * (0.6 + 0.4 * strength);
            const speed = 0.12 + 0.07 * Math.abs(this.currentWind);
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.32 + 0.3 * strength) + ')';
            ctx.lineWidth = 1.8 * sc; ctx.lineCap = 'round';
            for (let i = 0; i < lines; i++) {
                const phase = (i * 0.61803) % 1;
                const prog = (this.swingTime * speed + phase * 1.7) % 1;
                const span = W + 2 * len;
                const headX = dir > 0 ? (prog * span - len) : (W + len - prog * span);
                const y = H * (0.08 + 0.84 * phase) + Math.sin(this.swingTime * 1.5 + i) * 5 * sc;
                ctx.beginPath();
                const N = 7;
                for (let s = 0; s <= N; s++) {
                    const t2 = s / N;
                    const px = headX - dir * len * t2;
                    const py = y + Math.sin(t2 * Math.PI * 1.7 + this.swingTime * 3 + i) * 3.4 * sc;
                    if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            ctx.restore();
        };

        Lane.prototype.drawBackground = function () {
            const ctx = this.ctx;
            const sky = ctx.createLinearGradient(0, -1500, 0, CANVAS_HEIGHT);
            sky.addColorStop(0, '#0284c7'); sky.addColorStop(0.4, '#bae6fd'); sky.addColorStop(1, '#bae6fd');
            ctx.fillStyle = sky; ctx.fillRect(-4000, -3000, CANVAS_WIDTH + 8000, CANVAS_HEIGHT + 3500);
            ctx.fillStyle = 'rgba(255,253,224,0.95)';
            ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 100, 220 - this.cameraYOffset * 0.25, 45, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,253,224,0.2)';
            ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 100, 220 - this.cameraYOffset * 0.25, 75, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(120, 260 - this.cameraYOffset * 0.35, 40, 0, Math.PI * 2);
            ctx.arc(160, 250 - this.cameraYOffset * 0.35, 50, 0, Math.PI * 2);
            ctx.arc(200, 260 - this.cameraYOffset * 0.35, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6ee7b7'; ctx.beginPath(); ctx.arc(100, PLATFORM_Y + 160, 250, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#34d399'; ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 120, PLATFORM_Y + 180, 230, 0, Math.PI * 2); ctx.fill();
        };

        Lane.prototype.drawPlatform = function () {
            const ctx = this.ctx, pos = this.ground.position;
            ctx.fillStyle = '#d97706';
            ctx.beginPath(); ctx.roundRect(pos.x - (CANVAS_WIDTH - 120) / 2 - 5, pos.y - 15, CANVAS_WIDTH - 110, 30, 8); ctx.fill();
            ctx.strokeStyle = '#78350f'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#fbbf24'; ctx.fillRect(pos.x - (CANVAS_WIDTH - 120) / 2 + 10, pos.y - 11, CANVAS_WIDTH - 140, 8);
        };

        Lane.prototype.drawHouse = function (block, emotion, isTop) {
            const ctx = this.ctx;
            const x = block.position.x, y = block.position.y, angle = block.angle;
            const w = block.boxWidth || DEFAULT_BOX_WIDTH, h = block.boxHeight || DEFAULT_BOX_HEIGHT;
            const st = HOUSE_STYLES[(block.styleIndex || 0) % HOUSE_STYLES.length];
            const k = h / DEFAULT_BOX_HEIGHT;
            const t = this.swingTime, ph = block.guyPhase || 0;
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
        Lane.prototype.drawGuy = function (cx, cy, s, emotion, t, phase, color, facing, squish, girl) {
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
        Lane.prototype.drawHead = function (cx, cy, s, emotion, t, phase, color, facing) {
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

        Lane.prototype.drawBlocks = function () {
            // find the top SETTLED house so rooftop residents only get squished once a house
            // actually lands on them (the still-falling block is excluded).
            let topBlock = null, topY = Infinity;
            this.blocks.forEach(b => { if (b === this.pending) return; if (b.position.y < topY) { topY = b.position.y; topBlock = b; } });
            this.blocks.forEach(b => {
                const panic = this.demolishing || Math.abs(b.angle) > 0.22 || Math.abs(b.angularSpeed || 0) > 0.06;
                // Scream only on a real "about to fall" tilt (or demolition), edge-triggered.
                const screamWorthy = this.demolishing || Math.abs(b.angle) > 0.3;
                if (screamWorthy && !b.wasPanicking) Babs.bus.emit('lane:panic', { lane: this, block: b });
                b.wasPanicking = screamWorthy;
                this.drawHouse(b, panic ? 'panic' : 'idle', b === topBlock);
                if (b.starSparkles) this.drawSparkles(b.position.x, b.position.y);
            });
        };

        Lane.prototype.drawJunk = function () {
            const ctx = this.ctx;
            this.junk.forEach(j => {
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

        Lane.prototype.drawBalancers = function (top) {
            const ctx = this.ctx, h = top.boxHeight || DEFAULT_BOX_HEIGHT;
            ctx.save(); ctx.translate(top.position.x, top.position.y - h / 2); ctx.rotate(top.angle);
            [{ o: -22, c: this.accent, i: 0 }, { o: 22, c: '#ec4899', i: 1 }].forEach(bab => {
                ctx.save(); ctx.translate(bab.o, -12);
                const shake = Math.sin(this.swingTime * 4 + bab.i) * 3;
                ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(-4, 14); ctx.lineTo(-6 + shake, 4); ctx.moveTo(4, 14); ctx.lineTo(6 - shake, 4); ctx.stroke();
                ctx.fillStyle = bab.c; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -4, 4, 0, Math.PI * 2); ctx.arc(4, -4, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-4, -6, 2, 0, Math.PI * 2); ctx.arc(4, -6, 2, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            });
            ctx.restore();
        };

        Lane.prototype.drawSparkles = function (cx, cy) {
            const ctx = this.ctx; ctx.save(); ctx.fillStyle = '#facc15';
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3 + this.swingTime; const d = 65 + Math.sin(this.swingTime * 3) * 8;
                ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        };

        // A toothed gear/cog. Drawn centred at (cx,cy), rotated by `ang`.
        Lane.prototype.drawGear = function (cx, cy, r, teeth, ang, fill, stroke, hub) {
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

        Lane.prototype.drawCrane = function () {
            const ctx = this.ctx;
            // gantry beam
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 14;
            ctx.beginPath(); ctx.moveTo(30, this.pivotY - 20); ctx.lineTo(CANVAS_WIDTH - 30, this.pivotY - 20); ctx.stroke();

            const swingSpeed = 1.75 + this.successfulDrops * 0.04, thetaMax = 0.52;
            const windAngle = this.currentWind * 0.05;
            const swingAngle = thetaMax * Math.sin(this.swingTime * swingSpeed) + windAngle;
            const bx = pivotX + ropeLength * Math.sin(swingAngle);
            const by = this.pivotY + ropeLength * Math.cos(swingAngle);
            const mainR = 14;

            // rope from the pulley centre to the block (drawn before the gears so they appear to wrap it)
            let ex, ey;
            if (this.isHanging && this.hanging) {
                const hangAngle = -swingAngle;
                const bh = this.hanging.boxHeight || DEFAULT_BOX_HEIGHT;
                Body.setPosition(this.hanging, { x: bx, y: by });
                Body.setAngle(this.hanging, hangAngle);
                Body.setVelocity(this.hanging, { x: 0, y: 0 });
                Body.setAngularVelocity(this.hanging, 0);
                ex = pivotX + (ropeLength - bh / 2) * Math.sin(swingAngle);
                ey = this.pivotY + (ropeLength - bh / 2) * Math.cos(swingAngle);
                ctx.strokeStyle = '#78350f'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(pivotX, this.pivotY); ctx.lineTo(ex, ey); ctx.stroke();
            }

            // mounting bracket + the gear pulley that spins as the camera pans up the tower
            ctx.fillStyle = '#334155'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(pivotX - 7, this.pivotY - 24, 14, 16, 3); ctx.fill(); ctx.stroke();
            const ga = this.cameraYOffset * 0.05;
            this.drawGear(pivotX + 17, this.pivotY - 9, 8, 8, -ga * 1.75, '#94a3b8', '#475569', '#64748b'); // small gear (meshes, opposite)
            this.drawGear(pivotX, this.pivotY, mainR, 10, ga, '#64748b', '#1e293b', '#b45309');             // main pulley

            if (this.isHanging && this.hanging) this.drawHouse(this.hanging, 'idle', true);
        };

        Lane.prototype.drawFlagHUD = function () {
            if (this.blocks.length === 0) return;
            const ctx = this.ctx; let topY = PLATFORM_Y;
            this.blocks.forEach(b => { if (b.position.y < topY) topY = b.position.y; });
            const y = topY + this.cameraYOffset;
            ctx.save();
            ctx.strokeStyle = 'rgba(100,116,139,0.55)'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
            ctx.restore();
            ctx.save(); ctx.translate(20, y - 14);
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 25); ctx.lineTo(0, -10); ctx.stroke();
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(30, -2); ctx.lineTo(0, 6); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#334155'; ctx.font = 'bold 12px Fredoka';
            ctx.fillText((this.successfulDrops * 10).toFixed(0) + ' m', 36, 12);
            ctx.restore();
        };

        Lane.prototype.drawParticles = function () {
            const ctx = this.ctx;
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                if (p.gravity) p.vy += 0.35;            // debris falls
                p.x += p.vx; p.y += p.vy; p.life -= p.decay;
                if (p.life <= 0) { this.particles.splice(i, 1); continue; }
                ctx.fillStyle = p.color;
                if (p.square) {
                    const s = p.size * (0.5 + p.life * 0.5);
                    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
                } else {
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + p.life * 0.6), 0, Math.PI * 2); ctx.fill();
                }
            }
        };

        Lane.prototype.drawHeader = function (W, scale, offX) {
            // Only used in battle mode (solo uses the DOM HUD). Draw name/height/wind/combo.
            if (gameMode !== 'battle') return;
            const ctx = this.ctx; const pad = 10 * scale;
            ctx.font = `bold ${Math.round(20 * scale)}px Fredoka`;
            ctx.textAlign = 'left'; ctx.fillStyle = this.accent;
            const nm = this.player().name + (this.player().wins ? '  ★' + this.player().wins : '');
            ctx.fillText(nm, pad, 28 * scale);
            ctx.fillStyle = '#1e293b'; ctx.font = `bold ${Math.round(15 * scale)}px Fredoka`;
            ctx.fillText((this.successfulDrops * 10).toFixed(0) + ' m  -  ' + this.windLabel(), pad, 48 * scale);
            // combo pips
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = i < this.combo ? '#10b981' : 'rgba(255,255,255,0.6)';
                ctx.beginPath(); ctx.arc(pad + 8 * scale + i * 16 * scale, 64 * scale, 5 * scale, 0, Math.PI * 2); ctx.fill();
            }
            if (!this.alive) {
                ctx.fillStyle = 'rgba(15,23,42,0.55)'; ctx.fillRect(0, 0, W, this.canvas.height);
                ctx.fillStyle = '#fca5a5'; ctx.textAlign = 'center'; ctx.font = `900 ${Math.round(34 * scale)}px Fredoka`;
                ctx.fillText('FELL', W / 2, this.canvas.height / 2); ctx.textAlign = 'left';
            }
        };

        Lane.prototype.windLabel = function () {
            if (Math.abs(this.currentWind) < 0.3) return 'Calm';
            return (Math.abs(this.currentWind * 9)).toFixed(1) + ' ' + (this.currentWind > 0 ? 'Right' : 'Left');
        };

        Lane.prototype.drawToast = function (W, H) {
            if (!this._toast) return;
            const ctx = this.ctx; const a = Math.min(1, this._toast.t / 30);
            ctx.globalAlpha = a; ctx.textAlign = 'center';
            ctx.font = `900 ${Math.round(W * 0.06)}px Fredoka`;
            ctx.fillStyle = this._toast.color; ctx.fillText(this._toast.text, W / 2, H * 0.34);
            ctx.globalAlpha = 1; ctx.textAlign = 'left';
        };
