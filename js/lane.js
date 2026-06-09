// lane.js — Babs.Lane (game logic) + Babs.StackEvaluator (pure placement verdict).

        // ---------------------------------------------------------------------------
        // StackEvaluator: pure judgement of a single dropped house. No physics writes,
        // no DOM, no sound — given the geometry it returns a verdict the Lane acts on.
        // Thresholds come from CONFIG.evaluate, so placement feel is tunable in one place.
        //   verdict: 'missed' | 'wobbly' | 'perfect' | 'placed'
        // ---------------------------------------------------------------------------
        window.Babs = window.Babs || {};
        Babs.StackEvaluator = {
            judge: function (inp) {
                const cfg = inp.cfg;
                const offset = Math.abs(inp.blockX - inp.supportX);
                const perfect = offset < (inp.isFirst ? cfg.perfectFirst : inp.supportW * cfg.perfectFactor);
                const maxStackOffset = inp.isFirst ? cfg.maxOffsetFirst : inp.supportW * cfg.maxOffsetFactor;
                const missedEntirely = !!inp.fellOff || inp.blockY > inp.platformY + cfg.missedBelowPlatform;
                const notOnTop = inp.hasSupport && inp.blockY > inp.supportY - inp.blockH * cfg.notOnTopFactor;
                let verdict;
                if (missedEntirely || offset > maxStackOffset || notOnTop) verdict = 'missed';
                else if (perfect) verdict = 'perfect';
                else if (offset > cfg.wobbleThreshold) verdict = 'wobbly';
                else verdict = 'placed';
                return { verdict: verdict, perfect: perfect, offset: offset, missedEntirely: missedEntirely };
            }
        };

        // ---------------------------------------------------------------------------
        // Lane: a fully self-contained mini-game (own engine, crane, camera, canvas)
        // ---------------------------------------------------------------------------
        function Lane(canvas, lanePlayers, accent, deps) {
            // Dependency injection: the lane depends on these abstractions, not on the
            // global singletons directly (they're just the defaults). Pass mocks to test.
            deps = deps || {};
            this.config = deps.config || Babs.CONFIG;
            this.bus = deps.bus || Babs.bus;
            this.houses = deps.houses || Babs.Houses;
            this.evaluator = deps.evaluator || Babs.StackEvaluator;
            const cfg = this.config;

            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.players = lanePlayers;        // turn order within this lane
            this.currentPlayerIndex = 0;
            this.accent = accent || '#3b82f6';

            this.engine = Engine.create({ gravity: { y: cfg.world.gravityY } });
            this.ground = Bodies.rectangle(CANVAS_WIDTH / 2, PLATFORM_Y + cfg.world.groundThickness / 2, CANVAS_WIDTH - cfg.world.groundInset, cfg.world.groundThickness, { isStatic: true, friction: cfg.world.groundFriction });
            Composite.add(this.engine.world, [this.ground]);

            this.blocks = [];
            this.particles = [];
            this.junk = [];               // sabotage houses dumped by the rival
            this.hanging = null;
            this.isHanging = false;
            this.pending = null; this.pendingFrames = 0;
            this.pivotY = cfg.camera.maxPivotY; this.targetPivotY = cfg.camera.maxPivotY;
            this.cameraYOffset = 0; this.targetCameraYOffset = 0;
            this.swingTime = 0;
            this.successfulDrops = 0;
            this.combo = 0;
            this.currentWind = 0; this.targetWind = 0;
            this.alive = true;
            this.sabotage = null;
            this.flash = 0;               // brief screen tint when sabotaged
            this.renderer = new Babs.LaneRenderer(this);
        }

        Lane.prototype.player = function () { return this.players[this.currentPlayerIndex]; };

        Lane.prototype.spawnHanging = function () {
            if (this.hanging) Composite.remove(this.engine.world, this.hanging);
            const hz = this.config.hazards;
            let w = DEFAULT_BOX_WIDTH, h = DEFAULT_BOX_HEIGHT, massMult = 1.0;
            if (this.sabotage === 'anvil') { w = DEFAULT_BOX_WIDTH * hz.anvilWMult; h = DEFAULT_BOX_HEIGHT * hz.anvilHMult; massMult = hz.anvilMass; }
            const s = shrinkScale(this.successfulDrops);
            w *= s; h *= s;
            const b = Bodies.rectangle(CANVAS_WIDTH / 2, this.pivotY + ropeLength, w, h, {
                isSensor: true, isStatic: false,
                friction: this.sabotage === 'ice' ? hz.iceFriction : hz.normalFriction,
                frictionStatic: this.sabotage === 'ice' ? hz.iceFriction : hz.frictionStatic,
                frictionAir: hz.frictionAir, restitution: 0
            });
            Body.setMass(b, b.mass * massMult);
            b.boxWidth = w; b.boxHeight = h;
            b.playerCreator = this.player();
            b.sabotageActive = this.sabotage;
            b.eyeState = 'neutral';
            b.styleIndex = Math.floor(Math.random() * HOUSE_STYLES.length); // each house looks different
            b.guyPhase = Math.random() * Math.PI * 2;                       // varied character animation
            this.houses.pickRandom().initBlock(b);                          // pick a house type + seed its props
            this.hanging = b;
            this.isHanging = true;
        };

        Lane.prototype.drop = function () {
            if (!matchActive || !this.alive || !this.isHanging || !this.hanging) return;
            if (this.player().isAI && !this._aiTrigger) return;
            this.bus.emit('house:dropped', { lane: this, block: this.hanging });
            this.isHanging = false;
            this.hanging.isSensor = false;
            Composite.add(this.engine.world, this.hanging);
            const cr = this.config.crane;
            const swingSpeed = (cr.swingBase + this.successfulDrops * cr.swingPerDrop) * this.config.speed.pendulum;
            const thetaMax = cr.thetaMax;
            const theta = thetaMax * Math.sin(this.swingTime * swingSpeed);
            const thetaPrime = thetaMax * swingSpeed * Math.cos(this.swingTime * swingSpeed);
            let vx = ropeLength * thetaPrime * Math.cos(theta) * cr.vxFactor;
            vx = Math.max(-cr.vxClamp, Math.min(cr.vxClamp, vx));
            Body.setVelocity(this.hanging, { x: vx, y: cr.dropVelocityY * this.config.speed.drop });
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
            const cfg = this.config.evaluate;
            const isFirst = this.blocks.length <= 1;
            const supportBlock = isFirst ? null : this.blocks[this.blocks.length - 2];
            const supportX = isFirst ? CANVAS_WIDTH / 2 : supportBlock.position.x;
            const supportW = isFirst ? DEFAULT_BOX_WIDTH : (supportBlock.boxWidth || DEFAULT_BOX_WIDTH);
            const blockH = block.boxHeight || DEFAULT_BOX_HEIGHT;
            const v = this.evaluator.judge({
                isFirst: isFirst, hasSupport: !!supportBlock,
                blockX: block.position.x, blockY: block.position.y, blockH: blockH,
                supportX: supportX, supportW: supportW, supportY: supportBlock ? supportBlock.position.y : 0,
                fellOff: block._fellOff, platformY: PLATFORM_Y, cfg: cfg
            });
            const offset = v.offset, perfect = v.perfect;

            if (v.verdict === 'missed') {
                this.bus.emit('house:missed', { lane: this, loser: block.playerCreator });
                this.toast('MISSED', '#f43f5e');
                if (v.missedEntirely) {
                    Composite.remove(this.engine.world, block);
                    const i = this.blocks.indexOf(block); if (i > -1) this.blocks.splice(i, 1);
                }
                this.combo = 0;
                endLane(this, block.playerCreator);
                return;
            }

            this.spawnParticles(block.position.x, block.position.y - blockH / 2, perfect ? cfg.perfectParticles : cfg.normalParticles);
            this.successfulDrops++;

            if (perfect) {
                this.bus.emit('house:perfect', { lane: this, block: block });
                this.combo++;
                block.eyeState = 'happy'; block.starSparkles = true;
                if (this.combo >= cfg.comboTarget) {
                    this.combo = 0;
                    this.toast('COMBO! SABOTAGE', '#10b981');
                    triggerComboEffect(this);
                } else {
                    this.toast('PERFECT', '#10b981');
                }
            } else {
                this.bus.emit('house:settled', { lane: this, block: block, perfect: false });
                this.combo = 0;
                if (v.verdict === 'wobbly') { this.bus.emit('house:wobbly', { lane: this, block: block, offset: offset }); this.toast('WOBBLY', '#d97706'); block.eyeState = 'panicked'; }
            }

            // Every 50 m (lockEvery blocks): lock the tower and build a wooden scaffold "new level" --
            // a wide plank on criss-cross stilts that bridges back over the tower, so you can keep
            // building even when the top house is hanging off the edge.
            if (this.successfulDrops % cfg.lockEvery === 0) {
                this.blocks.forEach(b => { if (!b.isStatic) Body.setStatic(b, true); });
                this.addScaffold();
                this.toast('NEW LEVEL!', '#6366f1'); this.bus.emit('level:up', { lane: this, drops: this.successfulDrops });
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
            const self = this, ai = this.config.ai;
            setTimeout(function () {
                if (!matchActive || !self.alive || !self.player().isAI) return;
                const timer = setInterval(function () {
                    if (!self.hanging || !self.isHanging) { clearInterval(timer); return; }
                    const targetX = self.blocks.length ? self.blocks[self.blocks.length - 1].position.x : CANVAS_WIDTH / 2;
                    const diff = Math.abs(self.hanging.position.x - targetX);
                    if (diff < ai.aimTolerance) { clearInterval(timer); self._aiTrigger = true; self.drop(); self._aiTrigger = false; }
                }, ai.tickMs);
            }, ai.thinkDelayMs);
        };

        Lane.prototype.checkCollapse = function () {
            if (!matchActive || !this.alive) return;
            const cc = this.config.collapse;
            let collapse = false, who = null;
            for (let i = 0; i < this.blocks.length; i++) {
                const b = this.blocks[i];
                if (b.isStatic) continue;
                if (b.position.y > PLATFORM_Y + cc.belowPlatform || b.position.x < cc.xOutLeft || b.position.x > CANVAS_WIDTH + cc.xOutRight) {
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
                const onGround = (b.position.y + bh / 2) >= (PLATFORM_Y - cc.besideMargin);
                const settledOnGround = onGround && b.speed < cc.besideSpeed;
                if (settledOnGround) { collapse = true; who = b.playerCreator || this.player(); }
            }
            const live = this.blocks.filter(b => !b.isStatic);
            if (live.length >= cc.tiltCount && live.filter(b => Math.abs(b.angle) > cc.tiltAngle).length >= cc.tiltCount) { collapse = true; who = this.player(); }
            
            if (this.blocks.length > 2) {
                const screenBottom = CANVAS_HEIGHT - this.cameraYOffset;
                let top = PLATFORM_Y;
                this.blocks.forEach(b => { if (b === this.pending) return; const t = b.position.y - (b.boxHeight || DEFAULT_BOX_HEIGHT) / 2; if (t < top) top = t; });
                if (top > screenBottom + 50) {
                    collapse = true; who = this.player();
                    if (!this.tooSlowToast) { this.toast('TOO SLOW!', '#ef4444'); this.tooSlowToast = true; }
                }
            }
            
            if (collapse) { this.bus.emit('lane:collapsed', { lane: this, who: who }); endLane(this, who); }
        };

        Lane.prototype.queueSpell = function (type) {
            const cost = type === 'anvil' ? this.config.spell.anvilCost : this.config.spell.defaultCost;
            const p = this.player();
            if ((p.spellEnergy || 0) < cost) { this.toast('NO ENERGY', '#ef4444'); this.bus.emit('spell:noenergy', { lane: this, type: type }); return; }
            this.bus.emit('spell:queued', { lane: this, type: type });
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
            const f = this.config.hazards.junkScale;     // smaller than the normal house, to trick them
            Body.scale(target, f, f);
            target.boxWidth = (target.boxWidth || DEFAULT_BOX_WIDTH) * f;
            target.boxHeight = (target.boxHeight || DEFAULT_BOX_HEIGHT) * f;
            Body.setMass(target, target.mass * this.config.hazards.junkMassMult);   // ...but secretly a heavy anvil
            this.flash = 1;
            this.toast((byName || 'Rival') + ' swapped your house for JUNK!', '#ef4444');
            this.bus.emit('sabotage:junk', { lane: this, byName: byName });
        };

        Lane.prototype.spikeWind = function (byName) {
            this.targetWind = (Math.random() < 0.5 ? -1 : 1) * this.config.wind.spikeMag;
            this.flash = 1;
            this.toast((byName ? byName + "'s " : '') + 'GALE!', '#0891b2');
            this.bus.emit('sabotage:wind', { lane: this, byName: byName });
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
            if (target) { this.spawnExplosion(target.position.x, target.position.y, target.boxWidth || DEFAULT_BOX_WIDTH); this.bus.emit('sabotage:zap', { lane: this, byName: byName }); }
            this.flash = 1;
            this.toast((byName || 'Rival') + ' BLEW UP your house!', '#a855f7');
            const self = this;
            setTimeout(function () { if (matchActive && self.alive && !self.hanging && !self.pending) self.spawnHanging(); }, this.config.hazards.zapRespawnMs);
        };

        // A big burst: house chunks fly out in every direction + a bright flash.
        Lane.prototype.spawnExplosion = function (x, y, size) {
            const colors = ['#d97706', '#fef3c7', '#78350f', '#3b82f6', '#fbbf24', '#f97316', '#ef4444'];
            for (let i = 0; i < this.config.demolition.explosionShards; i++) {
                const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 8;
                this.particles.push({
                    x: x + (Math.random() - 0.5) * size * 0.4, y: y + (Math.random() - 0.5) * size * 0.4,
                    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
                    size: Math.random() * 11 + 5, color: colors[(Math.random() * colors.length) | 0],
                    life: 1.0, decay: Math.random() * 0.01 + 0.005, gravity: true, square: true
                });
            }
            for (let i = 0; i < this.config.demolition.explosionPuffs; i++) {           // bright fireball puffs
                const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
                this.particles.push({
                    x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                    size: Math.random() * 18 + 12, color: i % 2 ? 'rgba(255,224,130,0.85)' : 'rgba(255,140,60,0.8)',
                    life: 1.0, decay: 0.05
                });
            }
        };

        Lane.prototype.toast = function (text, color) { this._toast = { text: text, color: color || '#3b82f6', t: this.config.toast.frames }; };

        // Build a wooden scaffold platform on top of the current tower: a wide plank raised on
        // criss-cross stilts, nudged back toward the lane centre so it bridges over an
        // overhanging top house and gives the next level a stable, forgiving base.
        Lane.prototype.addScaffold = function () {
            let top = null, topY = Infinity;
            this.blocks.forEach(b => { if (b.position.y < topY) { topY = b.position.y; top = b; } });
            if (!top) return;
            const sc = this.config.scaffold;
            const tw = top.boxWidth || DEFAULT_BOX_WIDTH, th = top.boxHeight || DEFAULT_BOX_HEIGHT;
            const sw = Math.max(DEFAULT_BOX_WIDTH * sc.minWidthFactor, tw * sc.widthFactor), sh = sc.height, gap = sc.gap;
            const topEdge = top.position.y - th / 2;
            // bias the new level back toward the lane centre (where the crane drops) so the bridge
            // re-centres the tower; the legs then slant out to the off-centre house below.
            let sx = top.position.x + (CANVAS_WIDTH / 2 - top.position.x) * sc.recenterBias;
            sx = Math.max(sw / 2 + sc.edgePad, Math.min(CANVAS_WIDTH - sw / 2 - sc.edgePad, sx));
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
            const cam = this.config.camera, wnd = this.config.wind;
            // Wind blows the falling house sideways (force at the top edge so it also tilts a
            // little, like real wind pushing an object).
            if (this.pending && !this.pending.isStatic) {
                const ph = this.pending.boxHeight || DEFAULT_BOX_HEIGHT;
                const at = { x: this.pending.position.x, y: this.pending.position.y - ph * wnd.forceYOffset };
                Body.applyForce(this.pending, at, { x: this.currentWind * wnd.force * this.pending.mass, y: 0 });
            }
            // drop-speed multiplier scales fall acceleration live (lobby slider)
            this.engine.gravity.y = this.config.world.gravityY * this.config.speed.drop;
            Engine.update(this.engine, this.config.timing.fixedStepMs);
            this.checkSettle();
            this.checkCollapse();
            this.swingTime += cam.swingTimeStep;
            this.currentWind += (this.targetWind - this.currentWind) * cam.windLerp;

            // junk that fell away can be forgotten
            this.junk = this.junk.filter(j => j.position.y < PLATFORM_Y + this.config.demolition.junkForgetBelow);

            let top = PLATFORM_Y;
            this.blocks.forEach(b => { if (b === this.pending) return; const t = b.position.y - (b.boxHeight || DEFAULT_BOX_HEIGHT) / 2; if (t < top) top = t; });
            
            if (this.alive && this.blocks.length > 1) {
                this.autoScrollOffset = (this.autoScrollOffset || 0) + cam.autoScrollSpeed; // survival camera creep
            } else {
                this.autoScrollOffset = 0;
            }
            
            this.targetCameraYOffset = Math.max(this.autoScrollOffset, Math.max(0, cam.restAnchor - top));
            
            const naturalCamY = Math.max(0, cam.restAnchor - top);
            const extraScroll = this.targetCameraYOffset - naturalCamY;
            this.targetPivotY = Math.min(cam.maxPivotY, top - HANG_OFFSET) - extraScroll;
            
            this.pivotY += (this.targetPivotY - this.pivotY) * cam.pivotLerp;
            this.cameraYOffset += (this.targetCameraYOffset - this.cameraYOffset) * cam.cameraLerp;
            if (this.flash > 0) this.flash -= cam.flashDecay;
            if (this._toast) { this._toast.t--; if (this._toast.t <= 0) this._toast = null; }
        };

        // ---- Render interpolation -------------------------------------------------
        // The sim advances in fixed 1/60s steps, but the screen may refresh faster
        // (120/144Hz) or slower. To keep motion smooth we draw a frame BETWEEN the two
        // most recent physics states: capture the pre-step pose, then just before
        // rendering nudge every body/camera value to a blend of (prev, current) by
        // `alpha` (= leftover accumulator). We mutate in place for the draw and restore
        // the exact true values immediately after, so the physics integrator is untouched.
        Lane.prototype.captureStepState = function () {
            this.blocks.forEach(b => { b._px = b.position.x; b._py = b.position.y; b._pa = b.angle; });
            this.junk.forEach(j => { j._px = j.position.x; j._py = j.position.y; j._pa = j.angle; });
            this._pCam = this.cameraYOffset; this._pPivot = this.pivotY; this._pSwing = this.swingTime;
            this._interp = false;
        };
        Lane.prototype.applyInterpolation = function (alpha) {
            if (this._pCam == null || alpha <= 0) { this._interp = false; return; }  // idle, or exactly on a step
            const lerp = (p, c) => p + (c - p) * alpha;
            this.blocks.forEach(b => {
                if (b._px == null) return;
                b._tx = b.position.x; b._ty = b.position.y; b._ta = b.angle;
                b.position.x = lerp(b._px, b._tx); b.position.y = lerp(b._py, b._ty); b.angle = lerp(b._pa, b._ta);
            });
            this.junk.forEach(j => {
                if (j._px == null) return;
                j._tx = j.position.x; j._ty = j.position.y; j._ta = j.angle;
                j.position.x = lerp(j._px, j._tx); j.position.y = lerp(j._py, j._ty); j.angle = lerp(j._pa, j._ta);
            });
            this._tCam = this.cameraYOffset; this._tPivot = this.pivotY; this._tSwing = this.swingTime;
            this.cameraYOffset = lerp(this._pCam, this._tCam);
            this.pivotY = lerp(this._pPivot, this._tPivot);
            this.swingTime = lerp(this._pSwing, this._tSwing);
            this._interp = true;
        };
        Lane.prototype.restoreInterpolation = function () {
            if (!this._interp) return;
            this.blocks.forEach(b => { if (b._tx != null) { b.position.x = b._tx; b.position.y = b._ty; b.angle = b._ta; b._tx = null; } });
            this.junk.forEach(j => { if (j._tx != null) { j.position.x = j._tx; j.position.y = j._ty; j.angle = j._ta; j._tx = null; } });
            this.cameraYOffset = this._tCam; this.pivotY = this._tPivot; this.swingTime = this._tSwing;
            this._interp = false;
        };

        // ---- Game-over demolition: pan to the base, then a clean bottom-up chain reaction:
        //      the base house shatters to nothing, the tower above drops one slot into its place,
        //      that new base shatters, the rest drop again... all the way up. ----
        Lane.prototype.startDemolition = function () {
            this.demolishing = true;
            this.demoState = 'intro'; this._wait = 0;
            this.bus.emit('demolition:start', { lane: this });   // the building starts crashing down
            this.blocks.forEach(b => { b.wasPanicking = true; }); // they're all doomed now
            this.isHanging = false; this.hanging = null;
            this.targetCameraYOffset = 0;        // pan the camera down to the ground
            this.targetPivotY = this.config.camera.maxPivotY; // lower the crane back down
            this.autoScrollOffset = 0; // reset auto-scroll
            this.junk.forEach(j => Composite.remove(this.engine.world, j)); this.junk = [];
            // freeze everything so the chain is fully controlled (no chaotic physics)
            this.blocks.forEach(b => { if (!b.isStatic) Body.setStatic(b, true); });
        };

        Lane.prototype.spawnDebris = function (x, y, w) {
            const colors = ['#d97706', '#fef3c7', '#78350f', '#3b82f6', '#fbbf24'];
            for (let i = 0; i < this.config.demolition.debrisCount; i++) this.particles.push({
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
            this.bus.emit('demolition:step', { lane: this });
        };

        Lane.prototype.lowestBlock = function () {
            let low = null; this.blocks.forEach(b => { if (!low || b.position.y > low.position.y) low = b; });
            return low;
        };

        Lane.prototype.updateDemolition = function () {
            const dm = this.config.demolition;
            this.swingTime += this.config.camera.swingTimeStep;
            this.cameraYOffset += (this.targetCameraYOffset - this.cameraYOffset) * this.config.camera.cameraLerp;
            this.pivotY += (this.targetPivotY - this.pivotY) * this.config.camera.pivotLerp;
            if (this._toast) { this._toast.t--; if (this._toast.t <= 0) this._toast = null; }
            const FALL_FRAMES = dm.fallFrames;

            if (this.demoState === 'intro') {
                // let the camera settle on the base before we start
                if (++this._wait > dm.introWait) this.demoState = 'break';
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

        // Rendering lives in Babs.LaneRenderer (see renderer.js); the lane just delegates.
        Lane.prototype.render = function () { this.renderer.render(); };
        Lane.prototype.resize = function () { this.renderer.resize(); };
        Lane.prototype.windLabel = function () { return this.renderer.windLabel(); };
