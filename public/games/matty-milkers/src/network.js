/* ============================================
   NETWORKING — WebSocket multiplayer layer
   Local + online multiplayer ready
   ============================================ */

class NetworkManager {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.playerId = null;
        this.roomId = null;
        this.players = {};
        this.signals = new EventBus();
        this._messageQueue = [];
        this._interpolationBuffer = {};
        this.latency = 0;
        this._pingTime = 0;
    }

    // ---- Connection ----
    connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.connected = true;
                this.signals.emit('connected');
                resolve();
            };

            this.ws.onclose = () => {
                this.connected = false;
                this.signals.emit('disconnected');
            };

            this.ws.onerror = (e) => {
                this.signals.emit('error', e);
                reject(e);
            };

            this.ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    this._handleMessage(msg);
                } catch (err) {
                    console.error('Network parse error:', err);
                }
            };
        });
    }

    disconnect() {
        if (this.ws) this.ws.close();
        this.connected = false;
    }

    // ---- Sending ----
    send(type, data = {}) {
        if (!this.connected) {
            this._messageQueue.push({ type, data });
            return;
        }
        this.ws.send(JSON.stringify({ type, data, playerId: this.playerId, timestamp: Date.now() }));
    }

    // Sync player position (call each frame)
    syncPosition(x, y, state = {}) {
        this.send('position', { x, y, ...state });
    }

    // Send game event
    sendEvent(event, data = {}) {
        this.send('event', { event, ...data });
    }

    // ---- Room Management ----
    createRoom(config = {}) {
        this.send('create_room', config);
    }

    joinRoom(roomId) {
        this.send('join_room', { roomId });
    }

    leaveRoom() {
        this.send('leave_room', {});
    }

    // ---- Internal ----
    _handleMessage(msg) {
        switch (msg.type) {
            case 'welcome':
                this.playerId = msg.data.playerId;
                this.signals.emit('welcome', msg.data);
                break;

            case 'room_joined':
                this.roomId = msg.data.roomId;
                this.signals.emit('room_joined', msg.data);
                break;

            case 'player_joined':
                this.players[msg.data.playerId] = msg.data;
                this.signals.emit('player_joined', msg.data);
                break;

            case 'player_left':
                delete this.players[msg.data.playerId];
                this.signals.emit('player_left', msg.data);
                break;

            case 'position':
                // Store in interpolation buffer
                if (!this._interpolationBuffer[msg.playerId]) {
                    this._interpolationBuffer[msg.playerId] = [];
                }
                this._interpolationBuffer[msg.playerId].push({
                    ...msg.data,
                    timestamp: msg.timestamp
                });
                // Keep only last 10 states
                if (this._interpolationBuffer[msg.playerId].length > 10) {
                    this._interpolationBuffer[msg.playerId].shift();
                }
                this.signals.emit('position', msg);
                break;

            case 'event':
                this.signals.emit('game_event', msg.data);
                break;

            case 'state':
                this.signals.emit('state_sync', msg.data);
                break;

            case 'pong':
                this.latency = Date.now() - this._pingTime;
                break;

            default:
                this.signals.emit(msg.type, msg.data);
        }
    }

    // Get interpolated position for a remote player
    getInterpolatedPosition(playerId, renderDelay = 100) {
        const buffer = this._interpolationBuffer[playerId];
        if (!buffer || buffer.length < 2) {
            return buffer?.[0] || null;
        }

        const renderTime = Date.now() - renderDelay;
        let before = null;
        let after = null;

        for (let i = 0; i < buffer.length - 1; i++) {
            if (buffer[i].timestamp <= renderTime && buffer[i + 1].timestamp >= renderTime) {
                before = buffer[i];
                after = buffer[i + 1];
                break;
            }
        }

        if (!before || !after) return buffer[buffer.length - 1];

        const t = (renderTime - before.timestamp) / (after.timestamp - before.timestamp);
        return {
            x: before.x + (after.x - before.x) * t,
            y: before.y + (after.y - before.y) * t
        };
    }

    // Ping for latency measurement
    ping() {
        this._pingTime = Date.now();
        this.send('ping', {});
    }

    // Flush queued messages
    _flushQueue() {
        while (this._messageQueue.length > 0 && this.connected) {
            const msg = this._messageQueue.shift();
            this.send(msg.type, msg.data);
        }
    }
}


/* ============================================
   LOCAL MULTIPLAYER — Split screen
   ============================================ */

class SplitScreen {
    constructor(engine, playerCount = 2) {
        this.engine = engine;
        this.playerCount = playerCount;
        this.cameras = [];
        this.viewports = [];

        // Calculate viewport layout
        if (playerCount === 2) {
            this.viewports = [
                { x: 0, y: 0, w: engine.width / 2, h: engine.height },
                { x: engine.width / 2, y: 0, w: engine.width / 2, h: engine.height }
            ];
        } else if (playerCount <= 4) {
            this.viewports = [
                { x: 0, y: 0, w: engine.width / 2, h: engine.height / 2 },
                { x: engine.width / 2, y: 0, w: engine.width / 2, h: engine.height / 2 },
                { x: 0, y: engine.height / 2, w: engine.width / 2, h: engine.height / 2 },
                { x: engine.width / 2, y: engine.height / 2, w: engine.width / 2, h: engine.height / 2 }
            ];
        }

        // Create camera per viewport
        for (const vp of this.viewports) {
            this.cameras.push(new Camera(vp.w, vp.h));
        }
    }

    render(ctx, scene) {
        for (let i = 0; i < this.playerCount; i++) {
            const vp = this.viewports[i];
            const cam = this.cameras[i];

            ctx.save();
            // Clip to viewport
            ctx.beginPath();
            ctx.rect(vp.x, vp.y, vp.w, vp.h);
            ctx.clip();

            // Translate to viewport origin
            ctx.translate(vp.x, vp.y);

            // Apply camera
            cam.applyTransform(ctx);

            // Render scene
            if (scene) scene._render(ctx);

            ctx.restore();

            // Draw viewport border
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(vp.x, vp.y, vp.w, vp.h);
        }
    }

    update(dt) {
        for (const cam of this.cameras) cam.update(dt);
    }
}


window.NetworkManager = NetworkManager;
window.SplitScreen = SplitScreen;
