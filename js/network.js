/**
 * ============================================================
 * NETWORK MODULE - PeerJS WebRTC für Online Multiplayer
 * ============================================================
 */

class NetworkManager {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.isHost = false;
        this.sessionId = null;
        this.connected = false;
        this.lastPing = 0;
        this.latency = 0;
        this.pingInterval = null;
        
        // Callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onData = null;
        this.onError = null;
    }

    /**
     * Generiert eine kurze, lesbare Session-ID
     */
    generateSessionId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Logging Helper - schreibt auch ins UI Debug Log
     */
    log(msg, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = data ? `${msg} ${JSON.stringify(data)}` : msg;
        console.log(`[${timestamp}] 🌐 ${logMsg}`);
        
        // Ins UI schreiben wenn vorhanden
        const debugLog = document.getElementById('debug-log');
        if (debugLog) {
            debugLog.innerHTML += `<div>[${timestamp}] ${msg}</div>`;
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    }

    /**
     * Erstellt ein neues Spiel als Host
     */
    async createGame() {
        return new Promise((resolve, reject) => {
            this.sessionId = this.generateSessionId();
            this.isHost = true;
            
            this.log('Erstelle Spiel mit Session-ID: ' + this.sessionId);
            
            // PeerJS mit eigener ID initialisieren
            // Verwende den kostenlosen PeerJS Cloud Server
            this.peer = new Peer('guardian-' + this.sessionId, {
                debug: 2,  // Mehr Debug-Output
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        { urls: 'stun:stun4.l.google.com:19302' },
                        // Freie TURN Server für bessere NAT-Traversal
                        {
                            urls: 'turn:openrelay.metered.ca:80',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                this.log('✅ Host registriert mit ID: ' + id);
                resolve(this.sessionId);
            });

            this.peer.on('connection', (conn) => {
                this.log('🔌 Spieler verbindet sich...', conn.peer);
                this.connection = conn;
                this.setupConnection(true); // true = host receiving connection
            });

            this.peer.on('error', (err) => {
                this.log('❌ PeerJS Fehler:', err);
                if (err.type === 'unavailable-id') {
                    // Session-ID bereits vergeben, neue generieren
                    this.peer.destroy();
                    this.sessionId = this.generateSessionId();
                    this.createGame().then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });

            this.peer.on('disconnected', () => {
                this.log('⚠️ Vom PeerJS Server getrennt, versuche Reconnect...');
                this.peer.reconnect();
            });

            // Timeout
            setTimeout(() => {
                if (!this.peer || !this.peer.open) {
                    this.log('❌ Timeout beim Erstellen des Spiels');
                    reject(new Error('Verbindung zum Server fehlgeschlagen. Bitte Seite neu laden.'));
                }
            }, 15000);
        });
    }

    /**
     * Tritt einem bestehenden Spiel bei
     */
    async joinGame(sessionId) {
        return new Promise((resolve, reject) => {
            this.sessionId = sessionId.toUpperCase().trim();
            this.isHost = false;
            
            this.log('Verbinde zu Spiel: ' + this.sessionId);
            
            this.peer = new Peer({
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        { urls: 'stun:stun4.l.google.com:19302' },
                        {
                            urls: 'turn:openrelay.metered.ca:80',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        }
                    ]
                }
            });

            this.peer.on('open', (myId) => {
                this.log('✅ Eigene Peer-ID: ' + myId);
                this.log('🔌 Verbinde zu: guardian-' + this.sessionId);
                
                this.connection = this.peer.connect('guardian-' + this.sessionId, {
                    reliable: true,
                    serialization: 'json'
                });

                if (!this.connection) {
                    reject(new Error('Konnte keine Verbindung erstellen'));
                    return;
                }

                this.connection.on('open', () => {
                    this.log('✅ Verbindung zum Host hergestellt!');
                    this.connected = true;
                    
                    // Data und Close Handler einrichten
                    this.setupConnectionHandlers();
                    
                    // Callback auslösen
                    if (this.onConnected) {
                        this.onConnected();
                    }
                    
                    // Ping starten
                    this.startPing();
                    
                    resolve();
                });

                this.connection.on('error', (err) => {
                    this.log('❌ Verbindungsfehler:', err);
                    reject(new Error('Verbindungsfehler: ' + err.message));
                });
                
                // Timeout für die Verbindung
                setTimeout(() => {
                    if (!this.connected) {
                        this.log('❌ Verbindungs-Timeout');
                        reject(new Error('Verbindung fehlgeschlagen. Ist die Session-ID korrekt?'));
                    }
                }, 20000);
            });

            this.peer.on('error', (err) => {
                this.log('❌ PeerJS Fehler:', err);
                if (err.type === 'peer-unavailable') {
                    reject(new Error('Spiel nicht gefunden. Überprüfe die Session-ID.'));
                } else if (err.type === 'network') {
                    reject(new Error('Netzwerkfehler. Überprüfe deine Internetverbindung.'));
                } else if (err.type === 'server-error') {
                    reject(new Error('Server nicht erreichbar. Bitte später erneut versuchen.'));
                } else {
                    reject(new Error('Fehler: ' + err.type));
                }
            });

            this.peer.on('disconnected', () => {
                this.log('⚠️ Vom PeerJS Server getrennt');
            });
        });
    }

    /**
     * Richtet die Verbindung ein (für Host wenn Spieler beitritt)
     */
    setupConnection(isHostReceiving = false) {
        if (!this.connection) {
            this.log('❌ Keine Connection zum Setup');
            return;
        }

        if (isHostReceiving) {
            // Host empfängt Verbindung - Connection könnte schon offen sein
            if (this.connection.open) {
                this.log('✅ Verbindung bereits offen (Host)');
                this.connected = true;
                this.setupConnectionHandlers();
                if (this.onConnected) this.onConnected();
                this.startPing();
            } else {
                this.connection.on('open', () => {
                    this.log('✅ Verbindung geöffnet (Host)');
                    this.connected = true;
                    this.setupConnectionHandlers();
                    if (this.onConnected) this.onConnected();
                    this.startPing();
                });
            }
        }
    }

    /**
     * Richtet Data/Close/Error Handler ein
     */
    setupConnectionHandlers() {
        if (!this.connection) return;

        this.connection.on('data', (data) => {
            this.handleMessage(data);
        });

        this.connection.on('close', () => {
            this.log('🔌 Verbindung geschlossen');
            this.connected = false;
            if (this.onDisconnected) this.onDisconnected();
        });

        this.connection.on('error', (err) => {
            this.log('❌ Verbindungsfehler:', err);
            if (this.onError) this.onError(err);
        });
    }

    /**
     * Verarbeitet eingehende Nachrichten
     */
    handleMessage(data) {
        if (data.type === 'ping') {
            this.send({ type: 'pong', timestamp: data.timestamp });
        } else if (data.type === 'pong') {
            this.latency = Date.now() - data.timestamp;
        } else {
            if (this.onData) this.onData(data);
        }
    }

    /**
     * Sendet Daten an den anderen Spieler
     */
    send(data) {
        if (this.connection && this.connection.open) {
            try {
                this.connection.send(data);
            } catch (e) {
                this.log('❌ Sendefehler:', e);
            }
        }
    }

    /**
     * Sendet Spielzustand
     */
    sendGameState(state) {
        this.send({
            type: 'gameState',
            timestamp: Date.now(),
            ...state
        });
    }

    /**
     * Sendet Input
     */
    sendInput(input) {
        this.send({
            type: 'input',
            timestamp: Date.now(),
            input: input
        });
    }

    /**
     * Sendet Event Nachrichten
     */
    sendEvent(eventType, eventData) {
        this.send({
            type: 'event',
            eventType: eventType,
            data: eventData
        });
    }

    /**
     * Ping für Latenz-Messung
     */
    startPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.pingInterval = setInterval(() => {
            if (this.connected) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, 2000);
    }

    /**
     * Beendet die Verbindung
     */
    disconnect() {
        this.log('Trenne Verbindung...');
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.connected = false;
        this.connection = null;
        this.peer = null;
    }

    /**
     * Gibt zurück ob Verbindung aktiv ist
     */
    isConnected() {
        return this.connected && this.connection && this.connection.open;
    }
}

// Globale Instanz
const network = new NetworkManager();
