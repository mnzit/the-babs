# Graph Report - /Users/manjitshakya/projects/towergame  (2026-06-09)

## Corpus Check
- 9 files · ~25,031 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 90 nodes · 142 edges · 15 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `updateLobbyUI()` - 10 edges
2. `playSound()` - 9 edges
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
- `toggleFx()` --calls--> `playSound()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/game.js → /Users/manjitshakya/projects/towergame/js/audio.js
- `updateLobbyUI()` --calls--> `toggle()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/game.js → /Users/manjitshakya/projects/towergame/js/hazards.js
- `startGame()` --calls--> `toggle()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/game.js → /Users/manjitshakya/projects/towergame/js/hazards.js
- `resetToLobby()` --calls--> `playSound()`  [INFERRED]
  /Users/manjitshakya/projects/towergame/js/game.js → /Users/manjitshakya/projects/towergame/js/audio.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (3): buildPairList(), markSlotConnected(), slotCount()

### Community 1 - "Community 1"
Cohesion: 0.22
Nodes (9): initAudio(), playChime(), playCrush(), playExplode(), playPanic(), playSfx(), playWind(), queueSpell() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.24
Nodes (7): buildHazardToggles(), toggleFx(), triggerComboEffect(), updateHazardUI(), all(), enabled(), toggle()

### Community 3 - "Community 3"
Cohesion: 0.27
Nodes (6): endGame(), endLane(), gameLoop(), setSpeed(), simulateStep(), syncSpeedUI()

### Community 4 - "Community 4"
Cohesion: 0.43
Nodes (7): b45encode(), hostPair(), joinFromOffer(), makeQR(), packSDP(), waitIce(), watchIce()

### Community 5 - "Community 5"
Cohesion: 0.52
Nodes (7): playSound(), addPlayer(), removePlayer(), resetScores(), setMode(), toggleAI(), updateLobbyUI()

### Community 6 - "Community 6"
Cohesion: 0.47
Nodes (3): arm(), leg(), rr()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (3): announceWind(), scheduleWind(), get()

### Community 8 - "Community 8"
Cohesion: 0.4
Nodes (5): buildBattleControls(), playAgain(), startGame(), updateControllerUI(), setPlayerName()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): joinStartScan(), scanQR()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): b45decode(), unpackSDP()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (2): buildLanes(), resetToLobby()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 10`** (2 nodes): `joinStartScan()`, `scanQR()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `b45decode()`, `unpackSDP()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `shrinkScale()`, `config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `buildLanes()`, `resetToLobby()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `events.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `setPlayerName()` connect `Community 8` to `Community 0`, `Community 5`?**
  _High betweenness centrality (0.197) - this node is a cross-community bridge._
- **Why does `updateLobbyUI()` connect `Community 5` to `Community 8`, `Community 2`, `Community 3`, `Community 13`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Why does `queueSpell()` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `updateLobbyUI()` (e.g. with `setPlayerName()` and `toggle()`) actually correct?**
  _`updateLobbyUI()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `playSound()` (e.g. with `toggleFx()` and `setMode()`) actually correct?**
  _`playSound()` has 7 INFERRED edges - model-reasoned connections that need verification._