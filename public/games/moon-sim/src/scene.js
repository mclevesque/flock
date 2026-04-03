/* ============================================
   SCENE & NODE SYSTEM — Godot-style scene tree
   ============================================ */

class Node {
    constructor(name = 'Node') {
        this.name = name;
        this.parent = null;
        this.children = [];
        this.engine = null;
        this.active = true;
        this.visible = true;
        this.tags = new Set();
        this.signals = new EventBus();

        // Transform
        this.position = { x: 0, y: 0 };
        this.scale = { x: 1, y: 1 };
        this.rotation = 0;
        this.origin = { x: 0, y: 0 }; // pivot point
        this.zIndex = 0;

        this._ready = false;
        this._destroyed = false;
    }

    // ---- Tree Operations ----
    addChild(child) {
        if (child.parent) child.parent.removeChild(child);
        child.parent = this;
        child.engine = this.engine;
        this.children.push(child);
        this.children.sort((a, b) => a.zIndex - b.zIndex);
        if (this._ready && !child._ready) child._enterTree();
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parent = null;
            child._exitTree();
        }
        return child;
    }

    destroy() {
        this._destroyed = true;
        for (const child of [...this.children]) child.destroy();
        if (this.parent) this.parent.removeChild(this);
    }

    // ---- Tree Queries ----
    getChild(name) {
        return this.children.find(c => c.name === name) || null;
    }

    getNode(path) {
        const parts = path.split('/');
        let node = this;
        for (const part of parts) {
            if (part === '..') node = node.parent;
            else node = node.getChild(part);
            if (!node) return null;
        }
        return node;
    }

    findByTag(tag) {
        const results = [];
        if (this.tags.has(tag)) results.push(this);
        for (const child of this.children) results.push(...child.findByTag(tag));
        return results;
    }

    findByType(type) {
        const results = [];
        if (this instanceof type) results.push(this);
        for (const child of this.children) results.push(...child.findByType(type));
        return results;
    }

    findAll(predicate) {
        const results = [];
        if (predicate(this)) results.push(this);
        for (const child of this.children) results.push(...child.findAll(predicate));
        return results;
    }

    // ---- World Transform ----
    get globalPosition() {
        if (!this.parent) return { ...this.position };
        const pp = this.parent.globalPosition;
        return { x: pp.x + this.position.x, y: pp.y + this.position.y };
    }

    set globalPosition(pos) {
        if (!this.parent) {
            this.position.x = pos.x;
            this.position.y = pos.y;
        } else {
            const pp = this.parent.globalPosition;
            this.position.x = pos.x - pp.x;
            this.position.y = pos.y - pp.y;
        }
    }

    distanceTo(other) {
        const a = this.globalPosition;
        const b = other.globalPosition;
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    // ---- Lifecycle (override these) ----
    ready() {}          // Called once when entering scene tree
    update(dt) {}       // Called every frame
    fixedUpdate(dt) {}  // Called at fixed rate (physics)
    draw(ctx) {}        // Called every frame for rendering
    drawUI(ctx) {}      // Called in screen space
    onDestroy() {}      // Called when destroyed

    // ---- Internal Lifecycle ----
    _enterTree() {
        this.engine = this.parent?.engine || this.engine;
        if (!this._ready) {
            this._ready = true;
            this.ready();
        }
        for (const child of this.children) child._enterTree();
    }

    _exitTree() {
        this.onDestroy();
        for (const child of this.children) child._exitTree();
    }

    _update(dt) {
        if (!this.active || this._destroyed) return;
        this.update(dt);
        for (const child of [...this.children]) child._update(dt);
    }

    _fixedUpdate(dt) {
        if (!this.active || this._destroyed) return;
        this.fixedUpdate(dt);
        for (const child of [...this.children]) child._fixedUpdate(dt);
    }

    _render(ctx) {
        if (!this.visible || this._destroyed) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale.x, this.scale.y);

        this.draw(ctx);
        for (const child of this.children) child._render(ctx);

        ctx.restore();
    }

    _renderUI(ctx) {
        if (!this.visible || this._destroyed) return;
        this.drawUI(ctx);
        for (const child of this.children) child._renderUI(ctx);
    }

    _renderDebug(ctx) {
        if (!this.active) return;
        // Override in subclasses for debug visuals
        for (const child of this.children) child._renderDebug(ctx);
    }

    // ---- Serialization ----
    toJSON() {
        return {
            type: this.constructor.name,
            name: this.name,
            position: { ...this.position },
            scale: { ...this.scale },
            rotation: this.rotation,
            zIndex: this.zIndex,
            active: this.active,
            visible: this.visible,
            tags: [...this.tags],
            children: this.children.map(c => c.toJSON()),
            data: this._serializeData()
        };
    }

    _serializeData() { return {}; }

    static fromJSON(data) {
        const TypeMap = window._VibeNodeTypes || {};
        const Cls = TypeMap[data.type] || Node;
        const node = new Cls(data.name);
        node.position = data.position || { x: 0, y: 0 };
        node.scale = data.scale || { x: 1, y: 1 };
        node.rotation = data.rotation || 0;
        node.zIndex = data.zIndex || 0;
        node.active = data.active !== false;
        node.visible = data.visible !== false;
        if (data.tags) data.tags.forEach(t => node.tags.add(t));
        if (data.data) node._deserializeData(data.data);
        if (data.children) {
            for (const childData of data.children) {
                node.addChild(Node.fromJSON(childData));
            }
        }
        return node;
    }

    _deserializeData(data) {}
}


/* ============================================
   SCENE — Root node for a game scene
   ============================================ */
class Scene extends Node {
    constructor(name = 'Scene') {
        super(name);
        this.backgroundColor = null;
    }

    _enter() {
        this._enterTree();
        this.signals.emit('entered');
    }

    _exit() {
        this.signals.emit('exited');
    }

    _render(ctx) {
        if (this.backgroundColor) {
            ctx.fillStyle = this.backgroundColor;
            ctx.fillRect(
                -this.engine.camera.position.x,
                -this.engine.camera.position.y,
                this.engine.width / this.engine.camera.zoom,
                this.engine.height / this.engine.camera.zoom
            );
        }
        super._render(ctx);
    }
}


// ---- Node Type Registry ----
window._VibeNodeTypes = window._VibeNodeTypes || {};
function registerNodeType(name, cls) {
    window._VibeNodeTypes[name] = cls;
}

registerNodeType('Node', Node);
registerNodeType('Scene', Scene);

window.Node = Node;
window.Scene = Scene;
window.registerNodeType = registerNodeType;
