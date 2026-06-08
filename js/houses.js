// houses.js — Babs.Houses: the house-type strategy registry (Open/Closed).
//
// Each house "type" is a self-contained strategy: how to seed a new block
// (initBlock) and how to draw its type-specific decoration + resident(s) (draw).
// The shared house shell (molding, wall, ice overlay) and the scaffold/junk
// block-states stay in the renderer — those are not house *types*.
//
// Adding a brand-new kind of house is ONE Babs.Houses.register({...}) call;
// nothing in the game loop, spawn, or render dispatch needs to change.
//
// The draw context `c` carries everything a strategy needs so it never reaches
// into the lane/renderer directly:
//   { ctx, w, h, k, t, ph, color, st, dark, emotion, isTop, walk, face,
//     block, chars:{ drawGuy, drawHead } }

window.Babs = window.Babs || {};

Babs.Houses = (function () {
  const byId = [];
  function register(s) { byId[s.id] = s; }
  function get(id) { return byId[id] || byId[0]; }
  function pickRandom() {
    const pool = byId.filter(Boolean);
    let total = 0; for (const s of pool) total += (s.weight || 1);
    let r = Math.random() * total;
    for (const s of pool) { r -= (s.weight || 1); if (r < 0) return s; }
    return pool[0];
  }
  return { register: register, get: get, pickRandom: pickRandom, all: function () { return byId.filter(Boolean); } };
})();

// ---- Type 0: WINDOW PEEK — a small window, only his head shows -------------
Babs.Houses.register({
  id: 0, weight: 1,
  initBlock: function (b) { b.houseType = 0; },
  draw: function (c) {
    const { ctx, w, h, k, st, emotion, t, ph, color, walk, face, chars } = c;
    const wW = Math.min(w * 0.36, 34), wH = 16 * k;
    const wx = -wW / 2, wy = -h * 0.05 - wH / 2;
    ctx.fillStyle = '#cfeafe'; ctx.beginPath(); ctx.roundRect(wx, wy, wW, wH, 5); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(wx, wy, wW, wH, 5); ctx.clip();
    chars.drawHead(walk(1.1) * wW * 0.16, wy + wH * 0.68, k * 0.95, emotion, t, ph, color, face(1.1));
    ctx.restore();
    ctx.strokeStyle = st.trim; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.roundRect(wx, wy, wW, wH, 5); ctx.stroke();
    ctx.fillStyle = st.trim; ctx.beginPath(); ctx.roundRect(wx - 2, wy + wH - 3 * k, wW + 4, 3.5 * k, 1.5); ctx.fill(); ctx.stroke();
  }
});

// ---- Type 1: BALCONY — 1 (a girl) or 2 (a guy + a girl) on a railed ledge --
Babs.Houses.register({
  id: 1, weight: 1,
  initBlock: function (b) { b.houseType = 1; b.balconyTwo = Math.random() < 0.5; },
  draw: function (c) {
    const { ctx, w, h, k, st, dark, emotion, t, ph, color, walk, face, block, chars } = c;
    ctx.fillStyle = '#33414f'; ctx.strokeStyle = dark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-w * 0.16, -h * 0.12, w * 0.32, h * 0.4, 4); ctx.fill(); ctx.stroke();
    const ledgeY = h * 0.14;
    if (block.balconyTwo) {
      chars.drawGuy(-w * 0.13 + walk(0.7) * 4, ledgeY, k * 0.8, emotion, t, ph, color, 1, 1, false);
      chars.drawGuy(w * 0.13 + walk(0.9) * 4, ledgeY, k * 0.8, emotion, t, ph + 2, color, -1, 1, true);
    } else {
      chars.drawGuy(walk(0.8) * w * 0.18, ledgeY, k * 0.9, emotion, t, ph, color, face(0.8), 1, true);
    }
    const lw2 = w * 0.78;
    ctx.fillStyle = st.trim; ctx.strokeStyle = dark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-lw2 / 2, ledgeY, lw2, 5 * k, 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = st.trim; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-lw2 / 2, ledgeY); ctx.lineTo(-lw2 / 2, ledgeY - 11 * k);
    ctx.moveTo(lw2 / 2, ledgeY); ctx.lineTo(lw2 / 2, ledgeY - 11 * k);
    ctx.moveTo(-lw2 / 2, ledgeY - 11 * k); ctx.lineTo(lw2 / 2, ledgeY - 11 * k);
    for (let rx = -lw2 / 2 + 8 * k; rx < lw2 / 2 - 3; rx += 8 * k) { ctx.moveTo(rx, ledgeY); ctx.lineTo(rx, ledgeY - 11 * k); }
    ctx.stroke();
  }
});

// ---- Type 2: ROOFTOP — walks the roof; may leap off; squished flat if covered
Babs.Houses.register({
  id: 2, weight: 1,
  initBlock: function (b) {
    b.houseType = 2;
    const numGuys = Math.random() < 0.4 ? 3 : 1;
    b.roofGuys = [];
    const parachuteIndex = numGuys === 3 ? Math.floor(Math.random() * 3) : -1;
    for (let i = 0; i < numGuys; i++) {
        const xOffset = numGuys === 1 ? 0.3 : (i - 1) * 0.3; // left, center, right
        const jumpDir = numGuys === 1 ? (Math.random() < 0.5 ? -1 : 1) : (i === 0 ? -1 : (i === 2 ? 1 : (Math.random() < 0.5 ? -1 : 1)));
        b.roofGuys.push({
            id: i, xOffset: xOffset,
            willJump: Math.random() < 0.5 || (numGuys === 3 && i === parachuteIndex),
            hasParachute: (numGuys === 3 && i === parachuteIndex),
            jumpAt: 40 + Math.random() * 120, jumpDir: jumpDir,
            jumping: false, jumpT: 0, guyGone: false
        });
    }
  },
  draw: function (c) {
    const { ctx, w, h, k, st, dark, emotion, t, ph, color, isTop, walk, face, block, chars } = c;
    ctx.fillStyle = st.trim; ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(w * 0.3, -h / 2 - 8 * k, 5 * k, 8 * k, 1); ctx.fill(); ctx.stroke();

    // compat for already spawned blocks
    if (!block.roofGuys && !block.guyGone) {
        block.roofGuys = [{ id: 0, xOffset: 0.3, willJump: block.willJump, hasParachute: false, jumpAt: block.jumpAt, jumpDir: block.jumpDir || 1, jumping: block.jumping, jumpT: block.jumpT || 0, guyGone: block.guyGone }];
    }
    if (!block.roofGuys) return;

    if (isTop) {
        block.squishT = 0;
        block.roofT = (block.roofT || 0) + 1;
    } else {
        const guyHeight = 44 * k; // doubled because character scale was doubled
        if (c.clearance != null) block.minClearance = Math.min(block.minClearance ?? 1000, c.clearance);
        block.sq = 1;
        if (block.minClearance < guyHeight) block.sq = Math.max(0.05, block.minClearance / guyHeight);
    }

    block.roofGuys.forEach(g => {
        if (g.guyGone) return;

        if (isTop) {
            if (!g.jumping && g.willJump && block.roofT > (g.jumpAt || 180)) { g.jumping = true; g.jumpT = 0; }
            if (g.jumping) {
                g.jumpT++; const jt = g.jumpT;
                let jx = g.jumpDir * (w * 0.3 + 1.8 * k * jt) + g.xOffset * w;
                let jy = -h / 2 - 4.5 * k * jt + 0.22 * k * jt * jt;

                if (g.hasParachute && jt > 18) {
                    jx = g.jumpDir * (w * 0.3 + 1.8 * k * 18 + 0.6 * k * (jt - 18)) + g.xOffset * w;
                    jy = -h / 2 - 4.5 * k * 18 + 0.22 * k * 18 * 18 + 0.8 * k * (jt - 18);
                    ctx.save(); ctx.translate(jx, jy);
                    ctx.fillStyle = '#ef4444'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(0, -70 * k, 50 * k, Math.PI, 0); ctx.fill(); ctx.stroke();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(-50 * k, -70 * k); ctx.lineTo(-10 * k, -35 * k);
                    ctx.moveTo(50 * k, -70 * k); ctx.lineTo(10 * k, -35 * k); ctx.stroke();
                    ctx.restore();
                }

                const emotionToPass = (g.hasParachute && jt > 18) ? 'parachute' : 'panic';
                chars.drawGuy(jx, jy, k * 0.9, emotionToPass, t, ph + g.id * 12, color, g.jumpDir, 1);

                // Check mid-air collision with falling block
                if (c.nextBlock && !c.nextBlock.isStatic) {
                    const gx = block.position.x + jx;
                    const gy = block.position.y + jy;
                    const nb = c.nextBlock;
                    const nbW = nb.boxWidth || w; const nbH = nb.boxHeight || h;
                    if (gx > nb.position.x - nbW/2 && gx < nb.position.x + nbW/2 && 
                        gy > nb.position.y - nbH/2 && gy < nb.position.y + nbH/2) {
                        
                        if (chars && chars.lane) {
                            const lane = chars.lane;
                            for (let i = 0; i < 25; i++) {
                                const ang = Math.random() * Math.PI * 2;
                                const sp = 2 + Math.random() * 7;
                                lane.particles.push({
                                    x: gx + (Math.random() - 0.5) * 30, y: gy,
                                    vx: Math.cos(ang) * sp, vy: -Math.sin(ang) * sp - 1,
                                    size: Math.random() * 12 + 4,
                                    color: Math.random() > 0.3 ? 'rgba(220, 20, 40, 0.9)' : 'rgba(150, 10, 20, 0.9)',
                                    life: 1.0, decay: 0.02 + Math.random() * 0.03, gravity: true
                                });
                            }
                        }
                        g.guyGone = true;
                    }
                }

                if (jy > 1500) g.guyGone = true;
            } else {
                chars.drawGuy(walk(0.9) * g.xOffset * w, -h / 2, k * 0.9, emotion, t, ph + g.id * 12, color, face(0.9), 1);
            }
        } else {
            const sq = block.sq || 1;
            chars.drawGuy(g.xOffset * w, -h / 2, k * 0.85, 'panic', t, ph + g.id * 12, color, 1, sq);
            if (sq <= 0.1) {
                if (chars && chars.lane) {
                    const lane = chars.lane;
                    const bx = block.position.x + g.xOffset * w;
                    const by = block.position.y - h / 2;
                    for (let i = 0; i < 25; i++) {
                        const ang = Math.random() * Math.PI;
                        const sp = 2 + Math.random() * 7;
                        lane.particles.push({
                            x: bx + (Math.random() - 0.5) * 30, y: by,
                            vx: Math.cos(ang) * sp, vy: -Math.sin(ang) * sp - 1,
                            size: Math.random() * 12 + 4,
                            color: Math.random() > 0.3 ? 'rgba(220, 20, 40, 0.9)' : 'rgba(150, 10, 20, 0.9)',
                            life: 1.0, decay: 0.02 + Math.random() * 0.03, gravity: true
                        });
                    }
                }
                g.guyGone = true;
            }
        }
    });
  }
});
