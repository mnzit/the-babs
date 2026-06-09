# Graph Report - /Users/manjitshakya/projects/towergame  (2026-06-09)

## Corpus Check
- 9 files · ~23,877 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 88 nodes · 138 edges · 16 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]

## God Nodes (most connected - your core abstractions)
1. `updateLobbyUI()` - 9 edges
2. `playSound()` - 8 edges
3. `startGame()` - 7 edges
4. `hostPair()` - 6 edges
5. `joinFromOffer()` - 6 edges
6. `playSfx()` - 6 edges
7. `packSDP()` - 4 edges
8. `toggleFx()` - 4 edges
9. `updateHazardUI()` - 4 edges
10. `setMode()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `setPlayerName()` --calls--> `updateLobbyUI()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/net.js → /Users/manjitshakya/projects/towergame/js/game.js
- `setPlayerName()` --calls--> `updateControllerUI()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/net.js → /Users/manjitshakya/projects/towergame/js/game.js
- `startGame()` --calls--> `toggle()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/game.js → /Users/manjitshakya/projects/towergame/js/hazards.js
- `resetToLobby()` --calls--> `playSound()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/game.js → /Users/manjitshakya/projects/towergame/js/audio.js
- `remoteSpell()` --calls--> `queueSpell()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/net.js → /Users/manjitshakya/projects/towergame/js/game.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.22
Nodes (9): initAudio(), playChime(), playCrush(), playExplode(), playPanic(), playSfx(), playWind(), queueSpell() (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (1): setPlayerName()

### Community 2 - "Community 2"
Cohesion: 0.27
Nodes (6): endGame(), endLane(), gameLoop(), setSpeed(), simulateStep(), syncSpeedUI()

### Community 3 - "Community 3"
Cohesion: 0.28
Nodes (5): buildHazardToggles(), triggerComboEffect(), updateHazardUI(), all(), enabled()

### Community 4 - "Community 4"
Cohesion: 0.43
Nodes (8): playSound(), addPlayer(), removePlayer(), setMode(), toggleAI(), toggleFx(), updateLobbyUI(), toggle()

### Community 5 - "Community 5"
Cohesion: 0.43
Nodes (7): b45encode(), hostPair(), joinFromOffer(), makeQR(), packSDP(), waitIce(), watchIce()

### Community 6 - "Community 6"
Cohesion: 0.47
Nodes (3): arm(), leg(), rr()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (3): announceWind(), scheduleWind(), get()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (4): buildBattleControls(), playAgain(), startGame(), updateControllerUI()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): buildPairList(), markSlotConnected(), slotCount()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): joinStartScan(), scanQR()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): b45decode(), unpackSDP()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): buildLanes(), resetToLobby()

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 10`** (2 nodes): `joinStartScan()`, `scanQR()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `b45decode()`, `unpackSDP()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `buildLanes()`, `resetToLobby()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `shrinkScale()`, `config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `Lane()`, `lane.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `events.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `setPlayerName()` connect `Community 1` to `Community 8`, `Community 4`?**
  _High betweenness centrality (0.199) - this node is a cross-community bridge._
- **Why does `updateLobbyUI()` connect `Community 4` to `Community 8`, `Community 1`, `Community 2`, `Community 12`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Why does `queueSpell()` connect `Community 0` to `Community 2`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `updateLobbyUI()` (e.g. with `setPlayerName()` and `toggle()`) actually correct?**
  _`updateLobbyUI()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `playSound()` (e.g. with `toggleFx()` and `setMode()`) actually correct?**
  _`playSound()` has 6 INFERRED edges - model-reasoned connections that need verification._