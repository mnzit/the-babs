// events.js — Babs.bus: a tiny synchronous publish/subscribe event bus.
//
// Game logic EMITS domain events ('house:perfect', 'lane:collapsed', ...) and
// subsystems (AudioSystem, NetBridge, UI) SUBSCRIBE. This is the seam that
// decouples gameplay from sound, networking, and DOM. Handlers are wrapped so
// one misbehaving subscriber can't abort a frame mid-emit.

window.Babs = window.Babs || {};

Babs.EventBus = function () {
  this._handlers = Object.create(null);
};
Babs.EventBus.prototype.on = function (type, fn) {
  (this._handlers[type] || (this._handlers[type] = [])).push(fn);
  return fn;
};
Babs.EventBus.prototype.off = function (type, fn) {
  const list = this._handlers[type];
  if (!list) return;
  const i = list.indexOf(fn);
  if (i > -1) list.splice(i, 1);
};
Babs.EventBus.prototype.emit = function (type, payload) {
  const list = this._handlers[type];
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    try { list[i](payload); } catch (e) { console.error('[bus] handler for', type, 'threw:', e); }
  }
};

// The single shared bus instance used across the game.
Babs.bus = new Babs.EventBus();
