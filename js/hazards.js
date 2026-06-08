// hazards.js — Babs.Hazards: the sabotage/hazard strategy registry (Open/Closed).
//
// Each hazard declares { id, enabled, label, scope, apply(lane, byName) }:
//   scope 'combo' — a battle sabotage that triggerComboEffect can fire at a rival
//   scope 'wind'  — the global gale toggle that gates scheduleWind
// The lobby toggle buttons and the combo picker are both DRIVEN by this registry,
// so adding a new sabotage is a single register({...}) call — a toggle appears and
// it joins the combo rotation automatically.
//
// The legacy bare globals fxWind/fxZap/fxJunk are exposed as window accessors that
// proxy the registry's `enabled` flags, so older code/tests that read or set them
// by name keep working against the single source of truth.

window.Babs = window.Babs || {};

Babs.Hazards = (function () {
  const byId = {};
  const order = [];
  function register(h) { if (!byId[h.id]) order.push(h.id); byId[h.id] = h; }
  function get(id) { return byId[id]; }
  function all() { return order.map(function (id) { return byId[id]; }); }
  function enabled(scope) { return all().filter(function (h) { return h.enabled && (!scope || h.scope === scope); }); }
  function setEnabled(id, on) { if (byId[id]) byId[id].enabled = !!on; }
  function toggle(id) { if (byId[id]) byId[id].enabled = !byId[id].enabled; }
  return { register: register, get: get, all: all, enabled: enabled, setEnabled: setEnabled, toggle: toggle };
})();

// Registration order = lobby button order (wind, junk, zap).
Babs.Hazards.register({
  id: 'wind', enabled: true, label: 'WIND', scope: 'wind',
  apply: function (lane, byName) { lane.spikeWind(byName); }   // a sudden gale on one tower
});
Babs.Hazards.register({
  id: 'junk', enabled: true, label: 'JUNK HOUSE', scope: 'combo',
  apply: function (lane, byName) { lane.dropJunk(byName); }    // swap their house for heavy junk
});
Babs.Hazards.register({
  id: 'zap', enabled: true, label: 'ZAP', scope: 'combo',
  apply: function (lane, byName) { lane.zapHouse(byName); }    // blow up their current house
});

// Legacy bare globals fxWind / fxZap / fxJunk -> live view of the registry.
Babs.Hazards.all().forEach(function (h) {
  const name = 'fx' + h.id.charAt(0).toUpperCase() + h.id.slice(1);
  Object.defineProperty(window, name, {
    configurable: true,
    get: function () { return Babs.Hazards.get(h.id).enabled; },
    set: function (v) { Babs.Hazards.setEnabled(h.id, v); }
  });
});
