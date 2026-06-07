# The Babs

A physics tower-stacking party game. Drop ancient brick "houses" from a swinging crane and
stack them as high as you can. Built with plain HTML + [Matter.js](https://brm.io/matter-js/);
it's a single static file (`index.html`) — no build step, no backend.

## Play locally

Just open `index.html` in a browser.

- **Tap** anywhere (or **Space**) to drop the swinging house onto the tower.
- Miss the stack and the run ends.
- Blocks lean under gravity within each 50 m segment, then the tower **locks solid** at every
  50 m checkpoint so you can keep climbing.
- Houses get **smaller the higher you go** (90% at 200 m, 80% at 300 m, ...).

### Modes

- **Solo** – one player, one tower.
- **Co-op** – players take turns on one shared tower.
- **Battle** – two towers side by side. Player 1 drops with **Space** / left side, Player 2 with
  **Enter** / right side. Land 3 perfect drops in a row to **sabotage your rival** (a gale or a
  junk house dropped on their tower). Pull **50 m (5 houses) ahead** and the trailing player is out.

## Phone controllers over WiFi (no server)

Each player can use their phone as a controller. It's peer-to-peer (WebRTC) — there is **no game
server**; phones talk straight to the host device over your local WiFi.

> **Requirement:** phone cameras only work on a secure page, so the game must be opened over
> **HTTPS** (not `file://`). Host it on any free static host (Vercel, GitHub Pages, Netlify).

### How to pair

1. Open the hosted URL on the **host** device (laptop / TV / one phone) — this runs the game.
2. In the lobby, under *Phone controllers (WiFi, no server)*, tap **pair phone** for a player.
   The host shows a QR code.
3. On each **phone**, open the **same URL**, tap **"This phone is joining a game"**, then
   **START CAMERA** and scan the host's QR. The phone shows a reply QR.
4. Back on the host, tap **"SCAN PHONE'S REPLY"** and point its camera at the phone.
5. Connected — the phone becomes a DROP controller.

All devices must be on the **same WiFi / hotspot**, and the network must not block device-to-device
traffic (some guest/public WiFi has "client isolation" that prevents this; home WiFi or a personal
hotspot works fine).

## Deploy to Vercel

The repo is ready to deploy as-is (static, HTTPS by default):

```bash
npm i -g vercel   # if you don't have it
vercel            # from this folder, follow the prompts
```

Or drag-and-drop the folder onto [vercel.com](https://vercel.com), or connect the GitHub repo.
You'll get a URL like `https://the-babs.vercel.app` to open on every device.
