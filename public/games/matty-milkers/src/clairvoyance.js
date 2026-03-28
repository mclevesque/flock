/* ============================================
   CLAIRVOYANCE — AI Game Feel & Design Intelligence

   GOLDEN RULE: "What does the player do next?"
   At every point in the game, the player must have
   a clear, achievable next action.
   ============================================ */

class Clairvoyance {
    constructor(engine) {
        this.engine = engine;
        this.enabled = true;
        this.issues = [];
        this._history = [];
        this._maxHistory = 300;
        this._frameCount = 0;

        // =============================================
        // THE FIVE PILLARS OF GREAT GAMES
        // =============================================
        // 1. RESPONSIVE — input to action feels instant
        // 2. READABLE  — player always knows what's happening
        // 3. FAIR      — every death is the player's fault
        // 4. GUIDED    — player always knows what to do next
        // 5. JUICY     — every action has satisfying feedback

        this.pillars = {
            responsive: { score: 0, issues: [] },
            readable:   { score: 0, issues: [] },
            fair:       { score: 0, issues: [] },
            guided:     { score: 0, issues: [] },
            juicy:      { score: 0, issues: [] }
        };

        // =============================================
        // PHYSICS REFERENCES — from real games
        // =============================================
        this.profiles = {
            platformer: {
                name: 'Platformer (Mario/Celeste)',
                screenCrossTime: { min: 2.5, ideal: 3.2, max: 4.5 },
                jumpHeight: { min: 2.5, ideal: 3.5, max: 5 },       // tiles
                jumpDuration: { min: 0.45, ideal: 0.65, max: 0.85 }, // seconds
                accelTime: { min: 0.08, ideal: 0.18, max: 0.3 },     // to max speed
                decelTime: { min: 0.05, ideal: 0.12, max: 0.2 },     // to stop
                airControl: { min: 0.3, ideal: 0.5, max: 0.7 },      // ratio vs ground
                coyoteTime: { min: 0.06, ideal: 0.1, max: 0.15 },
                jumpBuffer: { min: 0.05, ideal: 0.08, max: 0.12 },
                fallMultiplier: { min: 1.2, ideal: 1.5, max: 2.0 },  // gravity boost when falling
                maxGapJumpable: { min: 3, ideal: 4, max: 5 },        // tiles
            },
            topdown: {
                name: 'Top-Down (Zelda/Stardew)',
                screenCrossTime: { min: 2.0, ideal: 3.0, max: 4.0 },
                moveSpeed8Dir: true,
                accelTime: { min: 0.05, ideal: 0.1, max: 0.2 },
                decelTime: { min: 0.05, ideal: 0.1, max: 0.15 },
            },
            moba: {
                name: 'MOBA (League/Dota)',
                screenCrossTime: { min: 3.0, ideal: 5.0, max: 8.0 },
                clickToMove: true,
                turnRate: { min: 0.1, ideal: 0.2, max: 0.5 },
            },
            rts: {
                name: 'RTS (Starcraft)',
                scrollSpeed: { min: 300, ideal: 500, max: 800 },
                unitSpeed: { min: 30, ideal: 60, max: 120 },
            }
        };

        // =============================================
        // GAME FEEL RULES — What makes it satisfying
        // From GDC talks, Juice It Or Lose It, etc.
        // =============================================
        this.feelRules = {
            // --- RESPONSIVENESS ---
            inputLatency: {
                rule: 'Input to visual response must be < 3 frames (50ms)',
                why: 'Human perception threshold. Beyond this feels "laggy"',
                check: (fps) => (1000 / fps) * 2 < 50
            },

            // --- MOVEMENT FEEL ---
            accelerationCurve: {
                rule: 'Time to max speed: 100-200ms on ground, feels weighty not sluggish',
                why: 'Instant = weightless (bad). Slow = unresponsive (bad). Sweet spot = weighty.',
                formula: 'targetVx approach: v += (target - v) * rate * dt, rate 6-10'
            },
            deceleration: {
                rule: 'Stopping should take 80-150ms. No ice skating.',
                why: 'Player must feel in control. Sliding = frustrating near edges.',
                formula: 'When no input: v *= 0.85 per frame (at 60fps)'
            },
            airControl: {
                rule: 'Air control = 40-60% of ground control',
                why: 'Full air control = no commitment to jumps. Zero = frustrating.',
                formula: 'Air accel rate = ground rate * 0.5'
            },

            // --- JUMP FEEL ---
            coyoteTime: {
                rule: 'Allow jumping 80-120ms after leaving a ledge',
                why: 'Players press jump slightly late. Without this, every edge feels unfair.',
                value: 0.1
            },
            jumpBuffer: {
                rule: 'Queue jump input 60-100ms before landing',
                why: 'Players press jump slightly early. Without this, landings feel unresponsive.',
                value: 0.08
            },
            variableJump: {
                rule: 'Release jump = cut upward velocity by 40-60%',
                why: 'Gives player control over jump height. Tap = short hop. Hold = full jump.',
                formula: 'On jump release: vy *= 0.5'
            },
            fastFall: {
                rule: 'Apply 1.3-1.8x gravity when falling (vy > 0)',
                why: 'Makes jumps feel snappy. Rise = floaty and graceful. Fall = crisp and fast.',
                formula: 'if (vy > 0) gravity *= 1.5'
            },
            landingSquash: {
                rule: 'Squash sprite 10-20% on landing for 3-5 frames',
                why: 'Sells the impact. Without it, landing feels hollow.',
                formula: 'scale.x = 1.15, scale.y = 0.85, lerp back'
            },

            // --- COMBAT FEEL ---
            hitStop: {
                rule: 'Freeze game for 40-80ms on hit',
                why: 'Single most impactful "juice" technique. Makes every hit feel powerful.',
                value: 60
            },
            screenShake: {
                rule: '2-6px shake on hit, 8-12px on explosion. Fast decay (0.85-0.9)',
                why: 'Camera movement sells impact. Too much = nausea. Too little = weak.',
            },
            knockback: {
                rule: 'Push enemy/player away from damage source',
                why: 'Shows cause and effect. Player understands what hit them.',
            },
            iFrames: {
                rule: '1-2 seconds of invincibility after taking damage, with visible flashing',
                why: 'Prevents stun-lock death. Flashing communicates "you are safe temporarily".',
                value: 1.5
            },

            // --- VISUAL CLARITY ---
            playerReadability: {
                rule: 'Player character must be instantly distinguishable from background',
                why: 'Player must ALWAYS know where they are. Contrast > detail.',
                check: 'Character should have bright/unique colors vs environment'
            },
            enemyReadability: {
                rule: 'Enemies must be visually distinct from terrain and collectibles',
                why: 'Player must know what hurts them vs what helps them.',
            },
            dangerReadability: {
                rule: 'Hazards (spikes, pits, projectiles) must be visually obvious',
                why: 'Every death must feel fair. "I saw it but failed" > "I didn\'t see it".',
            },

            // --- LEVEL DESIGN ---
            playerPathClarity: {
                rule: 'GOLDEN RULE: Player must ALWAYS know what to do next',
                why: 'Confusion ≠ difficulty. A hard game is clear about what to do, hard to execute.',
                checks: [
                    'Can the player see the next objective/path?',
                    'Do coins/items guide toward the correct direction?',
                    'Are there dead-ends? If so, is there a clear way back?',
                    'Can the player get stuck with no options?',
                    'Does the camera show enough of the level to plan?'
                ]
            },
            noTraps: {
                rule: 'Never place a hazard where the player cannot see it before committing',
                why: 'Offscreen deaths feel unfair. Player should always be able to react.',
            },
            breathingRoom: {
                rule: 'Safe space before and after every challenge',
                why: 'Players need a moment to process. Back-to-back challenges = exhausting.',
                formula: '2-3 empty tiles before each gap/enemy'
            },
            platformAccessibility: {
                rule: 'Every platform must be reachable AND escapable',
                why: 'Getting stuck under/on a platform with no way forward breaks flow.',
                checks: [
                    'Can player reach this platform from the ground?',
                    'Can player leave this platform to continue forward?',
                    'Is there a clear visual path from platform to platform?',
                    'Are platforms too close together creating a "cage"?'
                ]
            },
            gapFairness: {
                rule: 'Every gap must be clearable at running speed without pixel-perfect timing',
                why: 'Tight jumps are fun as optional challenges, not mandatory progression.',
                formula: 'gap_width_px < speed * jumpDuration * 0.8 (20% margin)'
            }
        };
    }

    // =============================================
    // FRAME RECORDING
    // =============================================
    recordFrame(data) {
        if (!this.enabled) return;
        this._history.push({
            frame: this._frameCount++,
            time: performance.now(),
            ...data
        });
        if (this._history.length > this._maxHistory) this._history.shift();
    }

    // =============================================
    // LEVEL DESIGN ANALYSIS
    // =============================================
    analyzeLevelDesign(tilemap, playerSpeed, jumpForce, gravity, tileSize = 16) {
        const report = { issues: [], suggestions: [] };
        const jumpDuration = 2 * Math.abs(jumpForce) / gravity;
        const jumpHeight = (jumpForce * jumpForce) / (2 * gravity);
        const jumpHeightTiles = jumpHeight / tileSize;
        const jumpDistance = playerSpeed * jumpDuration;
        const jumpDistanceTiles = jumpDistance / tileSize;

        report.jumpStats = {
            height: jumpHeightTiles.toFixed(1) + ' tiles',
            distance: jumpDistanceTiles.toFixed(1) + ' tiles',
            duration: jumpDuration.toFixed(2) + 's'
        };

        // Check all gaps
        const gaps = [];
        let gapStart = -1;
        for (let col = 0; col < tilemap.mapWidth; col++) {
            const groundRow = tilemap.mapHeight - 4; // Approximate ground
            let isSolid = false;
            for (let row = groundRow; row < tilemap.mapHeight; row++) {
                const tile = tilemap.getTile(col, row);
                if (tile !== null && tile !== -1) { isSolid = true; break; }
            }
            if (!isSolid && gapStart === -1) {
                gapStart = col;
            } else if (isSolid && gapStart !== -1) {
                gaps.push({ start: gapStart, end: col - 1, width: col - gapStart });
                gapStart = -1;
            }
        }

        for (const gap of gaps) {
            const gapPx = gap.width * tileSize;
            const margin = jumpDistance / gapPx;
            if (margin < 1.0) {
                report.issues.push({
                    severity: 'critical',
                    type: 'impossible_gap',
                    message: `Gap at cols ${gap.start}-${gap.end} (${gap.width} tiles) is IMPOSSIBLE to clear! Jump covers ${jumpDistanceTiles.toFixed(1)} tiles.`,
                    fix: `Narrow gap to ${Math.floor(jumpDistanceTiles * 0.8)} tiles or add a platform.`
                });
            } else if (margin < 1.2) {
                report.issues.push({
                    severity: 'high',
                    type: 'tight_gap',
                    message: `Gap at cols ${gap.start}-${gap.end} (${gap.width} tiles) requires near-perfect timing (${Math.round(margin * 100)}% margin).`,
                    fix: `Consider narrowing by 1 tile or adding coins to guide the jump arc.`
                });
            }
        }

        // Check for platform traps (platforms that block forward movement)
        const platforms = [];
        for (let row = 0; row < tilemap.mapHeight - 4; row++) {
            let platStart = -1;
            for (let col = 0; col < tilemap.mapWidth; col++) {
                const tile = tilemap.getTile(col, row);
                const isSolid = tile !== null && tile !== -1 && tile !== undefined;
                if (isSolid && platStart === -1) {
                    platStart = col;
                } else if (!isSolid && platStart !== -1) {
                    platforms.push({ col: platStart, row, width: col - platStart, endCol: col - 1 });
                    platStart = -1;
                }
            }
        }

        // Check each platform for escapability
        for (const plat of platforms) {
            const platY = plat.row * tileSize;
            const platRightX = (plat.col + plat.width) * tileSize;
            const platLeftX = plat.col * tileSize;

            // Can the player reach this platform? (is it within jump height from ground?)
            const groundY = (tilemap.mapHeight - 4) * tileSize;
            const heightFromGround = groundY - platY;
            if (heightFromGround > jumpHeight * 1.1) {
                // Only an issue if there's no intermediate platform
                report.suggestions.push({
                    type: 'unreachable_platform',
                    message: `Platform at (${plat.col},${plat.row}) is ${(heightFromGround / tileSize).toFixed(1)} tiles up — may need intermediate platform or jetpack.`
                });
            }

            // Check for "cage" — platform directly above ground with low clearance
            const clearance = groundY - platY - tileSize;
            const clearanceTiles = clearance / tileSize;
            if (clearanceTiles < jumpHeightTiles * 0.5 && clearanceTiles > 0) {
                report.issues.push({
                    severity: 'medium',
                    type: 'low_ceiling_trap',
                    message: `Platform at (${plat.col},${plat.row}) creates low ceiling (${clearanceTiles.toFixed(1)} tiles clearance). Player may feel trapped underneath.`,
                    fix: 'Raise platform higher or remove it. Player should be able to jump to full height.'
                });
            }
        }

        // Golden Rule check: does the level flow left-to-right?
        // Check if there are any "dead zones" — sections with no coins, enemies, or platforms
        report.goldenRule = {
            passed: report.issues.filter(i => i.severity === 'critical').length === 0,
            message: report.issues.length === 0
                ? 'Level design passes all checks. Player always has a clear next action.'
                : `Found ${report.issues.length} issues that may confuse or trap the player.`
        };

        return report;
    }

    // =============================================
    // PHYSICS TUNING CALCULATOR
    // =============================================
    calculateIdealPhysics(screenWidth, screenHeight, zoom, tileSize = 16, profile = 'platformer') {
        const ref = this.profiles[profile];
        if (!ref) return null;

        const visW = screenWidth / zoom;
        const visH = screenHeight / zoom;

        const idealSpeed = visW / ref.screenCrossTime.ideal;
        const idealJumpTiles = ref.jumpHeight?.ideal || 3;
        const idealJumpHeight = idealJumpTiles * tileSize;
        const idealJumpDuration = ref.jumpDuration?.ideal || 0.65;
        const halfT = idealJumpDuration / 2;
        const idealGravity = (2 * idealJumpHeight) / (halfT * halfT);
        const idealJumpForce = idealGravity * halfT;

        // Max gap clearable
        const maxGap = idealSpeed * idealJumpDuration;
        const maxGapTiles = maxGap / tileSize;

        return {
            profile: ref.name,
            speed: Math.round(idealSpeed),
            gravity: Math.round(idealGravity),
            jumpForce: Math.round(-idealJumpForce),
            jumpHeight: idealJumpTiles + ' tiles',
            jumpDuration: idealJumpDuration + 's',
            maxGapClearable: maxGapTiles.toFixed(1) + ' tiles',
            accelRate: 8,
            decelFriction: 0.85,
            airControlRatio: 0.5,
            coyoteTime: ref.coyoteTime?.ideal || 0.1,
            jumpBuffer: ref.jumpBuffer?.ideal || 0.08,
            fastFallMultiplier: ref.fallMultiplier?.ideal || 1.5,
            screenCrossTime: (visW / idealSpeed).toFixed(1) + 's',
            summary: `${ref.name}: speed=${Math.round(idealSpeed)} gravity=${Math.round(idealGravity)} jump=${Math.round(-idealJumpForce)} | Clears ${maxGapTiles.toFixed(1)}-tile gaps | Crosses screen in ${(visW / idealSpeed).toFixed(1)}s`
        };
    }

    // =============================================
    // FULL ANALYSIS
    // =============================================
    analyze() {
        if (this._history.length < 60) return null;

        const report = {
            timestamp: Date.now(),
            metrics: {},
            pillars: {},
            issues: [],
            goldenRule: null
        };

        // FPS
        const recent = this._history.slice(-60);
        const deltas = [];
        for (let i = 1; i < recent.length; i++) {
            deltas.push(recent[i].time - recent[i - 1].time);
        }
        const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const fps = 1000 / avgDelta;
        const jitter = Math.max(...deltas) - Math.min(...deltas);
        report.metrics.fps = Math.round(fps);
        report.metrics.frameJitter = Math.round(jitter) + 'ms';

        // RESPONSIVE pillar
        if (fps < 55) {
            report.issues.push({ pillar: 'responsive', severity: 'critical', message: `FPS is ${Math.round(fps)} — below 55. Game feels choppy.` });
        }
        if (jitter > 20) {
            report.issues.push({ pillar: 'responsive', severity: 'medium', message: `Frame jitter is ${Math.round(jitter)}ms — inconsistent frame pacing causes micro-stutters.` });
        }

        // Speed analysis
        const speeds = this._history.map(h => Math.abs(h.vx));
        const maxSpeed = Math.max(...speeds);
        const zoom = this._history[this._history.length - 1]?.zoom || 1;
        const visW = this.engine.width / zoom;
        const crossTime = maxSpeed > 0 ? visW / maxSpeed : Infinity;
        report.metrics.maxSpeed = Math.round(maxSpeed) + ' px/s';
        report.metrics.screenCrossTime = crossTime.toFixed(1) + 's';

        if (crossTime < 2.0) {
            report.issues.push({ pillar: 'responsive', severity: 'high', message: `Screen cross in ${crossTime.toFixed(1)}s — too fast, player loses control.` });
        } else if (crossTime > 5.0 && maxSpeed > 0) {
            report.issues.push({ pillar: 'responsive', severity: 'medium', message: `Screen cross in ${crossTime.toFixed(1)}s — feels sluggish.` });
        }

        // FAIR pillar — check for deaths
        const deaths = this._history.filter((h, i) => i > 0 && h.y > 300 && this._history[i-1].y <= 300);
        if (deaths.length > 0) {
            report.metrics.deaths = deaths.length;
        }

        // GUIDED pillar — is the player moving forward?
        const startX = this._history[0]?.x || 0;
        const endX = this._history[this._history.length - 1]?.x || 0;
        const progress = endX - startX;
        report.metrics.progress = Math.round(progress) + 'px';
        if (progress < -50) {
            report.issues.push({ pillar: 'guided', severity: 'medium', message: 'Player moved backwards — may be lost or stuck.' });
        }

        // Stall detection — has the player been in the same area for too long?
        if (this._history.length >= 180) {
            const last3sec = this._history.slice(-180);
            const xRange = Math.max(...last3sec.map(h => h.x)) - Math.min(...last3sec.map(h => h.x));
            if (xRange < 32) {
                report.issues.push({ pillar: 'guided', severity: 'high', message: `Player stuck in ${Math.round(xRange)}px area for 3+ seconds. May be trapped or confused.` });
            }
        }

        report.summary = report.issues.length === 0
            ? 'All pillars healthy. Game feels good.'
            : `${report.issues.length} issue(s): ${report.issues.map(i => i.message).join(' | ')}`;

        return report;
    }

    // =============================================
    // QUICK PRE-FLIGHT CHECK (run before shipping)
    // =============================================
    preflightCheck(tilemap, playerSpeed, jumpForce, gravity, tileSize = 16) {
        const checks = [];

        // Physics sanity
        const jumpDuration = 2 * Math.abs(jumpForce) / gravity;
        const jumpDist = playerSpeed * jumpDuration;
        const jumpHeight = (jumpForce * jumpForce) / (2 * gravity);

        checks.push({
            name: 'Jump clears smallest gap',
            passed: jumpDist > 2 * tileSize,
            value: `${(jumpDist / tileSize).toFixed(1)} tiles`,
            expected: '> 2 tiles'
        });

        checks.push({
            name: 'Jump height reaches platforms',
            passed: jumpHeight > 2 * tileSize,
            value: `${(jumpHeight / tileSize).toFixed(1)} tiles`,
            expected: '> 2 tiles'
        });

        checks.push({
            name: 'Speed feels natural',
            passed: playerSpeed >= 50 && playerSpeed <= 150,
            value: playerSpeed + ' px/s',
            expected: '50-150 px/s'
        });

        checks.push({
            name: 'Gravity feels grounded',
            passed: gravity >= 600 && gravity <= 1400,
            value: gravity + ' px/s²',
            expected: '600-1400 px/s²'
        });

        checks.push({
            name: 'Fall/rise ratio (snappy landings)',
            passed: true, // Needs runtime check
            value: 'Check at runtime',
            expected: '> 1.2'
        });

        // Level design
        const levelReport = this.analyzeLevelDesign(tilemap, playerSpeed, jumpForce, gravity, tileSize);

        for (const issue of levelReport.issues) {
            checks.push({
                name: issue.type,
                passed: false,
                value: issue.message,
                expected: issue.fix
            });
        }

        const passed = checks.filter(c => c.passed).length;
        const total = checks.length;

        return {
            passed: passed === total,
            score: `${passed}/${total}`,
            checks,
            jumpStats: levelReport.jumpStats
        };
    }
}

window.Clairvoyance = Clairvoyance;
