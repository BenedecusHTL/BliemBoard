# 🎛️ BliemBoard

BliemBoard ist ein blitzschnelles, modernes Soundboard, das mit **Rust & Tauri** entwickelt wurde. Es bietet minimale Latenz, globale Hotkeys und ein smartes Audio-Routing – perfekt für Discord, Teamspeak oder In-Game-Voice!

## ✨ Features

- **Drag & Drop:** Unterstützt `.mp3`, `.wav`, `.ogg` und extrahiert Audio direkt aus `.mp4` Videos.
- **Integrierter Audio-Editor ✂️:** Schneide und trimme deine Sounds direkt in der App auf einer visuellen Waveform.
- **Organisation:** Erstelle eigene Kategorien (Tabs), nutze die Echtzeit-Suche und sortiere deine Sounds per Drag & Drop frei auf dem Grid.
- **Globale Hotkeys:** Spiele Sounds per Tastendruck ab, auch wenn BliemBoard im Hintergrund oder minimiert ist.
- **Voll Anpassbar:** Eigene Bilder für Sounds, individuelle Lautstärkeregelung und anpassbares App-Logo & Titel.
- **Mute Local & Mic-Passthrough:** Stummschaltung für deine eigenen Kopfhörer ("MUTED"-Modus), während der Sound für deine Freunde im Voice-Chat weiterläuft. Verhindert doppeltes Audio beim Discord Screen-Sharing!
- **Auto-Updater:** BliemBoard checkt via GitHub automatisch auf neue Updates.

---

## 🚀 Einrichtung & Audio-Routing (Tutorial)

Damit deine Freunde im Voice-Chat deine Sounds in perfekter Qualität hören können – und du weiterhin ganz normal sprechen kannst – nutzt BliemBoard ein virtuelles Audiokabel. Das BliemBoard fängt dein echtes Mikrofon ab, mischt die Sounds dazu und leitet beides gebündelt weiter.

### Schritt 1: Virtual Audio Cable installieren
1. Lade dir das kostenlose **[VB-Cable](https://vb-audio.com/Cable/)** herunter.
2. Entpacke die ZIP-Datei und führe das Setup als Administrator aus.
3. Starte danach am besten deinen PC einmal neu.

### Schritt 2: BliemBoard Einstellungen
Öffne BliemBoard und klicke oben rechts auf das ⚙️ **Zahnrad (Settings)**:
- **Input Device (Dein Mikrofon):** Wähle hier dein *echtes* Mikrofon aus (z.B. dein Headset-Mikrofon).
- **Output Device (Virtual Cable):** Wähle hier **`CABLE Input (VB-Audio Virtual Cable)`** aus.

> 💡 *Was passiert hier? BliemBoard nimmt jetzt dein Mikrofon und die Sounds und leitet sie in dieses unsichtbare Kabel.*

### Schritt 3: Discord / Voice-Chat Einstellungen
Gehe in Discord (oder in dein jeweiliges Spiel) in die Audio-Einstellungen:
- **Eingabegerät (Microphone):** Wähle hier **`CABLE Output (VB-Audio Virtual Cable)`** aus.

> ⚠️ **Wichtig für Discord-Nutzer:** Discord filtert Musik und Sounds oft als "Hintergrundgeräusche" heraus. Gehe in die Discord-Einstellungen unter "Sprach- & Videochat" und deaktiviere die **Echounterdrückung** sowie die **Geräuschunterdrückung (Krisp)**, damit deine Sounds nicht abgehackt werden.

---

## 🎮 Bedienung & Tipps

- **Sortieren:** Bleibe im "All" Tab und ziehe die Sounds mit der Maus an die gewünschte Position. BliemBoard speichert das Layout automatisch.
- **Kategorien erstellen:** Klicke bei einem Sound auf ✏️ (Bearbeiten) und tippe eine neue Kategorie (z.B. "Memes") in das Feld. Der Tab wird von selbst erstellt!
- **Schneiden:** Klicke auf ✂️ (Schere). Markiere in der Tonspur exakt den Bereich, den du behalten willst, teste ihn mit Play und speichere ab.
