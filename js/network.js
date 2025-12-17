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
        this.retryCount = 0;
        this.maxRetries = 3;
        
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
        const logMsg = data ? `${msg} ${typeof data === 'string' ? data : JSON.stringify(data)}` : msg;
        console.log(`[${timestamp}] 🌐 ${logMsg}`);
        
        // Ins UI schreiben wenn vorhanden
        const debugLog = document.getElementById('debug-log');
        if (debugLog) {
            const div = document.createElement('div');
            div.textContent = `[${timestamp}] ${msg}`;
            debugLog.appendChild(div);
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    }

    /**
     * PeerJS Konfiguration
     */
    getPeerConfig() {
        return {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' },
                    // TURN Server für NAT Traversal
                    {
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ]
            }
        };
    }

    /**
     * Erstellt ein neues Spiel als Host
     */
    async createGame() {
        return new Promise((resolve, reject) => {
            this.sessionId = this.generateSessionId();
            this.isHost = true;
            
            const peerId = 'gs-' + this.sessionId; // gs = guardian slayer
            this.log('Erstelle Spiel: ' + this.sessionId);
            this.log('Peer-ID wird: ' + peerId);
            
            try {
                this.peer = new Peer(peerId, this.getPeerConfig());
            } catch (e) {
                this.log('❌ Fehler beim Erstellen des Peers: ' + e.message);
                reject(e);
                return;
            }

            this.peer.on('open', (id) => {
                this.log('✅ Registriert als: ' + id);
                resolve(this.sessionId);
            });

            this.peer.on('connection', (conn) => {
                this.log('🔌 Eingehende Verbindung von: ' + conn.peer);
                this.connection = conn;
                
                // Direkt Handler einrichten
                conn.on('open', () => {
                    this.log('✅ Verbindung zu Spieler 2 offen!');
                    this.connected = true;
                    this.setupDataHandlers(conn);
                    this.startPing();
                    if (this.onConnected) this.onConnected();
                });
                
                conn.on('error', (err) => {
                    this.log('❌ Verbindungsfehler: ' + err);
                });
                
                // Falls Connection schon offen ist
                if (conn.open) {
                    this.log('✅ Verbindung war bereits offen!');
                    this.connected = true;
                    this.setupDataHandlers(conn);
                    this.startPing();
                    if (this.onConnected) this.onConnected();
                }
            });

            this.peer.on('error', (err) => {
                this.log('❌ Peer Fehler: ' + err.type + ' - ' + err.message);
                
                if (err.type === 'unavailable-id') {
                    this.log('Session-ID vergeben, generiere neue...');
                    this.peer.destroy();
                    this.sessionId = this.generateSessionId();
                    this.createGame().then(resolve).catch(reject);
                } else if (err.type === 'server-error' || err.type === 'socket-error') {
                    reject(new Error('Server nicht erreichbar. Bitte später erneut versuchen.'));
                } else {
                    reject(new Error('Fehler: ' + err.type));
                }
            });

            this.peer.on('disconnected', () => {
                this.log('⚠️ Vom Server getrennt, reconnecte...');
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            });

            // Timeout
            setTimeout(() => {
                if (this.peer && !this.peer.open) {
                    this.log('❌ Timeout - Server antwortet nicht');
                    reject(new Error('Server Timeout. Bitte Seite neu laden.'));
                }
            }, 20000);
        });
    }

    /**
     * Tritt einem bestehenden Spiel bei
     */
    async joinGame(sessionId) {
        this.sessionId = sessionId.toUpperCase().trim();
        this.isHost = false;
        this.retryCount = 0;
        
        return this.attemptJoin();
    }
    
    async attemptJoin() {
        return new Promise((resolve, reject) => {
            const targetPeerId = 'gs-' + this.sessionId;
            this.log(`Verbindungsversuch ${this.retryCount + 1}/${this.maxRetries + 1}`);
            this.log('Suche Host: ' + targetPeerId);
            
            // Cleanup vorheriger Peer falls vorhanden
            if (this.peer) {
                this.peer.destroy();
            }
            
            try {
                this.peer = new Peer(this.getPeerConfig());
            } catch (e) {
                this.log('❌ Peer Erstellung fehlgeschlagen: ' + e.message);
                reject(e);
                return;
            }

            let connectionTimeout = null;
            let resolved = false;
            
            this.peer.on('open', (myId) => {
                this.log('✅ Eigene ID: ' + myId);
                this.log('🔌 Verbinde zu ' + targetPeerId + '...');
                
                try {
                    this.connection = this.peer.connect(targetPeerId, {
                        reliable: true,
                        serialization: 'json'
                    });
                } catch (e) {
                    this.log('❌ Connect fehlgeschlagen: ' + e.message);
                    reject(e);
                    return;
                }

                if (!this.connection) {
                    this.log('❌ Connection ist null');
                    reject(new Error('Verbindung konnte nicht erstellt werden'));
                    return;
                }

                this.connection.on('open', () => {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(connectionTimeout);
                    
                    this.log('✅ Verbunden mit Host!');
                    this.connected = true;
                    this.setupDataHandlers(this.connection);
                    this.startPing();
                    
                    if (this.onConnected) this.onConnected();
                    resolve();
                });

                this.connection.on('error', (err) => {
                    this.log('❌ Connection Error: ' + err);
                });
                
                // Connection timeout
                connectionTimeout = setTimeout(() => {
                    if (!resolved && !this.connected) {
                        this.log('⏱️ Verbindungs-Timeout');
                        
                        // Retry?
                        if (this.retryCount < this.maxRetries) {
                            this.retryCount++;
                            this.log('🔄 Versuche erneut...');
                            this.peer.destroy();
                            setTimeout(() => {
                                this.attemptJoin().then(resolve).catch(reject);
                            }, 1000);
                        } else {
                            reject(new Error('Spiel nicht gefunden. Überprüfe die Session-ID.'));
                        }
                    }
                }, 8000);
            });

            this.peer.on('error', (err) => {
                this.log('❌ Peer Fehler: ' + err.type);
                clearTimeout(connectionTimeout);
                
                if (resolved) return;
                
                if (err.type === 'peer-unavailable') {
                    // Retry?
                    if (this.retryCount < this.maxRetries) {
                        this.retryCount++;
                        this.log('🔄 Host nicht gefunden, versuche erneut... (' + this.retryCount + ')');
                        this.peer.destroy();
                        setTimeout(() => {
                            this.attemptJoin().then(resolve).catch(reject);
                        }, 2000);
                    } else {
                        reject(new Error('Spiel nicht gefunden. Ist der Host noch verbunden?'));
                    }
                } else if (err.type === 'network' || err.type === 'server-error') {
                    reject(new Error('Netzwerkfehler. Überprüfe deine Internetverbindung.'));
                } else {
                    reject(new Error('Fehler: ' + err.type));
                }
            });

            this.peer.on('disconnected', () => {
                this.log('⚠️ Vom Server getrennt');
            });
        });
    }

    /**
     * Richtet Data Handler ein
     */
    setupDataHandlers(conn) {
        conn.on('data', (data) => {
            this.handleMessage(data);
        });

        conn.on('close', () => {
            this.log('🔌 Verbindung geschlossen');
            this.connected = false;
            if (this.onDisconnected) this.onDisconnected();
        });

        conn.on('error', (err) => {
            this.log('❌ Data Error: ' + err);
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
     * Sendet Daten
     */
    send(data) {
        if (this.connection && this.connection.open) {
            try {
                this.connection.send(data);
            } catch (e) {
                this.log('❌ Send Error: ' + e.message);
            }
        }
    }

    sendGameState(state) {
        this.send({ type: 'gameState', timestamp: Date.now(), ...state });
    }

    sendInput(input) {
        this.send({ type: 'input', timestamp: Date.now(), input: input });
    }

    sendEvent(eventType, eventData) {
        this.send({ type: 'event', eventType: eventType, data: eventData });
    }

    startPing() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.connected) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, 2000);
    }

    disconnect() {
        this.log('Trenne Verbindung...');
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.connection) this.connection.close();
        if (this.peer) this.peer.destroy();
        this.connected = false;
        this.connection = null;
        this.peer = null;
    }

    isConnected() {
        return this.connected && this.connection && this.connection.open;
    }
}

// Globale Instanz
const network = new NetworkManager();
