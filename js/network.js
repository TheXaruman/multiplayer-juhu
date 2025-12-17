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
        
        // Callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onData = null;
        this.onError = null;
        
        // Message queue for reliable delivery
        this.messageQueue = [];
        this.messageId = 0;
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
     * Erstellt ein neues Spiel als Host
     */
    async createGame() {
        return new Promise((resolve, reject) => {
            this.sessionId = this.generateSessionId();
            this.isHost = true;
            
            // PeerJS mit eigener ID initialisieren
            this.peer = new Peer('guardian-' + this.sessionId, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                console.log('Host erstellt mit ID:', id);
                resolve(this.sessionId);
            });

            this.peer.on('connection', (conn) => {
                console.log('Spieler verbindet sich...');
                this.connection = conn;
                this.setupConnection();
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Fehler:', err);
                if (err.type === 'unavailable-id') {
                    // Session-ID bereits vergeben, neue generieren
                    this.peer.destroy();
                    this.sessionId = this.generateSessionId();
                    this.createGame().then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });

            // Timeout
            setTimeout(() => {
                if (!this.peer || !this.peer.open) {
                    reject(new Error('Verbindung zum Server fehlgeschlagen'));
                }
            }, 10000);
        });
    }

    /**
     * Tritt einem bestehenden Spiel bei
     */
    async joinGame(sessionId) {
        return new Promise((resolve, reject) => {
            this.sessionId = sessionId.toUpperCase().trim();
            this.isHost = false;
            
            this.peer = new Peer({
                debug: 1
            });

            this.peer.on('open', () => {
                console.log('Peer geöffnet, verbinde zu:', 'guardian-' + this.sessionId);
                
                this.connection = this.peer.connect('guardian-' + this.sessionId, {
                    reliable: true
                });

                this.connection.on('open', () => {
                    console.log('Verbindung hergestellt!');
                    this.setupConnection();
                    resolve();
                });

                this.connection.on('error', (err) => {
                    console.error('Verbindungsfehler:', err);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Fehler:', err);
                if (err.type === 'peer-unavailable') {
                    reject(new Error('Spiel nicht gefunden. Überprüfe die Session-ID.'));
                } else {
                    reject(err);
                }
            });

            // Timeout
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Verbindung fehlgeschlagen. Spiel nicht gefunden.'));
                }
            }, 15000);
        });
    }

    /**
     * Richtet die Verbindung ein
     */
    setupConnection() {
        if (!this.connection) return;

        this.connection.on('open', () => {
            this.connected = true;
            console.log('Verbindung vollständig hergestellt');
            if (this.onConnected) this.onConnected();
        });

        this.connection.on('data', (data) => {
            this.handleMessage(data);
        });

        this.connection.on('close', () => {
            this.connected = false;
            console.log('Verbindung geschlossen');
            if (this.onDisconnected) this.onDisconnected();
        });

        this.connection.on('error', (err) => {
            console.error('Verbindungsfehler:', err);
            if (this.onError) this.onError(err);
        });

        // Ping für Latenz-Messung starten
        this.startPing();
    }

    /**
     * Verarbeitet eingehende Nachrichten
     */
    handleMessage(data) {
        if (data.type === 'ping') {
            // Pong zurücksenden
            this.send({ type: 'pong', timestamp: data.timestamp });
        } else if (data.type === 'pong') {
            // Latenz berechnen
            this.latency = Date.now() - data.timestamp;
        } else {
            // Spielnachrichten an Callback weiterleiten
            if (this.onData) this.onData(data);
        }
    }

    /**
     * Sendet Daten an den anderen Spieler
     */
    send(data) {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        }
    }

    /**
     * Sendet Spielzustand (für Host)
     */
    sendGameState(state) {
        this.send({
            type: 'gameState',
            timestamp: Date.now(),
            ...state
        });
    }

    /**
     * Sendet Input (für Client)
     */
    sendInput(input) {
        this.send({
            type: 'input',
            timestamp: Date.now(),
            input: input
        });
    }

    /**
     * Sendet Chat/Event Nachrichten
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
        setInterval(() => {
            if (this.connected) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, 2000);
    }

    /**
     * Beendet die Verbindung
     */
    disconnect() {
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

