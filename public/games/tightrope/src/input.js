/* ============================================
   INPUT MANAGER — Keyboard, Mouse, Gamepad, Touch
   Supports action mapping (like Godot's Input Map)
   ============================================ */

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this._keys = {};
        this._keysDown = {};
        this._keysUp = {};
        this._mouse = { x: 0, y: 0, worldX: 0, worldY: 0, buttons: 0 };
        this._mouseDown = {};
        this._mouseUp = {};
        this._touches = [];

        // Action mapping: { "jump": ["Space", "ArrowUp", "gamepad0"], ... }
        this._actions = {};

        // Gamepad
        this._gamepads = {};
        this._gamepadDeadzone = 0.15;

        this._init();
    }

    _init() {
        // Double-escape to exit back to profile
        this._escPrompt = false;
        this._escTimer = null;

        window.addEventListener('keydown', (e) => {
            if (!this._keys[e.code]) this._keysDown[e.code] = true;
            this._keys[e.code] = true;
            if (e.code === 'Escape') {
                if (this._escPrompt) { window.location.href = '/profile'; }
                else { this._escPrompt = true; clearTimeout(this._escTimer); this._escTimer = setTimeout(() => { this._escPrompt = false; }, 3000); }
            }
        });

        window.addEventListener('keyup', (e) => {
            this._keys[e.code] = false;
            this._keysUp[e.code] = true;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this._mouse.x = (e.clientX - rect.left) * scaleX;
            this._mouse.y = (e.clientY - rect.top) * scaleY;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this._mouse.buttons |= (1 << e.button);
            this._mouseDown[e.button] = true;
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this._mouse.buttons &= ~(1 << e.button);
            this._mouseUp[e.button] = true;
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this._updateTouches(e.touches);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this._updateTouches(e.touches);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            this._updateTouches(e.touches);
        });

        // Gamepad
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`Gamepad connected: ${e.gamepad.id}`);
        });
    }

    _updateTouches(touches) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this._touches = [];
        for (let i = 0; i < touches.length; i++) {
            this._touches.push({
                x: (touches[i].clientX - rect.left) * scaleX,
                y: (touches[i].clientY - rect.top) * scaleY,
                id: touches[i].identifier
            });
        }
    }

    // ---- Action Mapping ----
    mapAction(name, keys) {
        // keys: array of key codes or special values like "gamepad_a", "gamepad_lb", "mouse_0"
        this._actions[name] = keys;
        return this;
    }

    isAction(name) {
        const keys = this._actions[name];
        if (!keys) return false;
        return keys.some(k => this._resolveKey(k, 'held'));
    }

    isActionDown(name) {
        const keys = this._actions[name];
        if (!keys) return false;
        return keys.some(k => this._resolveKey(k, 'down'));
    }

    isActionUp(name) {
        const keys = this._actions[name];
        if (!keys) return false;
        return keys.some(k => this._resolveKey(k, 'up'));
    }

    _resolveKey(key, type) {
        if (key.startsWith('gamepad_')) return this._gamepadButton(key, type);
        if (key.startsWith('mouse_')) {
            const btn = parseInt(key.split('_')[1]);
            if (type === 'down') return !!this._mouseDown[btn];
            if (type === 'up') return !!this._mouseUp[btn];
            return !!(this._mouse.buttons & (1 << btn));
        }
        if (type === 'down') return !!this._keysDown[key];
        if (type === 'up') return !!this._keysUp[key];
        return !!this._keys[key];
    }

    // ---- Direct Access ----
    isKey(code) { return !!this._keys[code]; }
    isKeyDown(code) { return !!this._keysDown[code]; }
    isKeyUp(code) { return !!this._keysUp[code]; }

    get mouse() { return this._mouse; }
    get touches() { return this._touches; }

    isMouseButton(btn = 0) { return !!(this._mouse.buttons & (1 << btn)); }
    isMouseDown(btn = 0) { return !!this._mouseDown[btn]; }
    isMouseUp(btn = 0) { return !!this._mouseUp[btn]; }

    // ---- Gamepad ----
    _gamepadButton(key, type) {
        let gp = null;
        try { const gamepads = navigator.getGamepads ? navigator.getGamepads() : []; gp = gamepads[0]; } catch(e) {}
        if (!gp) return false;

        const buttonMap = {
            'gamepad_a': 0, 'gamepad_b': 1, 'gamepad_x': 2, 'gamepad_y': 3,
            'gamepad_lb': 4, 'gamepad_rb': 5, 'gamepad_lt': 6, 'gamepad_rt': 7,
            'gamepad_select': 8, 'gamepad_start': 9,
            'gamepad_l3': 10, 'gamepad_r3': 11,
            'gamepad_up': 12, 'gamepad_down': 13, 'gamepad_left': 14, 'gamepad_right': 15
        };

        const idx = buttonMap[key];
        if (idx === undefined) return false;
        return gp.buttons[idx]?.pressed || false;
    }

    getAxis(axis = 'left') {
        let gp = null;
        try { const gamepads = navigator.getGamepads ? navigator.getGamepads() : []; gp = gamepads[0]; } catch(e) {}
        if (!gp) return { x: 0, y: 0 };

        let x, y;
        if (axis === 'left') { x = gp.axes[0]; y = gp.axes[1]; }
        else { x = gp.axes[2]; y = gp.axes[3]; }

        // Deadzone
        if (Math.abs(x) < this._gamepadDeadzone) x = 0;
        if (Math.abs(y) < this._gamepadDeadzone) y = 0;

        return { x, y };
    }

    // ---- Helpers ----
    getMovementVector() {
        let x = 0, y = 0;
        if (this.isAction('move_left') || this.isKey('ArrowLeft') || this.isKey('KeyA')) x -= 1;
        if (this.isAction('move_right') || this.isKey('ArrowRight') || this.isKey('KeyD')) x += 1;
        if (this.isAction('move_up') || this.isKey('ArrowUp') || this.isKey('KeyW')) y -= 1;
        if (this.isAction('move_down') || this.isKey('ArrowDown') || this.isKey('KeyS')) y += 1;

        // Gamepad
        const gpAxis = this.getAxis('left');
        if (Math.abs(gpAxis.x) > 0) x = gpAxis.x;
        if (Math.abs(gpAxis.y) > 0) y = gpAxis.y;

        // Normalize diagonal
        const len = Math.sqrt(x * x + y * y);
        if (len > 1) { x /= len; y /= len; }

        return { x, y };
    }

    _update() {
        // Update mouse world position (needs camera, set by engine)
    }

    _lateUpdate() {
        this._keysDown = {};
        this._keysUp = {};
        this._mouseDown = {};
        this._mouseUp = {};
    }
}

window.InputManager = InputManager;
