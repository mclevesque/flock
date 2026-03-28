/* ============================================
   PROCEDURAL LEVEL GENERATION
   Platformer, dungeon, top-down, isometric
   ============================================ */

class LevelGenerator {
    constructor() {
        this.seed = Date.now();
    }

    // Seeded random for reproducible levels
    _seededRandom() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }

    setSeed(seed) {
        this.seed = seed;
        return this;
    }

    // ---- PLATFORMER LEVEL ----
    generatePlatformer(tilemap, options = {}) {
        const surfaceTile = options.surfaceTile ?? 0;
        const fillTile = options.fillTile ?? 1;
        const groundRow = options.groundRow ?? Math.floor(tilemap.mapHeight * 0.75);
        const difficulty = options.difficulty ?? 0.5; // 0-1
        const density = options.platformDensity ?? 0.3;

        // Start with ground
        tilemap.addGround(groundRow, 0, tilemap.mapWidth - 1, surfaceTile, fillTile);

        // Safe starting zone (first 6 columns = flat ground)
        const safeZone = 6;

        // Carve gaps based on difficulty
        const minGap = 2;
        const maxGap = Math.floor(2 + difficulty * 3);
        let col = safeZone + 3;

        while (col < tilemap.mapWidth - 5) {
            if (this._seededRandom() < 0.3 + difficulty * 0.3) {
                const gapWidth = minGap + Math.floor(this._seededRandom() * (maxGap - minGap));
                tilemap.carveGap(groundRow, col, gapWidth);
                col += gapWidth + 3;
            } else {
                col += 2 + Math.floor(this._seededRandom() * 3);
            }
        }

        // Add platforms above ground
        col = safeZone;
        while (col < tilemap.mapWidth - 3) {
            if (this._seededRandom() < density) {
                const platWidth = 3 + Math.floor(this._seededRandom() * 4);
                const platRow = groundRow - 3 - Math.floor(this._seededRandom() * 6);
                if (platRow > 2) {
                    tilemap.addPlatform(platRow, col, platWidth, surfaceTile);
                }
            }
            col += 3 + Math.floor(this._seededRandom() * 4);
        }

        return tilemap;
    }

    // ---- DUNGEON (Top-down) ----
    generateDungeon(tilemap, options = {}) {
        const wallTile = options.wallTile ?? 2;
        const floorTile = options.floorTile ?? 3;
        const minRooms = options.minRooms ?? 5;
        const maxRooms = options.maxRooms ?? 12;
        const minRoomSize = options.minRoomSize ?? 4;
        const maxRoomSize = options.maxRoomSize ?? 8;

        // Fill with walls
        tilemap.fill(wallTile);

        const rooms = [];
        const roomCount = minRooms + Math.floor(this._seededRandom() * (maxRooms - minRooms));

        // Place rooms
        for (let i = 0; i < roomCount * 3; i++) {
            if (rooms.length >= roomCount) break;

            const w = minRoomSize + Math.floor(this._seededRandom() * (maxRoomSize - minRoomSize));
            const h = minRoomSize + Math.floor(this._seededRandom() * (maxRoomSize - minRoomSize));
            const x = 1 + Math.floor(this._seededRandom() * (tilemap.mapWidth - w - 2));
            const y = 1 + Math.floor(this._seededRandom() * (tilemap.mapHeight - h - 2));

            // Check overlap
            const overlaps = rooms.some(r =>
                x < r.x + r.w + 1 && x + w + 1 > r.x &&
                y < r.y + r.h + 1 && y + h + 1 > r.y
            );

            if (!overlaps) {
                rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
                tilemap.fillRect(floorTile, x, y, w, h);
            }
        }

        // Connect rooms with corridors
        for (let i = 1; i < rooms.length; i++) {
            const a = rooms[i - 1];
            const b = rooms[i];

            // L-shaped corridor
            if (this._seededRandom() > 0.5) {
                this._horizontalCorridor(tilemap, a.cx, b.cx, a.cy, floorTile);
                this._verticalCorridor(tilemap, a.cy, b.cy, b.cx, floorTile);
            } else {
                this._verticalCorridor(tilemap, a.cy, b.cy, a.cx, floorTile);
                this._horizontalCorridor(tilemap, a.cx, b.cx, b.cy, floorTile);
            }
        }

        // Set collision tiles (walls are solid)
        tilemap.collisionTiles = new Set([wallTile]);

        return { tilemap, rooms, startRoom: rooms[0], endRoom: rooms[rooms.length - 1] };
    }

    _horizontalCorridor(tilemap, x1, x2, y, tile) {
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);
        for (let x = start; x <= end; x++) {
            tilemap.setTile(x, y, tile);
            tilemap.setTile(x, y + 1, tile); // 2-wide corridor
        }
    }

    _verticalCorridor(tilemap, y1, y2, x, tile) {
        const start = Math.min(y1, y2);
        const end = Math.max(y1, y2);
        for (let y = start; y <= end; y++) {
            tilemap.setTile(x, y, tile);
            tilemap.setTile(x + 1, y, tile); // 2-wide corridor
        }
    }

    // ---- WAVE FUNCTION COLLAPSE (simple) ----
    // For more organic level generation
    generateWFC(tilemap, rules, options = {}) {
        const w = tilemap.mapWidth;
        const h = tilemap.mapHeight;

        // Initialize all cells as "any tile possible"
        const allTiles = Object.keys(rules);
        const grid = Array.from({ length: h }, () =>
            Array.from({ length: w }, () => [...allTiles])
        );

        const collapsed = Array.from({ length: h }, () => new Array(w).fill(false));

        const getEntropy = (col, row) => grid[row][col].length;

        const collapse = (col, row) => {
            const options = grid[row][col];
            if (options.length === 0) return false;
            const chosen = options[Math.floor(this._seededRandom() * options.length)];
            grid[row][col] = [chosen];
            collapsed[row][col] = true;
            tilemap.setTile(col, row, parseInt(chosen));
            return true;
        };

        const propagate = (col, row) => {
            const stack = [{ col, row }];
            while (stack.length > 0) {
                const { col: c, row: r } = stack.pop();
                const tile = grid[r][c][0];
                if (!tile) continue;
                const allowed = rules[tile] || {};

                const neighbors = [
                    { col: c - 1, row: r, dir: 'left' },
                    { col: c + 1, row: r, dir: 'right' },
                    { col: c, row: r - 1, dir: 'up' },
                    { col: c, row: r + 1, dir: 'down' },
                ];

                for (const n of neighbors) {
                    if (n.col < 0 || n.col >= w || n.row < 0 || n.row >= h) continue;
                    if (collapsed[n.row][n.col]) continue;

                    const validNeighbors = allowed[n.dir] || allTiles;
                    const before = grid[n.row][n.col].length;
                    grid[n.row][n.col] = grid[n.row][n.col].filter(t => validNeighbors.includes(t));

                    if (grid[n.row][n.col].length < before) {
                        if (grid[n.row][n.col].length === 1) {
                            collapsed[n.row][n.col] = true;
                            tilemap.setTile(n.col, n.row, parseInt(grid[n.row][n.col][0]));
                        }
                        stack.push(n);
                    }
                }
            }
        };

        // Collapse all cells
        let iterations = 0;
        while (iterations < w * h * 2) {
            iterations++;

            // Find lowest entropy uncollapsed cell
            let minEntropy = Infinity;
            let candidates = [];
            for (let r = 0; r < h; r++) {
                for (let c = 0; c < w; c++) {
                    if (collapsed[r][c]) continue;
                    const e = getEntropy(c, r);
                    if (e < minEntropy) {
                        minEntropy = e;
                        candidates = [{ col: c, row: r }];
                    } else if (e === minEntropy) {
                        candidates.push({ col: c, row: r });
                    }
                }
            }

            if (candidates.length === 0) break;

            const chosen = candidates[Math.floor(this._seededRandom() * candidates.length)];
            if (!collapse(chosen.col, chosen.row)) break;
            propagate(chosen.col, chosen.row);
        }

        return tilemap;
    }

    // ---- Spawn Point Generator ----
    generateSpawnPoints(tilemap, count, options = {}) {
        const minSpacing = options.minSpacing || 5;
        const mustBeOnSurface = options.onSurface !== false;
        const points = [];

        for (let attempt = 0; attempt < count * 20; attempt++) {
            if (points.length >= count) break;

            const col = Math.floor(this._seededRandom() * tilemap.mapWidth);
            let row;

            if (mustBeOnSurface) {
                // Find surface: first solid tile with empty above
                row = -1;
                for (let r = 0; r < tilemap.mapHeight; r++) {
                    const tile = tilemap.getTile(col, r);
                    const above = r > 0 ? tilemap.getTile(col, r - 1) : -1;
                    if (tile !== -1 && tile !== null && (above === -1 || above === null)) {
                        row = r - 1;
                        break;
                    }
                }
                if (row < 0) continue;
            } else {
                row = Math.floor(this._seededRandom() * tilemap.mapHeight);
            }

            // Check spacing
            const tooClose = points.some(p =>
                Math.abs(p.col - col) + Math.abs(p.row - row) < minSpacing
            );

            if (!tooClose) {
                points.push({ col, row, world: tilemap.tileToWorld(col, row) });
            }
        }

        return points;
    }
}


window.LevelGenerator = LevelGenerator;
