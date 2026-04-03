/* ============================================
   PATHFINDING — A*, grid-based navigation
   Works with tilemaps for any genre
   ============================================ */

class Pathfinder {
    constructor() {
        this._openSet = [];
    }

    // A* pathfinding on a tilemap
    findPath(tilemap, startCol, startRow, endCol, endRow, options = {}) {
        const allowDiagonal = options.diagonal || false;
        const maxIterations = options.maxIterations || 1000;
        const isWalkable = options.isWalkable || ((col, row) => {
            const tile = tilemap.getTile(col, row);
            return tile === null || tile === -1 || (tilemap.collisionTiles && !tilemap.collisionTiles.has(tile));
        });

        // Bounds check
        if (startCol < 0 || startCol >= tilemap.mapWidth || startRow < 0 || startRow >= tilemap.mapHeight) return null;
        if (endCol < 0 || endCol >= tilemap.mapWidth || endRow < 0 || endRow >= tilemap.mapHeight) return null;
        if (!isWalkable(endCol, endRow)) return null;

        const key = (col, row) => `${col},${row}`;
        const heuristic = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

        const start = { col: startCol, row: startRow };
        const end = { col: endCol, row: endRow };

        const openSet = [start];
        const cameFrom = {};
        const gScore = {};
        const fScore = {};

        gScore[key(start.col, start.row)] = 0;
        fScore[key(start.col, start.row)] = heuristic(start, end);

        const closedSet = new Set();
        let iterations = 0;

        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;

            // Find lowest fScore in open set
            let bestIdx = 0;
            for (let i = 1; i < openSet.length; i++) {
                if ((fScore[key(openSet[i].col, openSet[i].row)] || Infinity) <
                    (fScore[key(openSet[bestIdx].col, openSet[bestIdx].row)] || Infinity)) {
                    bestIdx = i;
                }
            }

            const current = openSet.splice(bestIdx, 1)[0];
            const ck = key(current.col, current.row);

            if (current.col === end.col && current.row === end.row) {
                // Reconstruct path
                const path = [];
                let node = ck;
                while (node) {
                    const [c, r] = node.split(',').map(Number);
                    path.unshift({ col: c, row: r });
                    node = cameFrom[node];
                }
                return path;
            }

            closedSet.add(ck);

            // Neighbors
            const neighbors = [
                { col: current.col - 1, row: current.row },
                { col: current.col + 1, row: current.row },
                { col: current.col, row: current.row - 1 },
                { col: current.col, row: current.row + 1 },
            ];

            if (allowDiagonal) {
                neighbors.push(
                    { col: current.col - 1, row: current.row - 1 },
                    { col: current.col + 1, row: current.row - 1 },
                    { col: current.col - 1, row: current.row + 1 },
                    { col: current.col + 1, row: current.row + 1 },
                );
            }

            for (const neighbor of neighbors) {
                const nk = key(neighbor.col, neighbor.row);
                if (closedSet.has(nk)) continue;
                if (!isWalkable(neighbor.col, neighbor.row)) continue;

                const isDiag = neighbor.col !== current.col && neighbor.row !== current.row;
                const tentativeG = (gScore[ck] || 0) + (isDiag ? 1.414 : 1);

                if (tentativeG < (gScore[nk] || Infinity)) {
                    cameFrom[nk] = ck;
                    gScore[nk] = tentativeG;
                    fScore[nk] = tentativeG + heuristic(neighbor, end);

                    if (!openSet.some(n => n.col === neighbor.col && n.row === neighbor.row)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return null; // No path found
    }

    // Convert tile path to world positions
    pathToWorld(tilemap, path) {
        if (!path) return null;
        return path.map(p => tilemap.tileToWorld(p.col, p.row));
    }

    // Find nearest walkable tile to a target
    findNearest(tilemap, col, row, isWalkable) {
        const maxRadius = 10;
        for (let r = 0; r <= maxRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nc = col + dx;
                    const nr = row + dy;
                    if (nc >= 0 && nc < tilemap.mapWidth && nr >= 0 && nr < tilemap.mapHeight) {
                        if (isWalkable(nc, nr)) return { col: nc, row: nr };
                    }
                }
            }
        }
        return null;
    }
}


/* ============================================
   NAV AGENT — Follows a path automatically
   ============================================ */
class NavAgent extends Node {
    constructor(name = 'NavAgent') {
        super(name);
        this.speed = 100;
        this.path = null;
        this._pathIndex = 0;
        this._pathfinder = new Pathfinder();
        this.arrivalDistance = 4;
        this.moving = false;
    }

    navigateTo(tilemap, targetCol, targetRow) {
        const pos = this.globalPosition;
        const start = tilemap.worldToTile(pos.x, pos.y);
        this.path = this._pathfinder.findPath(tilemap, start.col, start.row, targetCol, targetRow, { diagonal: true });
        if (this.path) {
            this._pathIndex = 1; // Skip start position
            this.moving = true;
            this.path = this._pathfinder.pathToWorld(tilemap, this.path);
        }
        return this.path !== null;
    }

    update(dt) {
        if (!this.moving || !this.path || this._pathIndex >= this.path.length) {
            this.moving = false;
            return;
        }

        const target = this.path[this._pathIndex];
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.arrivalDistance) {
            this._pathIndex++;
            if (this._pathIndex >= this.path.length) {
                this.moving = false;
                this.signals.emit('arrived');
            }
            return;
        }

        this.position.x += (dx / dist) * this.speed * dt;
        this.position.y += (dy / dist) * this.speed * dt;
    }
}


/* ============================================
   FLOW FIELD — Mass pathfinding for RTS/MOBA
   ============================================ */
class FlowField {
    constructor(tilemap) {
        this.tilemap = tilemap;
        this.field = null;
        this.costField = null;
    }

    generate(targetCol, targetRow, isWalkable) {
        const w = this.tilemap.mapWidth;
        const h = this.tilemap.mapHeight;

        // Integration field (cost to reach target)
        const cost = Array.from({ length: h }, () => new Array(w).fill(Infinity));
        cost[targetRow][targetCol] = 0;

        // BFS from target
        const queue = [{ col: targetCol, row: targetRow }];
        while (queue.length > 0) {
            const curr = queue.shift();
            const neighbors = [
                { col: curr.col - 1, row: curr.row },
                { col: curr.col + 1, row: curr.row },
                { col: curr.col, row: curr.row - 1 },
                { col: curr.col, row: curr.row + 1 },
            ];

            for (const n of neighbors) {
                if (n.col < 0 || n.col >= w || n.row < 0 || n.row >= h) continue;
                if (!isWalkable(n.col, n.row)) continue;
                const newCost = cost[curr.row][curr.col] + 1;
                if (newCost < cost[n.row][n.col]) {
                    cost[n.row][n.col] = newCost;
                    queue.push(n);
                }
            }
        }

        // Direction field
        this.field = Array.from({ length: h }, () => new Array(w).fill(null));
        this.costField = cost;

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                if (cost[row][col] === Infinity) continue;
                if (col === targetCol && row === targetRow) {
                    this.field[row][col] = { x: 0, y: 0 };
                    continue;
                }

                let bestCost = cost[row][col];
                let bestDir = { x: 0, y: 0 };

                const neighbors = [
                    { col: col - 1, row, dx: -1, dy: 0 },
                    { col: col + 1, row, dx: 1, dy: 0 },
                    { col, row: row - 1, dx: 0, dy: -1 },
                    { col, row: row + 1, dx: 0, dy: 1 },
                ];

                for (const n of neighbors) {
                    if (n.col < 0 || n.col >= w || n.row < 0 || n.row >= h) continue;
                    if (cost[n.row][n.col] < bestCost) {
                        bestCost = cost[n.row][n.col];
                        bestDir = { x: n.dx, y: n.dy };
                    }
                }

                this.field[row][col] = bestDir;
            }
        }
    }

    getDirection(col, row) {
        if (!this.field || row < 0 || row >= this.field.length || col < 0 || col >= this.field[0].length) {
            return { x: 0, y: 0 };
        }
        return this.field[row][col] || { x: 0, y: 0 };
    }
}

registerNodeType('NavAgent', NavAgent);
window.Pathfinder = Pathfinder;
window.NavAgent = NavAgent;
window.FlowField = FlowField;
