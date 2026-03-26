/* ============================================
   UI SYSTEM — HUD, Menus, Text, Dialogue
   ============================================ */

class UISystem {
    constructor(engine) {
        this.engine = engine;
        this.elements = [];
    }

    add(element) {
        element.engine = this.engine;
        this.elements.push(element);
        this.elements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        return element;
    }

    remove(element) {
        const idx = this.elements.indexOf(element);
        if (idx !== -1) this.elements.splice(idx, 1);
    }

    render(ctx) {
        for (const el of this.elements) {
            if (el.visible !== false) el.render(ctx);
        }
    }

    update(dt) {
        for (const el of this.elements) {
            if (el.update) el.update(dt);
        }
    }
}


/* ---- TEXT RENDERER ---- */
class TextNode extends Node {
    constructor(name = 'Text', text = '') {
        super(name);
        this.text = text;
        this.font = '16px monospace';
        this.color = '#ffffff';
        this.align = 'left';   // 'left', 'center', 'right'
        this.baseline = 'top';
        this.shadow = null;    // { color, offsetX, offsetY, blur }
        this.outline = null;   // { color, width }
        this.maxWidth = 0;     // 0 = no wrap
        this.lineHeight = 1.2;
    }

    drawUI(ctx) {
        ctx.save();
        ctx.font = this.font;
        ctx.textAlign = this.align;
        ctx.textBaseline = this.baseline;

        const x = this.position.x;
        const y = this.position.y;

        if (this.maxWidth > 0) {
            const lines = this._wrapText(ctx, this.text, this.maxWidth);
            const size = parseInt(this.font) || 16;
            lines.forEach((line, i) => {
                this._drawLine(ctx, line, x, y + i * size * this.lineHeight);
            });
        } else {
            this._drawLine(ctx, this.text, x, y);
        }

        ctx.restore();
    }

    _drawLine(ctx, text, x, y) {
        if (this.shadow) {
            ctx.shadowColor = this.shadow.color || 'rgba(0,0,0,0.5)';
            ctx.shadowOffsetX = this.shadow.offsetX || 2;
            ctx.shadowOffsetY = this.shadow.offsetY || 2;
            ctx.shadowBlur = this.shadow.blur || 0;
        }
        if (this.outline) {
            ctx.strokeStyle = this.outline.color || '#000000';
            ctx.lineWidth = this.outline.width || 2;
            ctx.strokeText(text, x, y);
        }
        ctx.fillStyle = this.color;
        ctx.fillText(text, x, y);
        ctx.shadowColor = 'transparent';
    }

    _wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            if (ctx.measureText(testLine).width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    }
}


/* ---- HEALTH BAR ---- */
class HealthBar extends Node {
    constructor(name = 'HealthBar') {
        super(name);
        this.maxValue = 100;
        this.value = 100;
        this.width = 200;
        this.height = 20;
        this.bgColor = '#333333';
        this.fillColor = '#22cc44';
        this.lowColor = '#cc2222';
        this.lowThreshold = 0.3;
        this.borderColor = '#ffffff';
        this.borderWidth = 2;
        this.showText = true;
        this.font = '12px monospace';
        this.smooth = true;
        this._displayValue = 100;

        // Heart-based display
        this.heartMode = false;
        this.heartImage = null;
        this.heartEmptyImage = null;
        this.heartSize = 24;
    }

    update(dt) {
        if (this.smooth) {
            this._displayValue += (this.value - this._displayValue) * 10 * dt;
        } else {
            this._displayValue = this.value;
        }
    }

    drawUI(ctx) {
        const x = this.position.x;
        const y = this.position.y;

        if (this.heartMode) {
            this._drawHearts(ctx, x, y);
            return;
        }

        const pct = this._displayValue / this.maxValue;
        const fillW = this.width * Math.max(0, Math.min(1, pct));
        const color = pct <= this.lowThreshold ? this.lowColor : this.fillColor;

        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(x, y, this.width, this.height);

        // Fill
        ctx.fillStyle = color;
        ctx.fillRect(x, y, fillW, this.height);

        // Border
        if (this.borderWidth > 0) {
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = this.borderWidth;
            ctx.strokeRect(x, y, this.width, this.height);
        }

        // Text
        if (this.showText) {
            ctx.fillStyle = '#ffffff';
            ctx.font = this.font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.ceil(this._displayValue)}/${this.maxValue}`, x + this.width / 2, y + this.height / 2);
        }
    }

    _drawHearts(ctx, x, y) {
        const totalHearts = Math.ceil(this.maxValue / 20); // 1 heart = 20 HP
        const fullHearts = Math.floor(this.value / 20);

        for (let i = 0; i < totalHearts; i++) {
            const hx = x + i * (this.heartSize + 4);
            if (this.heartImage && this.engine && i < fullHearts) {
                const img = this.engine.assets.getImage(this.heartImage);
                if (img) { ctx.drawImage(img, hx, y, this.heartSize, this.heartSize); continue; }
            }
            if (this.heartEmptyImage && this.engine && i >= fullHearts) {
                const img = this.engine.assets.getImage(this.heartEmptyImage);
                if (img) { ctx.drawImage(img, hx, y, this.heartSize, this.heartSize); continue; }
            }
            // Fallback: draw pixel hearts
            ctx.fillStyle = i < fullHearts ? '#ff2244' : '#444444';
            ctx.fillRect(hx + 2, y, 6, 4);
            ctx.fillRect(hx + 10, y, 6, 4);
            ctx.fillRect(hx, y + 4, this.heartSize - 6, 8);
            ctx.fillRect(hx + 2, y + 12, this.heartSize - 10, 4);
            ctx.fillRect(hx + 4, y + 16, this.heartSize - 14, 2);
        }
    }
}


/* ---- DIALOGUE BOX ---- */
class DialogueBox extends Node {
    constructor(name = 'DialogueBox') {
        super(name);
        this.messages = [];
        this._currentIndex = 0;
        this._charIndex = 0;
        this._charTimer = 0;
        this.charSpeed = 0.03;    // seconds per character
        this.active = false;
        this.visible = false;

        // Appearance
        this.boxX = 40;
        this.boxY = 480;
        this.boxWidth = 560;
        this.boxHeight = 120;
        this.padding = 16;
        this.bgColor = 'rgba(0, 0, 0, 0.85)';
        this.borderColor = '#ffffff';
        this.textColor = '#ffffff';
        this.nameColor = '#ffcc00';
        this.font = '14px monospace';
        this.nameFont = 'bold 14px monospace';
    }

    show(messages) {
        // messages: [{ name: 'NPC', text: 'Hello!' }, ...]
        this.messages = messages;
        this._currentIndex = 0;
        this._charIndex = 0;
        this._charTimer = 0;
        this.active = true;
        this.visible = true;
    }

    advance() {
        const msg = this.messages[this._currentIndex];
        if (!msg) return;

        if (this._charIndex < msg.text.length) {
            // Skip to end
            this._charIndex = msg.text.length;
        } else {
            // Next message
            this._currentIndex++;
            this._charIndex = 0;
            this._charTimer = 0;
            if (this._currentIndex >= this.messages.length) {
                this.active = false;
                this.visible = false;
                this.signals.emit('dialogue_complete');
            }
        }
    }

    update(dt) {
        if (!this.active) return;
        const msg = this.messages[this._currentIndex];
        if (!msg) return;

        this._charTimer += dt;
        if (this._charTimer >= this.charSpeed && this._charIndex < msg.text.length) {
            this._charTimer -= this.charSpeed;
            this._charIndex++;
        }
    }

    drawUI(ctx) {
        if (!this.visible) return;
        const msg = this.messages[this._currentIndex];
        if (!msg) return;

        // Box background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(this.boxX, this.boxY, this.boxWidth, this.boxHeight);
        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.boxX, this.boxY, this.boxWidth, this.boxHeight);

        // Name
        if (msg.name) {
            ctx.font = this.nameFont;
            ctx.fillStyle = this.nameColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(msg.name, this.boxX + this.padding, this.boxY + this.padding);
        }

        // Text (typewriter)
        const displayText = msg.text.substring(0, this._charIndex);
        ctx.font = this.font;
        ctx.fillStyle = this.textColor;
        const textY = this.boxY + this.padding + (msg.name ? 22 : 0);

        // Word wrap
        const words = displayText.split(' ');
        let line = '';
        let lineY = textY;
        const maxW = this.boxWidth - this.padding * 2;

        for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            if (ctx.measureText(testLine).width > maxW && line) {
                ctx.fillText(line, this.boxX + this.padding, lineY);
                line = word;
                lineY += 18;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, this.boxX + this.padding, lineY);

        // Continue indicator
        if (this._charIndex >= msg.text.length) {
            const blinkOn = Math.floor(Date.now() / 500) % 2 === 0;
            if (blinkOn) {
                ctx.fillStyle = this.textColor;
                ctx.fillText('▼', this.boxX + this.boxWidth - this.padding - 10,
                    this.boxY + this.boxHeight - this.padding - 4);
            }
        }
    }
}


/* ---- INVENTORY SYSTEM ---- */
class Inventory {
    constructor(slots = 20) {
        this.slots = new Array(slots).fill(null);
        this.maxSlots = slots;
        this.signals = new EventBus();
    }

    addItem(item, quantity = 1) {
        // Try stack first
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            if (slot && slot.id === item.id && slot.stackable) {
                slot.quantity += quantity;
                this.signals.emit('item_added', { item, slot: i });
                return true;
            }
        }
        // Find empty slot
        for (let i = 0; i < this.slots.length; i++) {
            if (!this.slots[i]) {
                this.slots[i] = { ...item, quantity };
                this.signals.emit('item_added', { item, slot: i });
                return true;
            }
        }
        return false; // Full
    }

    removeItem(slotIndex, quantity = 1) {
        const slot = this.slots[slotIndex];
        if (!slot) return false;
        slot.quantity -= quantity;
        if (slot.quantity <= 0) this.slots[slotIndex] = null;
        this.signals.emit('item_removed', { item: slot, slot: slotIndex });
        return true;
    }

    getItem(slotIndex) { return this.slots[slotIndex]; }
    hasItem(id) { return this.slots.some(s => s && s.id === id); }
    count(id) { return this.slots.reduce((sum, s) => sum + (s && s.id === id ? s.quantity : 0), 0); }
}


/* ---- ABILITY / COOLDOWN SYSTEM ---- */
class AbilitySystem {
    constructor() {
        this.abilities = {};
    }

    register(name, config) {
        // config: { cooldown, manaCost, damage, range, castTime, effect, icon }
        this.abilities[name] = {
            ...config,
            currentCooldown: 0,
            ready: true
        };
    }

    use(name, context) {
        const ability = this.abilities[name];
        if (!ability || !ability.ready) return false;
        if (context.mana !== undefined && context.mana < (ability.manaCost || 0)) return false;

        ability.ready = false;
        ability.currentCooldown = ability.cooldown || 0;
        if (ability.effect) ability.effect(context);
        return true;
    }

    update(dt) {
        for (const ability of Object.values(this.abilities)) {
            if (!ability.ready) {
                ability.currentCooldown -= dt;
                if (ability.currentCooldown <= 0) {
                    ability.ready = true;
                    ability.currentCooldown = 0;
                }
            }
        }
    }

    getCooldownPercent(name) {
        const a = this.abilities[name];
        if (!a || a.ready) return 0;
        return a.currentCooldown / (a.cooldown || 1);
    }
}


registerNodeType('TextNode', TextNode);
registerNodeType('HealthBar', HealthBar);
registerNodeType('DialogueBox', DialogueBox);
window.UISystem = UISystem;
window.TextNode = TextNode;
window.HealthBar = HealthBar;
window.DialogueBox = DialogueBox;
window.Inventory = Inventory;
window.AbilitySystem = AbilitySystem;
