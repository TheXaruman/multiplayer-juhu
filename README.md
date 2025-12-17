# 🎮 GUARDIAN SLAYER - Online Multiplayer

Ein schnelles 1v1 Online-Spiel: Wer tötet seinen Wächter zuerst?

## 🚀 Features

- **Online Multiplayer** via WebRTC (P2P)
- **Session-ID System** - Erstelle ein Spiel und teile die ID mit deinem Gegner
- **Keine Server-Kosten** - Peer-to-Peer Verbindung direkt zwischen Spielern
- **Netlify-Ready** - Einfaches Deployment als statische Seite

## 🎯 Spielprinzip

1. Beide Spieler kämpfen **gleichzeitig** gegen ihren eigenen Boss
2. Wer seinen Wächter **zuerst** besiegt, **gewinnt**
3. Nutze Angriff, Schuss und Heal strategisch!

## 🕹️ Steuerung

### Spieler 1 (Host)
| Aktion | Taste |
|--------|-------|
| Bewegen | WASD |
| Springen | W / Leertaste |
| Dash | S (während Bewegung) |
| Angriff | F |
| Schuss | G |
| Heal | H |

### Spieler 2 (Joiner)
| Aktion | Taste |
|--------|-------|
| Bewegen | Pfeiltasten |
| Springen | ↑ |
| Dash | ↓ (während Bewegung) |
| Angriff | 1 |
| Schuss | 2 |
| Heal | 3 |

## 🌐 Deployment auf Netlify

### Option 1: Drag & Drop
1. Gehe zu [app.netlify.com](https://app.netlify.com)
2. Ziehe den Projektordner in den Browser
3. Fertig! 🎉

### Option 2: Git Integration
1. Pushe das Projekt zu GitHub/GitLab
2. Verbinde das Repository mit Netlify
3. Netlify deployed automatisch bei jedem Push

## 📁 Projektstruktur

```
multiplayer-juhu/
├── index.html          # Hauptseite
├── netlify.toml        # Netlify Konfiguration
├── css/
│   └── style.css       # Alle Styles
└── js/
    ├── classes.js      # Spielklassen (Player, Boss, etc.)
    ├── network.js      # PeerJS Netzwerk-Modul
    └── game.js         # Spiellogik & Manager
```

## 🔧 Technologie

- **PeerJS** - WebRTC Wrapper für P2P Verbindungen
- **Vanilla JavaScript** - Keine Frameworks
- **Canvas API** - Für das Rendering
- **Netlify** - Kostenloses Hosting

## 💡 Wie funktioniert das Multiplayer?

1. **Spieler 1** erstellt ein Spiel → bekommt 6-stellige Session-ID
2. **Spieler 1** teilt die ID mit **Spieler 2**
3. **Spieler 2** gibt die ID ein und tritt bei
4. WebRTC P2P Verbindung wird hergestellt
5. Beide Spieler synchronisieren ihren Spielzustand

Da jeder Spieler sein eigenes Spiel lokal simuliert und nur den Fortschritt synchronisiert, gibt es minimale Latenz!

## 🐛 Fehlerbehebung

**"Spiel nicht gefunden"**
- Überprüfe die Session-ID auf Tippfehler
- Der Host muss das Spiel offen haben

**Verbindung bricht ab**
- Firewall/VPN kann WebRTC blockieren
- Versuche es in einem anderen Netzwerk

**Hohe Latenz**
- P2P funktioniert am besten wenn beide Spieler geografisch nah sind

## 📜 Lizenz

MIT - Mach damit was du willst! 🎮

