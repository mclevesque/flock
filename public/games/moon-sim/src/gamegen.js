/* ============================================
   GAME GENERATOR — "5-Minute Mario"
   Takes a simple config, outputs a complete game.
   CLAIRVOYANCE-validated before you even play.

   Usage:
     const game = GameGenerator.create(engine, {
       title: 'Space Rescue',
       genre: 'platformer',
       story: 'space cop saves girlfriend from aliens',
       levels: 2,
       difficulty: 'medium',
       mood: 'action'
     });

   That's it. Full game with title screen, levels,
   enemies, coins, HUD, boss, music, and victory screen.
   ============================================ */

class GameGenerator {

    static create(engine, config) {
        const gen = new GameGenerator(engine, config);
        gen.build();
        return gen;
    }

    constructor(engine, config) {
        this.engine = engine;
        this.config = {
            title: config.title || 'Untitled Game',
            genre: config.genre || 'platformer',
            story: config.story || 'hero saves the world',
            levels: config.levels || 2,
            difficulty: config.difficulty || 'medium', // easy, medium, hard
            mood: config.mood || 'action', // action, chill, dark, funny
            tileSize: config.tileSize || 16,
            playerSprite: config.playerSprite || null, // user PNG or null for procedural
            enemySprites: config.enemySprites || [],
            tilesetSprite: config.tilesetSprite || null,
            hasGun: config.hasGun !== false,
            hasDoubleJump: config.hasDoubleJump !== false,
            ...config
        };

        // CLAIRVOYANCE calculates physics
        this.cv = new Clairvoyance(engine);
        this.physics = this.cv.calculateIdealPhysics(
            engine.width, engine.height, 2, this.config.tileSize,
            this.config.genre === 'topdown' ? 'topdown' : 'platformer'
        );

        // Difficulty modifiers
        this.diffMod = {
            easy:   { enemyCount: 0.5, enemySpeed: 0.7, gapSize: 0.7, coinCount: 1.5, lives: 5 },
            medium: { enemyCount: 1.0, enemySpeed: 1.0, gapSize: 1.0, coinCount: 1.0, lives: 3 },
            hard:   { enemyCount: 1.5, enemySpeed: 1.3, gapSize: 1.2, coinCount: 0.7, lives: 2 }
        }[this.config.difficulty] || { enemyCount: 1, enemySpeed: 1, gapSize: 1, coinCount: 1, lives: 3 };

        this.music = new MusicEngine();
        this.gameState = { lives: this.diffMod.lives, score: 0, coins: 0, level: 1, state: 'title' };
    }

    build() {
        this._generateSprites();
        this._buildTitleScreen();
        for (let i = 1; i <= this.config.levels; i++) {
            this._buildLevel(i);
        }
        this._buildGameOverScreen();
        this._buildVictoryScreen();

        // Start
        this.gameState.state = 'title';
        this.engine.start('title');
        this.music.playSong(MusicEngine.SONGS.titleScreen);

        // Audio unlock
        document.addEventListener('click', () => {
            this.music._ensureContext();
            if (this.music._ctx?.state === 'suspended') this.music._ctx.resume();
            this.engine.audio.resume();
        }, { once: true });
    }

    // =============================================
    //  SPRITE GENERATION
    // =============================================
    _generateSprites() {
        const assets = this.engine.assets;
        const ts = this.config.tileSize;

        // ---- PLAYER ----
        if (!this.config.playerSprite) {
            const pc = this._createCanvas(160, 24); // 10 frames x 16
            const ctx = pc.getContext('2d');
            const colors = this._getMoodColors();

            for (let f = 0; f < 4; f++) { // Idle
                this._drawCharacter(ctx, f * 16, 0, f, colors.player, colors.playerAccent);
            }
            for (let f = 0; f < 4; f++) { // Run
                this._drawCharacter(ctx, (4 + f) * 16, 0, f, colors.player, colors.playerAccent, true);
            }
            // Jump + Fall
            this._drawCharacter(ctx, 8 * 16, 0, 0, colors.player, colors.playerAccent, false, 'jump');
            this._drawCharacter(ctx, 9 * 16, 0, 0, colors.player, colors.playerAccent, false, 'fall');

            this._canvasToImage(pc, 'player');
            assets.defineSpritesheet('player_sheet', 'player', {
                frameWidth: 16, frameHeight: 24,
                animations: {
                    idle: { frames: [0,1,2,3], speed: 0.3, loop: true },
                    run: { frames: [4,5,6,7], speed: 0.1, loop: true },
                    jump: { frames: [8], speed: 0.2, loop: false },
                    fall: { frames: [9], speed: 0.2, loop: false }
                }
            });
        }

        // ---- ENEMY (ground) ----
        const ec = this._createCanvas(64, 16);
        const ectx = ec.getContext('2d');
        const eColors = this._getMoodColors();
        for (let f = 0; f < 4; f++) {
            this._drawEnemy(ectx, f * 16, 0, f, eColors.enemy);
        }
        this._canvasToImage(ec, 'enemy_ground');
        assets.defineSpritesheet('enemy_ground_sheet', 'enemy_ground', {
            frameWidth: 16, frameHeight: 16,
            animations: { walk: { frames: [0,1,2,3], speed: 0.2, loop: true } }
        });

        // ---- ENEMY (flying) ----
        const fc = this._createCanvas(48, 16);
        const fctx = fc.getContext('2d');
        for (let f = 0; f < 3; f++) {
            this._drawFlyer(fctx, f * 16, 0, f, eColors.enemyFlyer);
        }
        this._canvasToImage(fc, 'enemy_flyer');
        assets.defineSpritesheet('enemy_flyer_sheet', 'enemy_flyer', {
            frameWidth: 16, frameHeight: 16,
            animations: { fly: { frames: [0,1,2,1], speed: 0.12, loop: true } }
        });

        // ---- COIN ----
        const cc = this._createCanvas(48, 12);
        const cctx = cc.getContext('2d');
        for (let f = 0; f < 4; f++) {
            const w = [10,6,10,6][f];
            const ox = f * 12 + (12 - w) / 2;
            cctx.fillStyle = '#ffcc00';
            cctx.fillRect(ox, 1, w, 10);
            cctx.fillStyle = '#ffdd44';
            cctx.fillRect(ox + 1, 2, Math.max(1, w - 2), 8);
        }
        this._canvasToImage(cc, 'coin');
        assets.defineSpritesheet('coin_sheet', 'coin', {
            frameWidth: 12, frameHeight: 12,
            animations: { spin: { frames: [0,1,2,3], speed: 0.12, loop: true } }
        });

        // ---- TILESET ----
        if (!this.config.tilesetSprite) {
            const tc = this._createCanvas(64, 16);
            const tctx = tc.getContext('2d');
            const tColors = this._getMoodColors();

            // Tile 0: surface
            tctx.fillStyle = tColors.tileSurface;
            tctx.fillRect(0, 0, 16, 16);
            tctx.fillStyle = tColors.tileSurfaceTop;
            tctx.fillRect(0, 0, 16, 5);

            // Tile 1: fill
            tctx.fillStyle = tColors.tileFill;
            tctx.fillRect(16, 0, 16, 16);

            // Tile 2: alt surface
            tctx.fillStyle = tColors.tileAlt;
            tctx.fillRect(32, 0, 16, 16);
            tctx.fillStyle = tColors.tileAltTop;
            tctx.fillRect(32, 0, 16, 4);

            // Tile 3: alt fill
            tctx.fillStyle = tColors.tileAltFill;
            tctx.fillRect(48, 0, 16, 16);

            this._canvasToImage(tc, 'tiles');
        }

        // ---- BACKGROUNDS ----
        const bgc = this._createCanvas(480, 270);
        const bgctx = bgc.getContext('2d');
        const bgColors = this._getMoodColors();
        bgctx.fillStyle = bgColors.skyTop;
        bgctx.fillRect(0, 0, 480, 135);
        bgctx.fillStyle = bgColors.skyBottom;
        bgctx.fillRect(0, 135, 480, 135);
        // Stars/details
        for (let i = 0; i < 80; i++) {
            bgctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 + 0.1})`;
            bgctx.fillRect(Math.random() * 480, Math.random() * 270, 1, 1);
        }
        this._canvasToImage(bgc, 'bg');

        // Mountains/horizon
        const mc = this._createCanvas(480, 270);
        const mctx = mc.getContext('2d');
        mctx.fillStyle = bgColors.mountain;
        for (let x = 0; x < 480; x += 2) {
            const h = 40 + Math.sin(x * 0.02) * 30 + Math.sin(x * 0.05) * 15;
            mctx.fillRect(x, 270 - h, 2, h);
        }
        this._canvasToImage(mc, 'mountains');
    }

    // =============================================
    //  LEVEL BUILDER
    // =============================================
    _buildLevel(levelNum) {
        const scene = new Scene(`Level${levelNum}`);
        const ts = this.config.tileSize;
        const isLastLevel = levelNum === this.config.levels;
        const gs = this.gameState;
        const self = this;
        const diff = this.diffMod;

        // Parallax
        const bg = new ParallaxLayer('BG', 'bg', 0.1);
        scene.addChild(bg);
        const mts = new ParallaxLayer('Mountains', 'mountains', 0.3);
        scene.addChild(mts);

        // Tilemap
        const mapW = 60 + levelNum * 20;
        const mapH = 17;
        const groundRow = 13;
        const tilemap = new TileMap('Level');
        tilemap.imageName = 'tiles';
        tilemap.tileWidth = ts;
        tilemap.tileHeight = ts;
        tilemap.columns = 4;
        tilemap.create(mapW, mapH, -1);

        // Ground first!
        const surfaceTile = levelNum === 1 ? 0 : 2;
        const fillTile = levelNum === 1 ? 1 : 3;
        tilemap.addGround(groundRow, 0, mapW - 1, surfaceTile, fillTile);

        // Generate gaps — CLAIRVOYANCE validated
        const maxGapTiles = Math.floor(parseFloat(this.physics.maxGapClearable) * 0.7); // 30% safety margin
        const gapPositions = [];
        let col = 8;
        while (col < mapW - 8) {
            const gapW = Math.min(maxGapTiles, Math.max(2, Math.floor(2 * diff.gapSize)));
            tilemap.carveGap(groundRow, col, gapW);
            gapPositions.push({ col, width: gapW });
            col += 10 + Math.floor(Math.random() * 8);
        }

        // Generate platforms
        const platformPositions = [];
        col = 6;
        while (col < mapW - 5) {
            const platRow = groundRow - 3 - Math.floor(Math.random() * 4);
            const platW = 3 + Math.floor(Math.random() * 3);
            if (platRow > 3) {
                tilemap.addPlatform(platRow, col, platW, surfaceTile);
                platformPositions.push({ col, row: platRow, width: platW });
            }
            col += 8 + Math.floor(Math.random() * 6);
        }

        // Walls
        tilemap.addWall(0, 0, 8, fillTile);
        tilemap.addWall(mapW - 1, 0, groundRow, fillTile);

        tilemap.collisionTiles = new Set([0, 1, 2, 3]);
        scene.addChild(tilemap);

        // ---- PLAYER ----
        const player = this._createPlayer(scene);

        // ---- COINS (Sonic-style arcs over gaps + ground trails) ----
        // Ground trails
        for (let i = 3; i < 7; i++) {
            this._createCoin(scene, i * ts, (groundRow - 1) * ts - 4);
        }
        // Arcs over gaps
        for (const gap of gapPositions) {
            const cx = (gap.col + gap.width / 2) * ts;
            const startX = gap.col * ts - ts;
            for (let i = 0; i < gap.width + 2; i++) {
                const t = i / (gap.width + 1);
                const arcY = (groundRow - 2) * ts - Math.sin(t * Math.PI) * ts * 2.5;
                this._createCoin(scene, startX + i * ts, arcY);
            }
        }
        // Platform rewards
        for (const plat of platformPositions) {
            if (Math.random() < 0.6 * diff.coinCount) {
                for (let i = 0; i < plat.width; i++) {
                    this._createCoin(scene, (plat.col + i) * ts, (plat.row - 1) * ts - 4);
                }
            }
        }

        // ---- ENEMIES ----
        // Ground enemies between gaps
        const safeZones = this._findSafeZones(gapPositions, mapW, groundRow);
        let enemyCount = Math.floor(safeZones.length * 0.6 * diff.enemyCount);
        for (let i = 0; i < enemyCount && i < safeZones.length; i++) {
            const zone = safeZones[i];
            if (zone.width < 4) continue;
            const ex = (zone.start + Math.floor(zone.width / 2)) * ts;
            const patrol = Math.floor(zone.width / 3) * ts;
            this._createGroundEnemy(scene, ex, (groundRow - 1) * ts, patrol, diff.enemySpeed);
        }

        // Flying enemies over gaps
        let flyerCount = Math.floor(gapPositions.length * 0.4 * diff.enemyCount);
        for (let i = 0; i < flyerCount && i < gapPositions.length; i++) {
            const gap = gapPositions[i * 2] || gapPositions[i];
            const fx = (gap.col + gap.width / 2) * ts;
            this._createFlyingEnemy(scene, fx, (groundRow - 5) * ts, 25, diff.enemySpeed);
        }

        // ---- BOSS on last level ----
        if (isLastLevel) {
            this._createBoss(scene, (mapW - 8) * ts, (groundRow - 2) * ts);
        }

        // ---- EXIT ----
        if (!isLastLevel) {
            const exit = new Area2D('Exit');
            exit.position = { x: (mapW - 3) * ts, y: (groundRow - 4) * ts };
            exit.collider = { x: 0, y: 0, width: ts * 2, height: ts * 4 };
            exit._time = 0;
            exit.draw = function(ctx) {
                this._time += 0.016;
                const pulse = 0.5 + Math.sin(this._time * 3) * 0.3;
                ctx.fillStyle = `rgba(0, 255, 100, ${pulse})`;
                ctx.fillRect(0, 0, 4, ts * 4);
                ctx.fillRect(ts * 2 - 4, 0, 4, ts * 4);
                ctx.fillRect(0, 0, ts * 2, 4);
                ctx.fillStyle = '#00ff66';
                ctx.font = '8px monospace';
                ctx.fillText('EXIT', 4, ts * 2);
            };
            exit.signals.on('body_entered', (body) => {
                if (body.tags.has('player')) {
                    gs.level++;
                    gs.state = 'playing';
                    self.engine.switchScene(`level${gs.level}`, 'fade');
                    self.music.stopSong();
                    self.music.playSong(MusicEngine.SONGS.battle);
                }
            });
            scene.addChild(exit);
        }

        // ---- CAMERA (on enter) ----
        scene.signals.on('entered', () => {
            this.engine.camera.follow(player, 0.08);
            this.engine.camera.setBounds(0, 0, tilemap.pixelWidth, tilemap.pixelHeight);
            this.engine.camera.setZoom(2, true);
            this.engine.camera.position = { x: player.position.x, y: player.position.y };
            this.engine.camera.deadZone = { x: 8, y: 15 };
            this.engine.camera.lookAheadDistance = 30;
        });

        // ---- HUD ----
        this._addHUD(scene, levelNum);

        // ---- CLAIRVOYANCE PREFLIGHT ----
        const preflight = this.cv.preflightCheck(tilemap, this.physics.speed, this.physics.jumpForce, this.physics.gravity, ts);
        if (!preflight.passed) {
            console.warn(`CLAIRVOYANCE: Level ${levelNum} has issues:`, preflight.checks.filter(c => !c.passed));
        }

        this.engine.addScene(`level${levelNum}`, scene);
    }

    // =============================================
    //  ENTITY FACTORIES
    // =============================================
    _createPlayer(scene) {
        const gs = this.gameState;
        const self = this;
        const ph = this.physics;

        const player = new PhysicsBody('Player');
        player.position = { x: 48, y: 160 };
        player.gravity = ph.gravity;
        player.friction = 1.0;
        player.collider = { x: 2, y: 2, width: 12, height: 22 };
        player.tags.add('player');

        const sprite = new AnimatedSprite('Sprite');
        sprite.setSpritesheet('player_sheet');
        sprite.addAnimation('idle', { frames: [0,1,2,3], speed: 0.3, loop: true });
        sprite.addAnimation('run', { frames: [4,5,6,7], speed: 0.1, loop: true });
        sprite.addAnimation('jump', { frames: [8], speed: 0.2, loop: false });
        sprite.addAnimation('fall', { frames: [9], speed: 0.2, loop: false });
        sprite.play('idle');
        player.addChild(sprite);

        // State
        player._coyoteTimer = 0;
        player._jumpBufferTimer = 0;
        player._wasOnFloor = false;
        player._shootCooldown = 0;
        player._invincible = 0;

        player.update = function(dt) {
            if (gs.state !== 'playing') return;
            const input = this.engine.input;

            // Invincibility
            if (this._invincible > 0) {
                this._invincible -= dt;
                sprite.visible = Math.floor(this._invincible * 10) % 2 === 0;
            } else { sprite.visible = true; }

            // Coyote time
            if (this.isOnFloor) {
                this._coyoteTimer = ph.coyoteTime;
                if (!this._wasOnFloor) {
                    sprite.squash(0.2);
                    self.engine.audio.sfxLand();
                }
            } else { this._coyoteTimer -= dt; }
            this._wasOnFloor = this.isOnFloor;

            // Input
            let moveX = 0;
            if (input.isKey('ArrowLeft') || input.isKey('KeyA')) moveX = -1;
            if (input.isKey('ArrowRight') || input.isKey('KeyD')) moveX = 1;
            const gpAxis = input.getAxis('left');
            if (Math.abs(gpAxis.x) > 0.2) moveX = gpAxis.x;

            // Movement (proper acceleration curve)
            if (moveX !== 0) {
                const targetVx = moveX * ph.speed;
                const accelRate = this.isOnFloor ? ph.accelRate : ph.accelRate * ph.airControlRatio;
                this.velocity.x += (targetVx - this.velocity.x) * accelRate * dt;
            } else if (this.isOnFloor) {
                this.velocity.x *= ph.decelFriction;
                if (Math.abs(this.velocity.x) < 2) this.velocity.x = 0;
            }
            if (moveX !== 0) sprite.flipH = moveX < 0;

            // Jump
            const jumpDown = input.isKeyDown('Space') || input.isKeyDown('ArrowUp') || input.isKeyDown('KeyW') || input.isKeyDown('gamepad_a');
            if (jumpDown) this._jumpBufferTimer = ph.jumpBuffer;
            else this._jumpBufferTimer -= dt;

            if (this._jumpBufferTimer > 0 && this._coyoteTimer > 0) {
                this.velocity.y = ph.jumpForce;
                this._coyoteTimer = 0;
                this._jumpBufferTimer = 0;
                sprite.stretch(0.15);
                self.engine.audio.sfxJump();
            }

            // Variable jump
            const jumpUp = input.isKeyUp('Space') || input.isKeyUp('ArrowUp') || input.isKeyUp('KeyW');
            if (jumpUp && this.velocity.y < 0) this.velocity.y *= 0.5;

            // Fast fall (snappier landings)
            if (this.velocity.y > 0) {
                this.velocity.y += ph.gravity * ph.fastFallMultiplier * dt * 0.5;
            }

            // Blaster
            if (self.config.hasGun) {
                if (this._shootCooldown > 0) this._shootCooldown -= dt;
                const shoot = input.isKeyDown('KeyX') || input.isKeyDown('KeyJ') || input.isKeyDown('gamepad_x');
                if (shoot && this._shootCooldown <= 0) {
                    this._shootCooldown = 0.25;
                    const dir = sprite.flipH ? -1 : 1;
                    self._createBullet(scene, this.position.x + (dir > 0 ? 14 : -4), this.position.y + 8, dir);
                    self.engine.audio.synth('square', { frequency: 800, frequencyEnd: 400, duration: 0.08, volume: 0.15 });
                }
            }

            // Animation
            if (!this.isOnFloor) sprite.play(this.velocity.y < 0 ? 'jump' : 'fall');
            else if (Math.abs(this.velocity.x) > 15) sprite.play('run');
            else sprite.play('idle');

            // Death
            if (this.position.y > 300) this._die();
        };

        player._die = function() {
            gs.lives--;
            self.engine.shake(10);
            self.engine.audio.sfxDeath();
            if (gs.lives <= 0) {
                gs.state = 'gameover';
                self.engine.switchScene('gameover', 'fade');
                self.music.stopSong();
            } else {
                this.position = { x: 48, y: 160 };
                this.velocity = { x: 0, y: 0 };
                this._invincible = 2;
            }
        };

        player._hurt = function() {
            if (this._invincible > 0) return;
            this._die();
        };

        scene.addChild(player);
        return player;
    }

    _createCoin(scene, x, y) {
        const gs = this.gameState;
        const self = this;
        const coin = new Area2D('Coin');
        coin.position = { x, y };
        coin.collider = { x: -2, y: -2, width: 16, height: 16 };
        coin.tags.add('coin');
        coin._time = Math.random() * Math.PI * 2;
        coin._baseY = y;

        const sprite = new AnimatedSprite('CS');
        sprite.setSpritesheet('coin_sheet');
        sprite.addAnimation('spin', { frames: [0,1,2,3], speed: 0.12, loop: true });
        sprite.play('spin');
        coin.addChild(sprite);

        coin.update = function(dt) {
            this._time += dt * 3;
            this.position.y = this._baseY + Math.sin(this._time) * 3;
        };

        coin.signals.on('body_entered', (body) => {
            if (body.tags.has('player')) {
                gs.coins++;
                gs.score += 50;
                self.engine.audio.sfxCoin();
                coin.destroy();
            }
        });

        scene.addChild(coin);
    }

    _createGroundEnemy(scene, x, y, patrolDist, speedMul) {
        const gs = this.gameState;
        const self = this;
        const enemy = new PhysicsBody('Grunt');
        enemy.position = { x, y };
        enemy.gravity = 800;
        enemy.friction = 0.9;
        enemy.collider = { x: 2, y: 2, width: 12, height: 14 };
        enemy.tags.add('enemy');

        const sprite = new AnimatedSprite('ES');
        sprite.setSpritesheet('enemy_ground_sheet');
        sprite.addAnimation('walk', { frames: [0,1,2,3], speed: 0.2, loop: true });
        sprite.play('walk');
        enemy.addChild(sprite);

        enemy._startX = x;
        enemy._dir = 1;
        enemy._speed = 40 * speedMul;
        enemy._patrolDist = patrolDist;

        enemy.update = function(dt) {
            if (gs.state !== 'playing') return;
            this.velocity.x = this._dir * this._speed;
            sprite.flipH = this._dir < 0;
            if (this.position.x > this._startX + this._patrolDist) this._dir = -1;
            if (this.position.x < this._startX - this._patrolDist) this._dir = 1;

            const player = scene.getChild('Player');
            if (player && player._invincible <= 0) {
                const pb = player.getWorldBounds();
                const eb = this.getWorldBounds();
                if (pb.x < eb.right && pb.right > eb.x && pb.y < eb.bottom && pb.bottom > eb.y) {
                    if (player.velocity.y > 0 && pb.bottom < eb.y + 8) {
                        player.velocity.y = -250;
                        gs.score += 100;
                        self.engine.shake(3);
                        self.engine.freeze(40);
                        self.engine.audio.sfxHit();
                        this.destroy();
                    } else { player._hurt(); }
                }
            }
        };

        scene.addChild(enemy);
    }

    _createFlyingEnemy(scene, x, y, amplitude, speedMul) {
        const gs = this.gameState;
        const self = this;
        const enemy = new PhysicsBody('Flyer');
        enemy.position = { x, y };
        enemy.gravity = 0;
        enemy.collider = { x: 1, y: 3, width: 14, height: 10 };
        enemy.tags.add('enemy');
        enemy.bodyType = 'kinematic';

        const sprite = new AnimatedSprite('FS');
        sprite.setSpritesheet('enemy_flyer_sheet');
        sprite.addAnimation('fly', { frames: [0,1,2,1], speed: 0.12, loop: true });
        sprite.play('fly');
        enemy.addChild(sprite);

        enemy._startX = x;
        enemy._startY = y;
        enemy._time = Math.random() * Math.PI * 2;
        enemy._dir = 1;
        enemy._speed = 30 * speedMul;
        enemy._amplitude = amplitude;

        enemy.update = function(dt) {
            if (gs.state !== 'playing') return;
            this._time += dt * 2;
            this.position.y = this._startY + Math.sin(this._time) * this._amplitude;
            this.position.x += this._dir * this._speed * dt;
            sprite.flipH = this._dir < 0;
            if (this.position.x > this._startX + 60) this._dir = -1;
            if (this.position.x < this._startX - 60) this._dir = 1;

            const player = scene.getChild('Player');
            if (player && player._invincible <= 0) {
                const pb = player.getWorldBounds();
                const eb = this.getWorldBounds();
                if (pb.x < eb.right && pb.right > eb.x && pb.y < eb.bottom && pb.bottom > eb.y) {
                    if (player.velocity.y > 0 && pb.bottom < eb.y + 6) {
                        player.velocity.y = -250;
                        gs.score += 200;
                        self.engine.shake(3);
                        self.engine.freeze(40);
                        self.engine.audio.sfxHit();
                        this.destroy();
                    } else { player._hurt(); }
                }
            }
        };

        scene.addChild(enemy);
    }

    _createBullet(scene, x, y, dir) {
        const gs = this.gameState;
        const self = this;
        const bullet = new Node('Bullet');
        bullet.position = { x, y };
        bullet._dir = dir;
        bullet._life = 0.8;

        bullet.draw = function(ctx) {
            ctx.fillStyle = 'rgba(68, 255, 255, 0.4)';
            ctx.beginPath(); ctx.arc(4, 3, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#88ffff';
            ctx.fillRect(0, 1, 8, 4);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(1, 2, 6, 2);
        };

        bullet.update = function(dt) {
            this.position.x += this._dir * 350 * dt;
            this._life -= dt;
            if (this._life <= 0) { this.destroy(); return; }

            const enemies = scene.findByTag('enemy');
            for (const e of enemies) {
                if (e._destroyed) continue;
                if (Math.abs(this.position.x - e.position.x) < 14 && Math.abs(this.position.y - e.position.y) < 14) {
                    if (e.tags.has('boss')) {
                        e._hp--;
                        e._hurtTimer = 0.3;
                        const hpBar = scene.getChild('BossHP');
                        if (hpBar) hpBar.value = e._hp;
                        self.engine.shake(5);
                        self.engine.freeze(50);
                        gs.score += 200;
                        if (e._hp <= 0) {
                            self.engine.audio.sfxExplosion();
                            e.destroy();
                            if (hpBar) hpBar.destroy();
                            setTimeout(() => {
                                gs.state = 'victory';
                                self.music.stopSong();
                                self.engine.switchScene('victory', 'fade');
                            }, 1500);
                        }
                    } else {
                        gs.score += 150;
                        self.engine.audio.sfxHit();
                        e.destroy();
                    }
                    this.destroy();
                    return;
                }
            }
        };

        scene.addChild(bullet);
    }

    _createBoss(scene, x, y) {
        const gs = this.gameState;
        const self = this;
        const boss = new PhysicsBody('Boss');
        boss.position = { x, y };
        boss.gravity = 600;
        boss.collider = { x: 4, y: 4, width: 24, height: 28 };
        boss.tags.add('enemy');
        boss.tags.add('boss');
        boss._hp = 5;
        boss._dir = 1;
        boss._timer = 2;
        boss._hurtTimer = 0;

        // Simple boss visual (big red square with eyes)
        boss.draw = function(ctx) {
            const pulse = Math.sin(Date.now() * 0.003);
            ctx.fillStyle = this._hurtTimer > 0 ? '#ffffff' : '#cc2244';
            ctx.fillRect(0, 0, 32, 32);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(6, 8, 6, 6);
            ctx.fillRect(20, 8, 6, 6);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(8, 10, 3, 3);
            ctx.fillRect(22, 10, 3, 3);
            ctx.fillStyle = '#880022';
            ctx.fillRect(10, 20, 12, 4);
        };

        const hpBar = new HealthBar('BossHP');
        hpBar.position = { x: 160, y: 250 };
        hpBar.width = 160;
        hpBar.height = 8;
        hpBar.maxValue = 5;
        hpBar.value = 5;
        hpBar.fillColor = '#cc2244';
        hpBar.showText = false;
        hpBar.visible = false;
        scene.addChild(hpBar);

        boss.update = function(dt) {
            if (gs.state !== 'playing') return;
            this._timer -= dt;
            this._hurtTimer -= dt;

            const p = scene.getChild('Player');
            if (p && p.position.x > this.position.x - 200) hpBar.visible = true;

            if (this._timer <= 0) {
                this._dir *= -1;
                this._timer = 1.5 + Math.random();
            }
            this.velocity.x = this._dir * 80;

            if (p && p._invincible <= 0) {
                const pb = p.getWorldBounds();
                const bb = this.getWorldBounds();
                if (pb.x < bb.right && pb.right > bb.x && pb.y < bb.bottom && pb.bottom > bb.y) {
                    if (p.velocity.y > 0 && pb.bottom < bb.y + 10) {
                        p.velocity.y = -300;
                        this._hp--;
                        hpBar.value = this._hp;
                        this._hurtTimer = 0.5;
                        self.engine.shake(8);
                        self.engine.freeze(80);
                        self.engine.audio.sfxHit();
                        gs.score += 500;
                        if (this._hp <= 0) {
                            self.engine.audio.sfxExplosion();
                            this.destroy();
                            hpBar.destroy();
                            setTimeout(() => {
                                gs.state = 'victory';
                                self.music.stopSong();
                                self.engine.switchScene('victory', 'fade');
                            }, 1500);
                        }
                    } else { p._hurt(); }
                }
            }
        };

        scene.addChild(boss);
    }

    // =============================================
    //  SCREENS
    // =============================================
    _buildTitleScreen() {
        const scene = new Scene('TitleScreen');
        const gs = this.gameState;
        const self = this;
        const colors = this._getMoodColors();
        scene.backgroundColor = colors.skyTop;

        const bg = new ParallaxLayer('BG', 'bg', 0);
        bg.autoScrollX = -5;
        scene.addChild(bg);

        const title = new TextNode('Title', this.config.title.toUpperCase());
        title.position = { x: 240, y: 80 };
        title.font = 'bold 28px monospace';
        title.color = colors.titleColor;
        title.align = 'center';
        title.shadow = { color: '#000', offsetX: 2, offsetY: 2 };
        scene.addChild(title);

        const sub = new TextNode('Sub', this.config.story);
        sub.position = { x: 240, y: 120 };
        sub.font = '11px monospace';
        sub.color = '#aa88cc';
        sub.align = 'center';
        scene.addChild(sub);

        const start = new TextNode('Start', 'PRESS SPACE OR START');
        start.position = { x: 240, y: 195 };
        start.font = '11px monospace';
        start.color = '#ffffff';
        start.align = 'center';
        scene.addChild(start);

        const controls = new TextNode('Ctrl', `Arrows/WASD + Space${this.config.hasGun ? ' | X to shoot' : ''} | Gamepad`);
        controls.position = { x: 240, y: 245 };
        controls.font = '8px monospace';
        controls.color = '#555577';
        controls.align = 'center';
        scene.addChild(controls);

        let blink = 0;
        scene.update = function(dt) {
            blink += dt;
            start.visible = Math.floor(blink * 2) % 2 === 0;

            if (self.engine.input.isKeyDown('Space') || self.engine.input.isKeyDown('Enter') || self.engine.input.isKeyDown('gamepad_a')) {
                self.engine.audio.sfxSelect();
                gs.lives = self.diffMod.lives;
                gs.score = 0;
                gs.coins = 0;
                gs.level = 1;
                gs.state = 'playing';
                self.music.stopSong();
                self.engine.switchScene('level1', 'fade');
                self.music.playSong(MusicEngine.SONGS.adventure);
            }
        };

        scene.signals.on('entered', () => {
            self.engine.camera.position = { x: 240, y: 135 };
            self.engine.camera.setZoom(1, true);
            self.engine.camera.target = null;
            self.engine.camera.bounds = null;
        });

        this.engine.addScene('title', scene);
    }

    _buildGameOverScreen() {
        const gs = this.gameState;
        const self = this;
        const scene = new Scene('GameOver');
        scene.backgroundColor = '#0a0408';

        const title = new TextNode('T', 'GAME OVER');
        title.position = { x: 240, y: 100 };
        title.font = 'bold 28px monospace';
        title.color = '#ff2244';
        title.align = 'center';
        scene.addChild(title);

        const scoreText = new TextNode('S', '');
        scoreText.position = { x: 240, y: 150 };
        scoreText.font = '14px monospace';
        scoreText.color = '#ffcc00';
        scoreText.align = 'center';
        scene.addChild(scoreText);

        const retry = new TextNode('R', 'PRESS SPACE TO RETRY');
        retry.position = { x: 240, y: 200 };
        retry.font = '11px monospace';
        retry.color = '#ffffff';
        retry.align = 'center';
        scene.addChild(retry);

        let blink = 0;
        scene.update = function(dt) {
            blink += dt;
            retry.visible = Math.floor(blink * 2) % 2 === 0;
            scoreText.text = 'SCORE: ' + gs.score;
            if (self.engine.input.isKeyDown('Space') || self.engine.input.isKeyDown('gamepad_a')) {
                self.engine.switchScene('title', 'fade');
            }
        };

        scene.signals.on('entered', () => {
            self.engine.camera.position = { x: 240, y: 135 };
            self.engine.camera.setZoom(1, true);
            self.engine.camera.target = null;
        });

        this.engine.addScene('gameover', scene);
    }

    _buildVictoryScreen() {
        const gs = this.gameState;
        const self = this;
        const scene = new Scene('Victory');
        scene.backgroundColor = '#040820';

        const title = new TextNode('T', 'YOU WIN!');
        title.position = { x: 240, y: 80 };
        title.font = 'bold 24px monospace';
        title.color = '#44ff88';
        title.align = 'center';
        scene.addChild(title);

        const scoreText = new TextNode('S', '');
        scoreText.position = { x: 240, y: 140 };
        scoreText.font = '16px monospace';
        scoreText.color = '#ffcc00';
        scoreText.align = 'center';
        scene.addChild(scoreText);

        const retry = new TextNode('R', 'PRESS SPACE FOR TITLE');
        retry.position = { x: 240, y: 210 };
        retry.font = '10px monospace';
        retry.color = '#ffffff';
        retry.align = 'center';
        scene.addChild(retry);

        let blink = 0;
        scene.update = function(dt) {
            blink += dt;
            retry.visible = Math.floor(blink * 2) % 2 === 0;
            scoreText.text = 'SCORE: ' + gs.score + '  COINS: ' + gs.coins;
            if (self.engine.input.isKeyDown('Space') || self.engine.input.isKeyDown('gamepad_a')) {
                self.engine.switchScene('title', 'fade');
            }
        };

        scene.signals.on('entered', () => {
            self.engine.camera.position = { x: 240, y: 135 };
            self.engine.camera.setZoom(1, true);
            self.engine.camera.target = null;
        });

        this.engine.addScene('victory', scene);
    }

    _addHUD(scene, levelNum) {
        const gs = this.gameState;
        const h1 = new TextNode('HL');
        h1.font = '10px monospace'; h1.color = '#ff6633';
        h1.position = { x: 8, y: 8 };
        h1.shadow = { color: '#000', offsetX: 1, offsetY: 1 };
        scene.addChild(h1);

        const h2 = new TextNode('HS');
        h2.font = '10px monospace'; h2.color = '#ffcc00';
        h2.position = { x: 8, y: 20 };
        h2.shadow = { color: '#000', offsetX: 1, offsetY: 1 };
        scene.addChild(h2);

        const h3 = new TextNode('HC');
        h3.font = '10px monospace'; h3.color = '#44ffff';
        h3.position = { x: 350, y: 8 };
        h3.shadow = { color: '#000', offsetX: 1, offsetY: 1 };
        scene.addChild(h3);

        scene.update = function(dt) {
            h1.text = 'LIVES: ' + '♥'.repeat(Math.max(0, gs.lives));
            h2.text = 'SCORE: ' + gs.score;
            h3.text = 'COINS: ' + gs.coins;
        };
    }

    // =============================================
    //  HELPERS
    // =============================================
    _findSafeZones(gaps, mapW, groundRow) {
        const zones = [];
        let start = 1;
        const sortedGaps = [...gaps].sort((a, b) => a.col - b.col);
        for (const gap of sortedGaps) {
            if (gap.col > start + 2) {
                zones.push({ start, end: gap.col, width: gap.col - start });
            }
            start = gap.col + gap.width;
        }
        if (start < mapW - 2) zones.push({ start, end: mapW - 1, width: mapW - 1 - start });
        return zones;
    }

    _getMoodColors() {
        const moods = {
            action: {
                player: '#ff6633', playerAccent: '#ffcc00',
                enemy: '#44cc44', enemyFlyer: '#9944cc',
                tileSurface: '#665588', tileSurfaceTop: '#8866aa', tileFill: '#443366',
                tileAlt: '#556677', tileAltTop: '#667788', tileAltFill: '#445566',
                skyTop: '#080818', skyBottom: '#1a1030', mountain: '#2a1844',
                titleColor: '#ffcc00'
            },
            chill: {
                player: '#44aaff', playerAccent: '#88ddff',
                enemy: '#ff8844', enemyFlyer: '#ffaa44',
                tileSurface: '#55aa55', tileSurfaceTop: '#66cc66', tileFill: '#448844',
                tileAlt: '#88aa66', tileAltTop: '#99bb77', tileAltFill: '#779955',
                skyTop: '#2244aa', skyBottom: '#4488cc', mountain: '#336644',
                titleColor: '#88ddff'
            },
            dark: {
                player: '#cccccc', playerAccent: '#ffffff',
                enemy: '#cc2222', enemyFlyer: '#882222',
                tileSurface: '#333333', tileSurfaceTop: '#444444', tileFill: '#222222',
                tileAlt: '#2a2a2a', tileAltTop: '#3a3a3a', tileAltFill: '#1a1a1a',
                skyTop: '#050508', skyBottom: '#0a0a10', mountain: '#111115',
                titleColor: '#cc4444'
            },
            funny: {
                player: '#ff44aa', playerAccent: '#ffcc00',
                enemy: '#44ff44', enemyFlyer: '#44ccff',
                tileSurface: '#cc8844', tileSurfaceTop: '#ddaa55', tileFill: '#aa6622',
                tileAlt: '#cc66aa', tileAltTop: '#dd88bb', tileAltFill: '#aa4488',
                skyTop: '#220044', skyBottom: '#440066', mountain: '#330055',
                titleColor: '#ff66cc'
            }
        };
        return moods[this.config.mood] || moods.action;
    }

    _createCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').imageSmoothingEnabled = false;
        return c;
    }

    _canvasToImage(canvas, name) {
        const img = new Image();
        img.src = canvas.toDataURL();
        this.engine.assets.images[name] = img;
    }

    _drawCharacter(ctx, ox, oy, frame, color, accent, running = false, pose = null) {
        const bob = [0, -1, 0, 1][frame % 4];
        // Head
        ctx.fillStyle = '#ddeeff';
        ctx.fillRect(ox + 4, oy + 1 + bob, 8, 7);
        ctx.fillStyle = '#44bbff';
        ctx.fillRect(ox + 6, oy + 3 + bob, 4, 3);
        // Body
        ctx.fillStyle = color;
        ctx.fillRect(ox + 4, oy + 8 + bob, 8, 7);
        // Belt
        ctx.fillStyle = accent;
        ctx.fillRect(ox + 4, oy + 11 + bob, 8, 2);
        // Legs
        const legOff = running ? [0, 2, 0, -2][frame % 4] : 0;
        ctx.fillStyle = color;
        ctx.fillRect(ox + 4, oy + 15 + bob + legOff, 3, 5);
        ctx.fillRect(ox + 9, oy + 15 + bob - legOff, 3, 5);
        // Boots
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox + 3, oy + 19 + bob + legOff, 4, 3);
        ctx.fillRect(ox + 9, oy + 19 + bob - legOff, 4, 3);
    }

    _drawEnemy(ctx, ox, oy, frame, color) {
        const bob = Math.sin(frame * Math.PI / 2);
        ctx.fillStyle = color;
        ctx.fillRect(ox + 3, oy + 3 + bob, 10, 8);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(ox + 4, oy + 4 + bob, 3, 3);
        ctx.fillRect(ox + 9, oy + 4 + bob, 3, 3);
        ctx.fillStyle = color;
        ctx.fillRect(ox + 4, oy + 11 + bob, 3, 4);
        ctx.fillRect(ox + 9, oy + 11 + bob, 3, 4);
    }

    _drawFlyer(ctx, ox, oy, frame, color) {
        ctx.fillStyle = color;
        ctx.fillRect(ox + 3, oy + 6, 10, 5);
        ctx.fillStyle = color;
        ctx.fillRect(ox + 5, oy + 3, 6, 4);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(ox + 7, oy + 4, 2, 2);
        const wy = [0, -1, 1][frame];
        ctx.fillRect(ox, oy + 7 + wy, 4, 3);
        ctx.fillRect(ox + 12, oy + 7 - wy, 4, 3);
    }
}

window.GameGenerator = GameGenerator;
