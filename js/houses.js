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
    b.willJump = Math.random() < 0.5;            // some roof guys get scared and jump
    b.jumpAt = 40 + Math.random() * 120;         // ...soon-ish, while still on top
    b.jumpDir = Math.random() < 0.5 ? -1 : 1;
  },
  draw: function (c) {
    const { ctx, w, h, k, st, dark, emotion, t, ph, color, isTop, walk, face, block, chars } = c;
    ctx.fillStyle = st.trim; ctx.strokeStyle = dark; ctx.lineWidth = 2.5;   // little chimney
    ctx.beginPath(); ctx.roundRect(w * 0.3, -h / 2 - 8 * k, 5 * k, 8 * k, 1); ctx.fill(); ctx.stroke();
    if (!block.guyGone) {
      if (isTop) {
        block.squishT = 0;
        block.roofT = (block.roofT || 0) + 1;
        if (!block.jumping && block.willJump && block.roofT > (block.jumpAt || 180)) { block.jumping = true; block.jumpT = 0; }
        if (block.jumping) {
          block.jumpT++; const dir = block.jumpDir || 1, jt = block.jumpT;
          const jx = dir * (w * 0.3 + 1.8 * k * jt);
          const jy = -h / 2 - 4.5 * k * jt + 0.22 * k * jt * jt;
          chars.drawGuy(jx, jy, k * 0.9, 'panic', t, ph, color, dir, 1);
          if (jy > 1500) block.guyGone = true;
        } else {
          chars.drawGuy(walk(0.9) * w * 0.3, -h / 2, k * 0.9, emotion, t, ph, color, face(0.9), 1);
        }
      } else {
        const guyHeight = 22 * k;
        if (c.clearance != null) {
            block.minClearance = Math.min(block.minClearance ?? 1000, c.clearance);
        }
        let sq = 1;
        if (block.minClearance < guyHeight) {
            sq = Math.max(0.05, block.minClearance / guyHeight);
        }
        const fy = -h / 2;                          // keep feet planted on the roof
        chars.drawGuy(0, fy, k * 0.85, 'panic', t, ph, color, 1, sq);
        if (sq <= 0.1) {
            if (!block.guyGone && c.chars && c.chars.lane) {
                const lane = c.chars.lane;
                const bx = block.position.x;
                const by = block.position.y - h / 2;
                for (let i = 0; i < 25; i++) {
                    const ang = Math.random() * Math.PI; // mostly upwards/outwards half-circle
                    const sp = 2 + Math.random() * 7;
                    lane.particles.push({
                        x: bx + (Math.random() - 0.5) * 30,
                        y: by,
                        vx: Math.cos(ang) * sp,
                        vy: -Math.sin(ang) * sp - 1, // blast upwards
                        size: Math.random() * 12 + 4,
                        color: Math.random() > 0.3 ? 'rgba(220, 20, 40, 0.9)' : 'rgba(150, 10, 20, 0.9)', // bright and dark blood
                        life: 1.0,
                        decay: 0.02 + Math.random() * 0.03,
                        gravity: true
                    });
                }
            }
            block.guyGone = true;
        }
      }
    }
  }
});
