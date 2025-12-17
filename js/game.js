/**
 * ============================================================
 * GAME MODULE - Hauptspiellogik für Online Multiplayer
 * ============================================================
 */

class Game {
    constructor(canvas, playerNum, playerColor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.playerNum = playerNum;
        this.playerColor = playerColor;
        
        this.width = 0;
        this.height = 0;
        this.shake = { amount: 0 };
        
        this.localPlayer = null;
        this.remotePlayer = null;
        this.localBoss = null;
        this.remoteBoss = null;
        this.platforms = [];
        this.particles = [];
        this.projectiles = [];
        
        this.bossDefeated = false;
        this.defeatTime = 0;
        
        this.resize();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    reset() {
        const p1Color = '#38bdf8';
        const p2Color = '#f472b6';
        
        // Lokaler Spieler
        this.localPlayer = new Player(
            100, 
            100, 
            this.playerNum, 
            this.playerNum === 1 ? p1Color : p2Color
        );
        
        // Remote Spieler (für Anzeige)
        this.remotePlayer = new Player(
            100,
            100,
            this.playerNum === 1 ? 2 : 1,
            this.playerNum === 1 ? p2Color : p1Color
        );
        
        // Lokaler Boss
        this.localBoss = new Boss(this.width - 200, this.height / 2 - 40);
        
        // Remote Boss (für Anzeige des gegnerischen Fortschritts)
        this.remoteBoss = new Boss(this.width - 200, this.height / 2 - 40);
        
        // Platforms
        this.platforms = [
            new Platform(0, this.height - 20, this.width, 50),
            new Platform(-20, 0, 20, this.height),
            new Platform(this.width, 0, 20, this.height),
            new Platform(100, this.height - 150, 150, 20),
            new Platform(this.width - 250, this.height - 150, 150, 20),
            new Platform(this.width / 2 - 75, this.height - 250, 150, 20),
        ];
        
        this.particles = [];
        this.projectiles = [];
        this.bossDefeated = false;
        this.defeatTime = 0;
    }

    /**
     * Serialisiert den lokalen Spielzustand für Netzwerk
     */
    getLocalState() {
        return {
            player: this.localPlayer.serialize(),
            boss: this.localBoss.serialize(),
            bossDefeated: this.bossDefeated,
            defeatTime: this.defeatTime
        };
    }

    /**
     * Wendet den Remote-Spielzustand an
     */
    applyRemoteState(state) {
        if (state.player) {
            this.remotePlayer.deserialize(state.player);
        }
        if (state.boss) {
            this.remoteBoss.deserialize(state.boss);
        }
    }

    /**
     * Setzt lokalen Input
     */
    setInput(input) {
        if (this.localPlayer) {
            Object.assign(this.localPlayer.input, input);
        }
    }

    update(isPlaying) {
        if (!isPlaying || this.bossDefeated) return;
        
        // Lokalen Spieler und Boss updaten
        this.localPlayer.update(
            this.platforms, 
            this.localBoss, 
            this.particles, 
            this.projectiles, 
            this.width, 
            this.height, 
            this.shake
        );
        
        this.localBoss.update(this.localPlayer, this.particles, this.width, this.height);
        
        // Spieler Angriff trifft Boss
        if (this.localPlayer.isAttacking && this.localPlayer.attackHitbox && !this.localPlayer.hasHitBoss) {
            if (checkRectCollide(this.localPlayer.attackHitbox, this.localBoss)) {
                const kx = Math.cos(this.localPlayer.attackHitbox.angle);
                const ky = Math.sin(this.localPlayer.attackHitbox.angle);
                this.localBoss.takeDamage(CONFIG.attackDamage, kx, ky, this.particles);
                this.localPlayer.hasHitBoss = true;
                this.shake.amount = Math.max(this.shake.amount, 8);
            }
        }
        
        // Projektile
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(this.particles);
            
            if (p.life <= 0) {
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Trifft Boss
            if (this.localBoss && !this.localBoss.dead && checkRectCollide({x: p.x - 6, y: p.y - 6, w: 12, h: 12}, this.localBoss)) {
                this.localBoss.takeDamage(CONFIG.projectileDamage, Math.sign(p.vx), Math.sign(p.vy), this.particles);
                for (let j = 0; j < 5; j++) {
                    this.particles.push(new Particle(p.x, p.y, p.color, 4, 15));
                }
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Trifft Wand
            for (let plat of this.platforms) {
                if (checkRectCollide({x: p.x - 6, y: p.y - 6, w: 12, h: 12}, plat)) {
                    for (let j = 0; j < 3; j++) {
                        this.particles.push(new Particle(p.x, p.y, p.color, 3, 10));
                    }
                    this.projectiles.splice(i, 1);
                    break;
                }
            }
        }
        
        // Partikel
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Boss Tod prüfen
        if (this.localBoss.dead && !this.bossDefeated) {
            this.bossDefeated = true;
        }
        
        // Shake Decay
        if (this.shake.amount > 0) {
            this.shake.amount *= 0.9;
            if (this.shake.amount < 0.5) this.shake.amount = 0;
        }
    }

    draw(showRemote = false) {
        const ctx = this.ctx;
        
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Hintergrund
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#0a0a0f');
        grad.addColorStop(1, '#13131a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.save();
        
        // Screen Shake
        if (this.shake.amount > 0) {
            const dx = (Math.random() - 0.5) * this.shake.amount * 2;
            const dy = (Math.random() - 0.5) * this.shake.amount * 2;
            ctx.translate(dx, dy);
        }
        
        // Zeichne Elemente
        this.platforms.forEach(p => p.draw(ctx));
        
        if (this.localBoss) this.localBoss.draw(ctx);
        if (this.localPlayer) this.localPlayer.draw(ctx);
        
        // Remote Spieler als Geist anzeigen (optional)
        if (showRemote && this.remotePlayer) {
            ctx.globalAlpha = 0.3;
            this.remotePlayer.draw(ctx);
            ctx.globalAlpha = 1;
        }
        
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        
        ctx.restore();
        
        // Sieg-Overlay
        if (this.bossDefeated) {
            ctx.fillStyle = 'rgba(0, 255, 100, 0.1)';
            ctx.fillRect(0, 0, this.width, this.height);
            
            ctx.font = 'bold 24px Orbitron';
            ctx.fillStyle = '#4ade80';
            ctx.textAlign = 'center';
            ctx.fillText('✓ WÄCHTER BESIEGT!', this.width / 2, this.height / 2);
        }
    }
}

// ============================================================
// GAME MANAGER - Verwaltet das gesamte Spiel
// ============================================================
class GameManager {
    constructor() {
        this.game = null;
        this.gameState = 'menu'; // menu, lobby, countdown, playing, finished
        this.matchTimer = 0;
        this.countdownValue = 3;
        this.winner = null;
        this.playerNum = 0;
        
        // Remote State
        this.remoteState = null;
        this.remoteBossDefeated = false;
        this.remoteDefeatTime = 0;
        
        // Input State
        this.keys = {};
        this.inputState = {
            left: false,
            right: false,
            jump: false,
            jumpPressed: false,
            jumpReleased: false,
            down: false,
            attack: false,
            attackPressed: false,
            shot: false,
            shotPressed: false,
            heal: false,
            healPressed: false
        };
        
        this.lastJump = false;
        this.lastAttack = false;
        this.lastShot = false;
        this.lastHeal = false;
        
        // UI Elements
        this.elements = {};
        
        // Bind methods
        this.loop = this.loop.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }

    init() {
        // UI Element References
        this.elements = {
            homescreen: document.getElementById('homescreen'),
            lobbyHost: document.getElementById('lobby-host'),
            lobbyJoin: document.getElementById('lobby-join'),
            lobbyWaiting: document.getElementById('lobby-waiting'),
            gamescreen: document.getElementById('gamescreen'),
            sessionId: document.getElementById('session-id'),
            sessionInput: document.getElementById('session-input'),
            joinError: document.getElementById('join-error'),
            connectionStatus: document.getElementById('connection-status'),
            matchTimer: document.getElementById('match-timer'),
            countdown: document.getElementById('countdown'),
            winnerPanel: document.getElementById('winner-panel'),
            winnerName: document.getElementById('winner-name'),
            winnerTime: document.getElementById('winner-time'),
            playerHp: document.getElementById('player-hp'),
            bossHud: document.getElementById('boss-hud'),
            bossHp: document.getElementById('boss-hp'),
            atkStatus: document.getElementById('atk-status'),
            shotStatus: document.getElementById('shot-status'),
            healStatus: document.getElementById('heal-status'),
            playerTag: document.getElementById('player-tag')
        };
        
        // Event Listeners
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('resize', () => {
            if (this.game) this.game.resize();
        });
        
        // Netzwerk Callbacks
        network.onConnected = () => this.onNetworkConnected();
        network.onDisconnected = () => this.onNetworkDisconnected();
        network.onData = (data) => this.onNetworkData(data);
        network.onError = (err) => this.onNetworkError(err);
        
        // Loop starten
        requestAnimationFrame(this.loop);
    }

    // ============================================================
    // SCREEN MANAGEMENT
    // ============================================================
    
    showScreen(screenId) {
        // Alle Screens verstecken
        ['homescreen', 'lobbyHost', 'lobbyJoin', 'lobbyWaiting', 'gamescreen'].forEach(id => {
            const el = this.elements[id];
            if (el) el.classList.add('hidden');
        });
        
        // Gewünschten Screen zeigen
        const screen = this.elements[screenId];
        if (screen) screen.classList.remove('hidden');
    }

    // ============================================================
    // LOBBY / MATCHMAKING
    // ============================================================
    
    async hostGame() {
        this.showScreen('lobbyHost');
        this.elements.sessionId.textContent = '...';
        this.elements.connectionStatus.textContent = 'Erstelle Spiel...';
        this.elements.connectionStatus.className = 'status waiting';
        
        try {
            const sessionId = await network.createGame();
            this.elements.sessionId.textContent = sessionId;
            this.elements.connectionStatus.innerHTML = '<span class="spinner"></span> Warte auf Spieler 2...';
            this.playerNum = 1;
        } catch (err) {
            this.elements.connectionStatus.textContent = 'Fehler: ' + err.message;
            this.elements.connectionStatus.className = 'status error';
        }
    }

    showJoinScreen() {
        this.showScreen('lobbyJoin');
        this.elements.sessionInput.value = '';
        this.elements.joinError.classList.add('hidden');
    }

    async joinGame() {
        const sessionId = this.elements.sessionInput.value.trim().toUpperCase();
        
        if (!sessionId || sessionId.length < 4) {
            this.elements.joinError.textContent = 'Bitte gib eine gültige Session-ID ein';
            this.elements.joinError.classList.remove('hidden');
            return;
        }
        
        this.elements.joinError.classList.add('hidden');
        this.showScreen('lobbyWaiting');
        
        try {
            await network.joinGame(sessionId);
            this.playerNum = 2;
            // Verbindung wird in onNetworkConnected behandelt
        } catch (err) {
            this.showScreen('lobbyJoin');
            this.elements.joinError.textContent = err.message;
            this.elements.joinError.classList.remove('hidden');
        }
    }

    copySessionId() {
        const sessionId = this.elements.sessionId.textContent;
        navigator.clipboard.writeText(sessionId).then(() => {
            // Feedback
            const btn = document.querySelector('.copy-btn');
            const originalText = btn.textContent;
            btn.textContent = '✓ Kopiert!';
            setTimeout(() => btn.textContent = originalText, 2000);
        });
    }

    goToMenu() {
        network.disconnect();
        this.showScreen('homescreen');
        this.gameState = 'menu';
    }

    // ============================================================
    // NETWORK CALLBACKS
    // ============================================================
    
    onNetworkConnected() {
        console.log('Netzwerk verbunden!');
        
        if (network.isHost) {
            // Host: Spiel starten
            this.startGame();
        } else {
            // Client: Warte auf Spielstart vom Host
            this.elements.connectionStatus.textContent = 'Verbunden! Warte auf Spielstart...';
            this.elements.connectionStatus.className = 'status connected';
        }
    }

    onNetworkDisconnected() {
        console.log('Netzwerk getrennt');
        if (this.gameState === 'playing' || this.gameState === 'countdown') {
            alert('Verbindung zum Gegner verloren!');
            this.goToMenu();
        }
    }

    onNetworkData(data) {
        switch (data.type) {
            case 'gameState':
                // Spielzustand vom anderen Spieler
                this.remoteState = data;
                if (data.bossDefeated && !this.remoteBossDefeated) {
                    this.remoteBossDefeated = true;
                    this.remoteDefeatTime = data.defeatTime;
                    this.checkWinner();
                }
                break;
                
            case 'input':
                // Input vom anderen Spieler (nur für Host relevant)
                // Wird hier nicht benötigt da jeder sein eigenes Spiel simuliert
                break;
                
            case 'event':
                this.handleNetworkEvent(data.eventType, data.data);
                break;
        }
    }

    onNetworkError(err) {
        console.error('Netzwerk Fehler:', err);
    }

    handleNetworkEvent(eventType, data) {
        switch (eventType) {
            case 'startGame':
                // Client erhält Spielstart-Signal
                this.startGame();
                break;
                
            case 'countdown':
                this.countdownValue = data.value;
                if (data.value === 0) {
                    this.gameState = 'playing';
                }
                break;
                
            case 'rematch':
                this.restartGame();
                break;
        }
    }

    // ============================================================
    // GAME FLOW
    // ============================================================
    
    startGame() {
        this.showScreen('gamescreen');
        
        // Canvas und Spiel initialisieren
        const canvas = document.getElementById('game-canvas');
        const color = this.playerNum === 1 ? '#38bdf8' : '#f472b6';
        this.game = new Game(canvas, this.playerNum, color);
        this.game.reset();
        
        // UI Setup
        this.elements.playerTag.textContent = `SPIELER ${this.playerNum}`;
        this.elements.playerTag.className = `player-tag p${this.playerNum}`;
        
        // Reset State
        this.matchTimer = 0;
        this.winner = null;
        this.remoteBossDefeated = false;
        this.remoteDefeatTime = 0;
        this.elements.winnerPanel.style.display = 'none';
        
        // Countdown starten
        this.gameState = 'countdown';
        this.countdownValue = 3;
        
        // Host sendet Start-Event
        if (network.isHost) {
            network.sendEvent('startGame', {});
        }
        
        this.runCountdown();
    }

    runCountdown() {
        this.elements.countdown.style.display = 'block';
        this.elements.countdown.textContent = this.countdownValue;
        this.elements.countdown.style.animation = 'none';
        this.elements.countdown.offsetHeight;
        this.elements.countdown.style.animation = 'countPulse 1s ease-out';
        
        if (this.countdownValue > 0) {
            // Sync mit anderem Spieler
            if (network.isHost) {
                network.sendEvent('countdown', { value: this.countdownValue });
            }
            
            setTimeout(() => {
                this.countdownValue--;
                if (this.countdownValue > 0) {
                    this.runCountdown();
                } else {
                    this.elements.countdown.textContent = 'KÄMPFT!';
                    
                    if (network.isHost) {
                        network.sendEvent('countdown', { value: 0 });
                    }
                    
                    setTimeout(() => {
                        this.elements.countdown.style.display = 'none';
                        this.gameState = 'playing';
                    }, 500);
                }
            }, 1000);
        }
    }

    checkWinner() {
        if (this.winner) return;
        
        const localDone = this.game && this.game.bossDefeated;
        const remoteDone = this.remoteBossDefeated;
        
        if (localDone || remoteDone) {
            if (localDone && !remoteDone) {
                this.winner = this.playerNum;
                this.game.defeatTime = this.matchTimer;
            } else if (remoteDone && !localDone) {
                this.winner = this.playerNum === 1 ? 2 : 1;
            } else {
                // Beide fertig - Zeit vergleichen
                const localTime = this.game.defeatTime || this.matchTimer;
                const remoteTime = this.remoteDefeatTime;
                
                if (localTime <= remoteTime) {
                    this.winner = this.playerNum;
                } else {
                    this.winner = this.playerNum === 1 ? 2 : 1;
                }
            }
            
            this.gameState = 'finished';
            this.showWinner();
        }
    }

    showWinner() {
        this.elements.winnerPanel.style.display = 'flex';
        this.elements.winnerName.textContent = `SPIELER ${this.winner}`;
        this.elements.winnerName.className = `winner-name p${this.winner}`;
        
        const winnerTime = this.winner === this.playerNum 
            ? (this.game.defeatTime || this.matchTimer)
            : this.remoteDefeatTime;
        this.elements.winnerTime.textContent = `Zeit: ${formatTime(winnerTime)}`;
    }

    restartGame() {
        if (this.game) {
            this.game.reset();
        }
        
        this.matchTimer = 0;
        this.winner = null;
        this.remoteBossDefeated = false;
        this.remoteDefeatTime = 0;
        this.elements.winnerPanel.style.display = 'none';
        
        this.gameState = 'countdown';
        this.countdownValue = 3;
        
        if (network.isHost) {
            network.sendEvent('rematch', {});
        }
        
        this.runCountdown();
    }

    // ============================================================
    // INPUT HANDLING
    // ============================================================
    
    handleKeyDown(e) {
        if (this.keys[e.code]) return;
        this.keys[e.code] = true;
        
        // Mapping je nach Spieler
        if (this.playerNum === 1) {
            switch(e.code) {
                case 'KeyA': this.inputState.left = true; break;
                case 'KeyD': this.inputState.right = true; break;
                case 'KeyW': 
                case 'Space':
                    this.inputState.jump = true;
                    this.inputState.jumpPressed = true;
                    break;
                case 'KeyS': this.inputState.down = true; break;
                case 'KeyF': 
                    this.inputState.attack = true;
                    this.inputState.attackPressed = true;
                    break;
                case 'KeyG': 
                    this.inputState.shot = true;
                    this.inputState.shotPressed = true;
                    break;
                case 'KeyH': 
                    this.inputState.heal = true;
                    this.inputState.healPressed = true;
                    break;
            }
        } else {
            switch(e.code) {
                case 'ArrowLeft': this.inputState.left = true; break;
                case 'ArrowRight': this.inputState.right = true; break;
                case 'ArrowUp': 
                    this.inputState.jump = true;
                    this.inputState.jumpPressed = true;
                    break;
                case 'ArrowDown': this.inputState.down = true; break;
                case 'Numpad1':
                case 'Digit1':
                    this.inputState.attack = true;
                    this.inputState.attackPressed = true;
                    break;
                case 'Numpad2':
                case 'Digit2':
                    this.inputState.shot = true;
                    this.inputState.shotPressed = true;
                    break;
                case 'Numpad3':
                case 'Digit3':
                    this.inputState.heal = true;
                    this.inputState.healPressed = true;
                    break;
            }
        }
        
        e.preventDefault();
    }

    handleKeyUp(e) {
        this.keys[e.code] = false;
        
        if (this.playerNum === 1) {
            switch(e.code) {
                case 'KeyA': this.inputState.left = false; break;
                case 'KeyD': this.inputState.right = false; break;
                case 'KeyW':
                case 'Space':
                    this.inputState.jump = false;
                    this.inputState.jumpReleased = true;
                    break;
                case 'KeyS': this.inputState.down = false; break;
                case 'KeyF': this.inputState.attack = false; break;
                case 'KeyG': this.inputState.shot = false; break;
                case 'KeyH': this.inputState.heal = false; break;
            }
        } else {
            switch(e.code) {
                case 'ArrowLeft': this.inputState.left = false; break;
                case 'ArrowRight': this.inputState.right = false; break;
                case 'ArrowUp':
                    this.inputState.jump = false;
                    this.inputState.jumpReleased = true;
                    break;
                case 'ArrowDown': this.inputState.down = false; break;
                case 'Numpad1':
                case 'Digit1':
                    this.inputState.attack = false; break;
                case 'Numpad2':
                case 'Digit2':
                    this.inputState.shot = false; break;
                case 'Numpad3':
                case 'Digit3':
                    this.inputState.heal = false; break;
            }
        }
    }

    // ============================================================
    // UPDATE HUD
    // ============================================================
    
    updateHUD() {
        if (!this.game || !this.game.localPlayer) return;
        
        const player = this.game.localPlayer;
        const boss = this.game.localBoss;
        
        // Player HP
        this.elements.playerHp.style.width = `${(player.hp / player.maxHp) * 100}%`;
        
        // Boss HP
        if (boss && !boss.dead) {
            this.elements.bossHud.classList.add('visible');
            this.elements.bossHp.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
        }
        
        // Abilities
        const formatCd = (timer) => timer === 0 ? '✓' : `${(timer / 60).toFixed(1)}s`;
        
        this.elements.atkStatus.textContent = `ATK ${formatCd(player.attackCooldownTimer)}`;
        this.elements.atkStatus.className = `ability-indicator ${player.attackCooldownTimer === 0 ? 'ready' : 'cooldown'}`;
        
        this.elements.shotStatus.textContent = `SHOT ${formatCd(player.shotTimer)}`;
        this.elements.shotStatus.className = `ability-indicator ${player.shotTimer === 0 ? 'ready' : 'cooldown'}`;
        
        this.elements.healStatus.textContent = `HEAL ${formatCd(player.healTimer)}`;
        this.elements.healStatus.className = `ability-indicator ${player.healTimer === 0 ? 'ready' : 'cooldown'}`;
    }

    // ============================================================
    // MAIN LOOP
    // ============================================================
    
    loop() {
        if (this.gameState === 'playing') {
            this.matchTimer++;
            this.elements.matchTimer.textContent = formatTime(this.matchTimer);
            
            // Input ans Spiel weitergeben
            if (this.game) {
                this.game.setInput(this.inputState);
                
                // Pressed-States zurücksetzen nach Weitergabe
                this.inputState.jumpPressed = false;
                this.inputState.jumpReleased = false;
                this.inputState.attackPressed = false;
                this.inputState.shotPressed = false;
                this.inputState.healPressed = false;
                
                // Update
                this.game.update(true);
                
                // Netzwerk Sync
                if (network.isConnected()) {
                    network.sendGameState({
                        ...this.game.getLocalState(),
                        matchTimer: this.matchTimer
                    });
                }
                
                // Remote State anwenden
                if (this.remoteState) {
                    this.game.applyRemoteState(this.remoteState);
                }
                
                // Gewinner prüfen
                if (this.game.bossDefeated) {
                    this.game.defeatTime = this.matchTimer;
                    this.checkWinner();
                }
            }
            
            // HUD Update
            this.updateHUD();
        }
        
        // Zeichnen
        if (this.game && this.gameState !== 'menu') {
            this.game.draw(false);
        }
        
        requestAnimationFrame(this.loop);
    }
}

// Globale Instanz
const gameManager = new GameManager();

// Initialisierung wenn DOM geladen
document.addEventListener('DOMContentLoaded', () => {
    gameManager.init();
});

