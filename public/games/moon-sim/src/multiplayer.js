/**
 * REAKT Multiplayer Client Module
 * Connects to Colyseus server and syncs game state.
 *
 * Usage in reakt.html:
 *   <script src="https://unpkg.com/colyseus.js@0.15/dist/colyseus.js"></script>
 *   <script src="src/multiplayer.js"></script>
 *
 *   // After game init:
 *   const mp = new ReaktMultiplayer({
 *     serverUrl: "ws://localhost:2567",
 *     userId: "flock-user-id",
 *     username: "PlayerName",
 *     avatarUrl: "/avatar.png",
 *     onPlayerJoin: (sessionId, player) => { ... },
 *     onPlayerLeave: (sessionId) => { ... },
 *     onEnemyUpdate: (enemies) => { ... },
 *     onShotFired: (data) => { ... },
 *     onReaktorBlast: () => { ... },
 *     onWaveStart: (wave, count) => { ... },
 *   });
 *   await mp.connect();
 *
 *   // In game loop:
 *   mp.sendMove(player.x, player.y, player.z, camera.rotation.y, camera.rotation.x, sprinting);
 *   mp.sendShoot(enemyId, headshot);
 */

class ReaktMultiplayer {
  constructor(opts) {
    this.serverUrl = opts.serverUrl || "ws://localhost:2567";
    this.userId = opts.userId || "";
    this.username = opts.username || "Player";
    this.avatarUrl = opts.avatarUrl || "";

    // Callbacks
    this.onPlayerJoin = opts.onPlayerJoin || (() => {});
    this.onPlayerLeave = opts.onPlayerLeave || (() => {});
    this.onPlayerUpdate = opts.onPlayerUpdate || (() => {});
    this.onEnemyHit = opts.onEnemyHit || (() => {});
    this.onEnemyFractured = opts.onEnemyFractured || (() => {});
    this.onEnemyKilled = opts.onEnemyKilled || (() => {});
    this.onEnemyShattered = opts.onEnemyShattered || (() => {});
    this.onEnemyAttack = opts.onEnemyAttack || (() => {});
    this.onShotFired = opts.onShotFired || (() => {});
    this.onPulseFired = opts.onPulseFired || (() => {});
    this.onUltUsed = opts.onUltUsed || (() => {});
    this.onSparkPickedUp = opts.onSparkPickedUp || (() => {});
    this.onSparkThrown = opts.onSparkThrown || (() => {});
    this.onOutpostActivated = opts.onOutpostActivated || (() => {});
    this.onReaktorBlast = opts.onReaktorBlast || (() => {});
    this.onWaveStart = opts.onWaveStart || (() => {});
    this.onWaveClear = opts.onWaveClear || (() => {});
    this.onPlayerDied = opts.onPlayerDied || (() => {});
    this.onGameOver = opts.onGameOver || (() => {});
    this.onStateChange = opts.onStateChange || (() => {});

    this.client = null;
    this.room = null;
    this.sessionId = null;

    // Remote player interpolation buffers
    this._remotePlayers = {}; // sessionId -> { current, target, t }
  }

  async connect(roomName = "reakt") {
    this.client = new Colyseus.Client(this.serverUrl);

    try {
      this.room = await this.client.joinOrCreate(roomName, {
        userId: this.userId,
        username: this.username,
        avatarUrl: this.avatarUrl,
      });

      this.sessionId = this.room.sessionId;
      console.log(`[MP] Connected as ${this.username} (${this.sessionId})`);

      this._bindStateListeners();
      this._bindMessageListeners();

      return this.room;
    } catch (err) {
      console.error("[MP] Connection failed:", err);
      throw err;
    }
  }

  _bindStateListeners() {
    const state = this.room.state;

    // Player join/leave
    state.players.onAdd((player, sessionId) => {
      if (sessionId === this.sessionId) return; // skip self
      this._remotePlayers[sessionId] = {
        current: { x: player.x, y: player.y, z: player.z, rotY: player.rotY, rotX: player.rotX },
        target: { x: player.x, y: player.y, z: player.z, rotY: player.rotY, rotX: player.rotX },
        t: 0,
      };
      this.onPlayerJoin(sessionId, player);

      // Track position changes for interpolation
      player.onChange(() => {
        if (sessionId === this.sessionId) return;
        const rp = this._remotePlayers[sessionId];
        if (rp) {
          rp.current = { ...rp.target };
          rp.target = { x: player.x, y: player.y, z: player.z, rotY: player.rotY, rotX: player.rotX };
          rp.t = 0;
        }
        this.onPlayerUpdate(sessionId, player);
      });
    });

    state.players.onRemove((player, sessionId) => {
      delete this._remotePlayers[sessionId];
      this.onPlayerLeave(sessionId);
    });

    // State change (for HUD updates etc)
    this.room.onStateChange((state) => {
      this.onStateChange(state);
    });
  }

  _bindMessageListeners() {
    this.room.onMessage("shot_fired", (data) => this.onShotFired(data));
    this.room.onMessage("enemy_hit", (data) => this.onEnemyHit(data));
    this.room.onMessage("enemy_fractured", (data) => this.onEnemyFractured(data));
    this.room.onMessage("enemy_killed", (data) => this.onEnemyKilled(data));
    this.room.onMessage("enemy_shattered", (data) => this.onEnemyShattered(data));
    this.room.onMessage("enemy_attack", (data) => this.onEnemyAttack(data));
    this.room.onMessage("pulse_fired", (data) => this.onPulseFired(data));
    this.room.onMessage("ult_used", (data) => this.onUltUsed(data));
    this.room.onMessage("spark_picked_up", (data) => this.onSparkPickedUp(data));
    this.room.onMessage("spark_thrown", (data) => this.onSparkThrown(data));
    this.room.onMessage("outpost_activated", (data) => this.onOutpostActivated(data));
    this.room.onMessage("reaktor_blast", () => this.onReaktorBlast());
    this.room.onMessage("wave_start", (data) => this.onWaveStart(data.wave, data.count));
    this.room.onMessage("wave_clear", (data) => this.onWaveClear(data.nextWave));
    this.room.onMessage("player_died", (data) => this.onPlayerDied(data.sessionId));
    this.room.onMessage("game_over", (data) => this.onGameOver(data.reason));
  }

  // --- Send actions to server ---

  sendMove(x, y, z, rotY, rotX, sprinting) {
    if (!this.room) return;
    this.room.send("move", { x, y, z, rotY, rotX, sprinting });
  }

  sendShoot(enemyId = null, headshot = false) {
    if (!this.room) return;
    this.room.send("shoot", { enemyId, headshot });
  }

  sendReload() {
    if (!this.room) return;
    this.room.send("reload");
  }

  sendPickupSpark() {
    if (!this.room) return;
    this.room.send("pickup_spark");
  }

  sendThrowSpark(velX, velY, velZ) {
    if (!this.room) return;
    this.room.send("throw_spark", { velX, velY, velZ });
  }

  sendPulse() {
    if (!this.room) return;
    this.room.send("pulse");
  }

  sendUlt(type) {
    if (!this.room) return;
    this.room.send("use_ult", { type });
  }

  // --- Interpolation for remote players ---

  /**
   * Call this each frame to get smoothly interpolated positions
   * for all remote players. Returns Map<sessionId, {x, y, z, rotY, rotX}>
   */
  getInterpolatedPlayers(dt) {
    const result = {};
    const lerpSpeed = 10; // Higher = snappier

    for (const [sid, rp] of Object.entries(this._remotePlayers)) {
      rp.t = Math.min(1, rp.t + dt * lerpSpeed);
      result[sid] = {
        x: lerp(rp.current.x, rp.target.x, rp.t),
        y: lerp(rp.current.y, rp.target.y, rp.t),
        z: lerp(rp.current.z, rp.target.z, rp.t),
        rotY: lerpAngle(rp.current.rotY, rp.target.rotY, rp.t),
        rotX: lerp(rp.current.rotX, rp.target.rotX, rp.t),
      };
    }
    return result;
  }

  /**
   * Get the full synced state from server
   */
  getState() {
    return this.room ? this.room.state : null;
  }

  /**
   * Get local player's server state
   */
  getLocalPlayer() {
    if (!this.room) return null;
    return this.room.state.players.get(this.sessionId);
  }

  disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}

// --- Math helpers ---
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// Export for both module and script tag usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ReaktMultiplayer };
}
