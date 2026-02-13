/* ============================================
   BREAKOUT - 打磚塊 Game Engine
   A full-featured Breakout game with:
   - Precise paddle physics (hit-position based angles)
   - Special bricks (iron, explosive, multi-ball, hidden, moving)
   - Power-up system (expand, shrink, slow, pierce, magnet, laser, split, life)
   - Particle effects & combo system
   - Progressive difficulty across 15 levels
   - Sound effects (Web Audio API)
   ============================================ */

// ==========================================
// POLYFILLS
// ==========================================
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
        const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
        return this;
    };
}

// ==========================================
// CONSTANTS
// ==========================================
const CANVAS_W = 800;
const CANVAS_H = 600;
const HUD_H = 36;
const PADDLE_Y = CANVAS_H - 40;
const PADDLE_BASE_W = 100;
const PADDLE_H = 14;
const BALL_R = 6;
const BALL_BASE_SPEED = 5;
const BRICK_ROWS = 8;
const BRICK_COLS = 10;
const BRICK_W = 68;
const BRICK_H = 22;
const BRICK_PAD = 4;
const BRICK_OFFSET_X = 30;
const BRICK_OFFSET_Y = HUD_H + 20;
const MAX_LIVES = 5;
const TOTAL_LEVELS = 15;
const POWERUP_SPEED = 2;
const POWERUP_SIZE = 20;
const POWERUP_DURATION = 10000; // 10 seconds

// Brick types
const BRICK_NORMAL = 0;
const BRICK_IRON = 1;
const BRICK_EXPLOSIVE = 2;
const BRICK_MULTIBALL = 3;
const BRICK_HIDDEN = 4;
const BRICK_MOVING = 5;

// Power-up types
const PU_EXPAND = 0;
const PU_SHRINK = 1;
const PU_SLOW = 2;
const PU_PIERCE = 3;
const PU_MAGNET = 4;
const PU_LASER = 5;
const PU_SPLIT = 6;
const PU_LIFE = 7;

const PU_NAMES = ['板子加長', '板子縮短', '球速減慢', '穿透球', '磁力吸球', '雷射射擊', '分裂多球', '額外生命'];
const PU_EMOJIS = ['🟢', '🔴', '🔵', '🟡', '🟣', '⚡', '💥', '❤️'];
const PU_COLORS = ['#00ff88', '#ff4444', '#4488ff', '#ffcc00', '#cc44ff', '#44ffff', '#ff8800', '#ff4488'];

// Brick color themes per row
const BRICK_COLORS = [
    ['#ff6b6b', '#c0392b'],
    ['#ff9f43', '#e67e22'],
    ['#feca57', '#f1c40f'],
    ['#48dbfb', '#0abde3'],
    ['#ff6b81', '#ee5a6f'],
    ['#a29bfe', '#6c5ce7'],
    ['#55efc4', '#00b894'],
    ['#fd79a8', '#e84393'],
];

// ==========================================
// AUDIO ENGINE (Web Audio API)
// ==========================================
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            switch (type) {
                case 'hit':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(520, now);
                    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    osc.start(now);
                    osc.stop(now + 0.08);
                    break;
                case 'brick':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(800, now);
                    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                    break;
                case 'iron':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    osc.start(now);
                    osc.stop(now + 0.12);
                    break;
                case 'explode':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(150, now);
                    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;
                case 'powerup':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'lose':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
                case 'win':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, now);
                    osc.frequency.setValueAtTime(659, now + 0.1);
                    osc.frequency.setValueAtTime(784, now + 0.2);
                    osc.frequency.setValueAtTime(1047, now + 0.3);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
                case 'laser':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(1200, now);
                    osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                    osc.start(now);
                    osc.stop(now + 0.06);
                    break;
                case 'combo':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    osc.start(now);
                    osc.stop(now + 0.15);
                    break;
            }
        } catch (e) { /* silent fail */ }
    }
}

// ==========================================
// PARTICLE SYSTEM
// ==========================================
class Particle {
    constructor(x, y, color, vx, vy, life, size) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = vx || (Math.random() - 0.5) * 4;
        this.vy = vy || (Math.random() - 0.5) * 4;
        this.life = life || 30;
        this.maxLife = this.life;
        this.size = size || 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.05; // gravity
        this.life--;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size * alpha, this.size * alpha);
        ctx.globalAlpha = 1;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, color, count = 10, spread = 4, life = 30, size = 3) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(
                x, y, color,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                life + Math.random() * 10,
                size
            ));
        }
    }

    emitExplosion(x, y, count = 30) {
        const colors = ['#ff6b6b', '#feca57', '#ff9f43', '#fff', '#ff4444'];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const speed = 2 + Math.random() * 4;
            this.particles.push(new Particle(
                x, y,
                colors[Math.floor(Math.random() * colors.length)],
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                40 + Math.random() * 20,
                4
            ));
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }
    }
}

// ==========================================
// FLOATING TEXT
// ==========================================
class FloatingText {
    constructor(x, y, text, color, size = 16) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.life = 40;
        this.maxLife = 40;
    }

    update() {
        this.y -= 1;
        this.life--;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

// ==========================================
// LEVEL DEFINITIONS
// ==========================================
function generateLevels() {
    const levels = [];

    // Level 1: Simple intro - just normal bricks, 3 rows
    levels.push({
        name: '初入磚陣',
        rows: 3, cols: 10,
        ballSpeed: 4,
        layout: (r, c) => ({ type: BRICK_NORMAL }),
    });

    // Level 2: 4 rows
    levels.push({
        name: '漸入佳境',
        rows: 4, cols: 10,
        ballSpeed: 4.2,
        layout: (r, c) => ({ type: BRICK_NORMAL }),
    });

    // Level 3: Introduce iron bricks
    levels.push({
        name: '鐵壁初現',
        rows: 4, cols: 10,
        ballSpeed: 4.4,
        layout: (r, c) => {
            if (r === 0 && c % 3 === 1) return { type: BRICK_IRON, hp: 2 };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 4: Introduce explosive bricks
    levels.push({
        name: '爆破登場',
        rows: 5, cols: 10,
        ballSpeed: 4.5,
        layout: (r, c) => {
            if (r === 2 && c === 4) return { type: BRICK_EXPLOSIVE };
            if (r === 2 && c === 5) return { type: BRICK_EXPLOSIVE };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 5: Multi-ball bricks
    levels.push({
        name: '多球狂歡',
        rows: 5, cols: 10,
        ballSpeed: 4.5,
        layout: (r, c) => {
            if (r === 1 && c === 4) return { type: BRICK_MULTIBALL };
            if (r === 1 && c === 5) return { type: BRICK_MULTIBALL };
            if (r === 0 && c % 2 === 0) return { type: BRICK_IRON, hp: 2 };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 6: Hidden bricks
    levels.push({
        name: '隱藏危機',
        rows: 5, cols: 10,
        ballSpeed: 4.8,
        layout: (r, c) => {
            if (r === 3 && c % 2 === 0) return { type: BRICK_HIDDEN };
            if (r === 0 && c % 3 === 0) return { type: BRICK_IRON, hp: 2 };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 7: Moving bricks
    levels.push({
        name: '移形換位',
        rows: 5, cols: 10,
        ballSpeed: 5,
        layout: (r, c) => {
            if (r === 2) return { type: BRICK_MOVING };
            if (r === 0) return { type: BRICK_IRON, hp: 2 };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 8: Mix everything
    levels.push({
        name: '百花齊放',
        rows: 6, cols: 10,
        ballSpeed: 5,
        layout: (r, c) => {
            if (r === 0 && c % 2 === 0) return { type: BRICK_IRON, hp: 3 };
            if (r === 2 && c === 3) return { type: BRICK_EXPLOSIVE };
            if (r === 2 && c === 6) return { type: BRICK_EXPLOSIVE };
            if (r === 3 && c === 5) return { type: BRICK_MULTIBALL };
            if (r === 4 && c % 3 === 0) return { type: BRICK_HIDDEN };
            if (r === 1 && c > 2 && c < 7) return { type: BRICK_MOVING };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 9: Iron fortress
    levels.push({
        name: '鐵壁堡壘',
        rows: 6, cols: 10,
        ballSpeed: 5.2,
        layout: (r, c) => {
            if (r < 2) return { type: BRICK_IRON, hp: 3 };
            if (r === 2 && c === 4) return { type: BRICK_EXPLOSIVE };
            if (r === 2 && c === 5) return { type: BRICK_EXPLOSIVE };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 10: Diamond pattern
    levels.push({
        name: '鑽石陣列',
        rows: 7, cols: 10,
        ballSpeed: 5.3,
        layout: (r, c) => {
            const centerR = 3, centerC = 4.5;
            const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
            if (dist > 5) return null;
            if (dist < 2) return { type: BRICK_IRON, hp: 3 };
            if (r === centerR && (c === 2 || c === 7)) return { type: BRICK_EXPLOSIVE };
            if (dist === 3 && c % 2 === 0) return { type: BRICK_HIDDEN };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 11: Moving fortress
    levels.push({
        name: '移動要塞',
        rows: 6, cols: 10,
        ballSpeed: 5.5,
        layout: (r, c) => {
            if (r % 2 === 0) return { type: BRICK_MOVING };
            if (r === 1 && c % 3 === 0) return { type: BRICK_IRON, hp: 2 };
            if (r === 3 && c === 5) return { type: BRICK_MULTIBALL };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 12: Explosion chain
    levels.push({
        name: '連鎖爆破',
        rows: 6, cols: 10,
        ballSpeed: 5.5,
        layout: (r, c) => {
            if ((r + c) % 4 === 0) return { type: BRICK_EXPLOSIVE };
            if (r === 0) return { type: BRICK_IRON, hp: 3 };
            if (r === 5 && c % 2 === 0) return { type: BRICK_HIDDEN };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 13: Chaos
    levels.push({
        name: '極限混沌',
        rows: 7, cols: 10,
        ballSpeed: 5.8,
        layout: (r, c) => {
            const rand = ((r * 17 + c * 31) % 10);
            if (rand < 2) return { type: BRICK_IRON, hp: 2 + (r < 2 ? 1 : 0) };
            if (rand === 2) return { type: BRICK_EXPLOSIVE };
            if (rand === 3) return { type: BRICK_MULTIBALL };
            if (rand === 4) return { type: BRICK_HIDDEN };
            if (rand === 5 && r > 2) return { type: BRICK_MOVING };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 14: The Wall
    levels.push({
        name: '銅牆鐵壁',
        rows: 8, cols: 10,
        ballSpeed: 6,
        layout: (r, c) => {
            if (r < 3) return { type: BRICK_IRON, hp: 3 };
            if (r === 3) return { type: BRICK_EXPLOSIVE };
            if (r === 4) return { type: BRICK_MOVING };
            if (r === 5 && c === 5) return { type: BRICK_MULTIBALL };
            return { type: BRICK_NORMAL };
        },
    });

    // Level 15: Final Boss
    levels.push({
        name: '最終決戰',
        rows: 8, cols: 10,
        ballSpeed: 6.5,
        layout: (r, c) => {
            if (r === 0) return { type: BRICK_IRON, hp: 4 };
            if (r === 1 && c % 2 === 0) return { type: BRICK_IRON, hp: 3 };
            if (r === 2 && c % 3 === 0) return { type: BRICK_EXPLOSIVE };
            if (r === 3) return { type: BRICK_MOVING };
            if (r === 4 && c === 4) return { type: BRICK_MULTIBALL };
            if (r === 4 && c === 5) return { type: BRICK_MULTIBALL };
            if (r === 5 && c % 2 === 1) return { type: BRICK_HIDDEN };
            if (r === 6) return { type: BRICK_IRON, hp: 2 };
            return { type: BRICK_NORMAL };
        },
    });

    return levels;
}

// ==========================================
// MAIN GAME CLASS
// ==========================================
class BreakoutGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        // Canvas size will be set by setupResponsive() for HiDPI support
        this.canvas.width = CANVAS_W;
        this.canvas.height = CANVAS_H;

        this.container = document.getElementById('game-container');
        this.audio = new AudioEngine();
        this.particles = new ParticleSystem();
        this.floatingTexts = [];
        this.levels = generateLevels();

        // Responsive scaling
        this.scale = 1;
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.setupResponsive();

        // Game state
        this.state = 'menu'; // menu, playing, paused, gameover, levelcomplete
        this.currentLevel = 0;
        this.score = 0;
        this.lives = 3;
        this.combo = 0;
        this.maxCombo = 0;
        this.highScore = parseInt(localStorage.getItem('breakout_highscore') || '0');
        this.unlockedLevel = parseInt(localStorage.getItem('breakout_unlocked') || '1');

        // Paddle
        this.paddle = { x: CANVAS_W / 2, w: PADDLE_BASE_W, h: PADDLE_H };

        // Balls
        this.balls = [];

        // Bricks
        this.bricks = [];

        // Power-ups
        this.powerups = [];
        this.activePowerups = {};
        this.powerupTimers = {};

        // Lasers
        this.lasers = [];
        this.laserCooldown = 0;

        // Input
        this.keys = {};
        this.mouseX = CANVAS_W / 2;
        this.useMouseControl = false;
        this.ballAttached = true;

        // Background stars
        this.bgStars = [];
        for (let i = 0; i < 80; i++) {
            this.bgStars.push({
                x: Math.random() * CANVAS_W,
                y: Math.random() * CANVAS_H,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.3 + 0.1,
                alpha: Math.random() * 0.5 + 0.2,
            });
        }

        this.setupUI();
        this.setupInput();
        this.updateHighScoreDisplay();
        this.generateLevelButtons();

        // Ensure orientation is not locked (allow portrait on mobile)
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
            screen.orientation.unlock().catch(() => {});
        }

        // Start game loop
        this.lastTime = 0;
        this.animFrame = requestAnimationFrame((t) => this.gameLoop(t));
    }

    // ==========================================
    // UI SETUP
    // ==========================================
    setupUI() {
        // Start screen
        document.getElementById('btn-start').onclick = () => this.startGame(0);
        document.getElementById('btn-level-select').onclick = () => this.showScreen('level-select-screen');
        document.getElementById('btn-how-to-play').onclick = () => this.showScreen('how-to-play-screen');
        document.getElementById('btn-back-menu').onclick = () => this.showScreen('start-screen');
        document.getElementById('btn-back-menu2').onclick = () => this.showScreen('start-screen');

        // Pause
        document.getElementById('btn-resume').onclick = () => this.resume();
        document.getElementById('btn-restart').onclick = () => this.startGame(this.currentLevel);
        document.getElementById('btn-quit').onclick = () => this.quitToMenu();

        // Game over
        document.getElementById('btn-retry').onclick = () => this.startGame(this.currentLevel);
        document.getElementById('btn-gameover-quit').onclick = () => this.quitToMenu();

        // Level complete
        document.getElementById('btn-next-level').onclick = () => this.nextLevel();
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'Space') {
                e.preventDefault();
                if (this.state === 'playing') {
                    if (this.ballAttached) {
                        this.launchBall();
                    } else {
                        this.pause();
                    }
                } else if (this.state === 'paused') {
                    this.resume();
                }
            }

            if (e.code === 'Escape' && this.state === 'playing') {
                this.pause();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const coords = this.screenToGame(e.clientX, e.clientY);
            this.mouseX = coords.x;
            this.useMouseControl = true;
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.state === 'playing' && this.ballAttached) {
                this.audio.init();
                this.launchBall();
            }
        });

        // Touch support
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const coords = this.screenToGame(e.touches[0].clientX, e.touches[0].clientY);
            this.mouseX = coords.x;
            this.useMouseControl = true;
        }, { passive: false });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.audio.init();
            const coords = this.screenToGame(e.touches[0].clientX, e.touches[0].clientY);
            this.mouseX = coords.x;
            this.useMouseControl = true;
            if (this.state === 'playing' && this.ballAttached) {
                this.launchBall();
            }
        });

        // Touch end - needed for proper touch handling
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
        });

        // Mobile pause button
        const pauseBtn = document.getElementById('btn-pause-mobile');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.state === 'playing') this.pause();
            });
            pauseBtn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this.state === 'playing') this.pause();
            });
        }
    }

    // ==========================================
    // RESPONSIVE SCALING ENGINE
    // ==========================================
    setupResponsive() {
        // Set up HiDPI canvas
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CANVAS_W * dpr;
        this.canvas.height = CANVAS_H * dpr;
        this.ctx.scale(dpr, dpr);
        // Canvas CSS size stays at 800x600 within the container;
        // container is scaled by CSS transform

        this.resizeGame();

        // Listen for resize, orientation change
        window.addEventListener('resize', () => this.resizeGame());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeGame(), 200);
        });

        // Fullscreen on double tap (mobile)
        if (this.isMobile) {
            let lastTap = 0;
            this.container.addEventListener('touchend', (e) => {
                const now = Date.now();
                if (now - lastTap < 300 && this.state === 'menu') {
                    this.requestFullscreen();
                }
                lastTap = now;
            });
        }
    }

    resizeGame() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        this.isPortrait = vh > vw;

        // Scale to fit 800x600 - no rotation, content stays upright
        const scaleX = vw / 800;
        const scaleY = vh / 600;
        this.scale = Math.min(scaleX, scaleY);
        const maxScale = this.isMobile ? Infinity : 1.2;
        this.scale = Math.min(this.scale, maxScale);
        this.container.style.transform = `scale(${this.scale})`;

        this.container.style.transformOrigin = 'center center';

        if (this.scale >= 0.95 && this.isMobile) {
            this.container.style.borderRadius = '0';
            this.container.style.boxShadow = 'none';
        } else {
            this.container.style.borderRadius = '12px';
            this.container.style.boxShadow = '0 0 40px rgba(0,150,255,0.3), 0 0 80px rgba(0,100,200,0.1)';
        }
    }

    // Convert screen coordinates to game canvas coordinates
    screenToGame(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const rx = clientX - rect.left;
        const ry = clientY - rect.top;
        return {
            x: rx * (CANVAS_W / rect.width),
            y: ry * (CANVAS_H / rect.height)
        };
    }

    requestFullscreen() {
        const el = document.documentElement;
        try {
            if (el.requestFullscreen) el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            else if (el.msRequestFullscreen) el.msRequestFullscreen();
        } catch (e) { /* silent */ }
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
        this.state = 'menu';
    }

    generateLevelButtons() {
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        for (let i = 0; i < TOTAL_LEVELS; i++) {
            const btn = document.createElement('button');
            btn.className = 'level-btn';
            const levelNum = i + 1;

            if (levelNum <= this.unlockedLevel) {
                btn.classList.add('unlocked');
                if (levelNum < this.unlockedLevel) btn.classList.add('completed');
                btn.innerHTML = `${levelNum}<div class="stars">${levelNum < this.unlockedLevel ? '⭐' : ''}</div>`;
                btn.onclick = () => this.startGame(i);
            } else {
                btn.classList.add('locked');
                btn.innerHTML = `🔒`;
            }

            grid.appendChild(btn);
        }
    }

    updateHighScoreDisplay() {
        document.getElementById('high-score-value').textContent = this.highScore.toLocaleString();
    }

    // ==========================================
    // GAME START / LEVEL SETUP
    // ==========================================
    startGame(levelIndex) {
        this.audio.init();
        this.currentLevel = levelIndex;
        this.score = 0;
        this.lives = 3;
        this.combo = 0;
        this.maxCombo = 0;
        this.loadLevel(levelIndex);

        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
        document.getElementById('hud').classList.remove('hidden');
        this.state = 'playing';
    }

    loadLevel(levelIndex) {
        const level = this.levels[levelIndex];
        this.bricks = [];
        this.powerups = [];
        this.lasers = [];
        this.activePowerups = {};
        this.clearPowerupTimers();

        this.paddle.w = PADDLE_BASE_W;
        this.paddle.x = CANVAS_W / 2;

        // Generate bricks
        for (let r = 0; r < level.rows; r++) {
            for (let c = 0; c < level.cols; c++) {
                const def = level.layout(r, c);
                if (!def) continue;

                const x = BRICK_OFFSET_X + c * (BRICK_W + BRICK_PAD);
                const y = BRICK_OFFSET_Y + r * (BRICK_H + BRICK_PAD);

                const brick = {
                    x, y, w: BRICK_W, h: BRICK_H,
                    type: def.type,
                    hp: def.hp || 1,
                    row: r,
                    col: c,
                    alive: true,
                    visible: def.type !== BRICK_HIDDEN,
                    revealed: def.type !== BRICK_HIDDEN,
                    moveDir: def.type === BRICK_MOVING ? (c % 2 === 0 ? 1 : -1) : 0,
                    moveSpeed: 0.5 + levelIndex * 0.05,
                    origX: x,
                    flash: 0,
                };

                if (def.type === BRICK_NORMAL) brick.hp = 1;
                else if (def.type === BRICK_EXPLOSIVE) brick.hp = 1;
                else if (def.type === BRICK_MULTIBALL) brick.hp = 1;
                else if (def.type === BRICK_HIDDEN) brick.hp = 1;
                else if (def.type === BRICK_MOVING) brick.hp = 1;

                if (def.hp) brick.hp = def.hp;

                this.bricks.push(brick);
            }
        }

        // Reset ball
        this.balls = [{
            x: CANVAS_W / 2,
            y: PADDLE_Y - BALL_R - 1,
            vx: 0,
            vy: 0,
            speed: level.ballSpeed,
            pierce: false,
        }];
        this.ballAttached = true;

        this.updateHUD();
    }

    launchBall() {
        if (!this.ballAttached || this.balls.length === 0) return;
        this.ballAttached = false;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        const speed = this.levels[this.currentLevel].ballSpeed;
        this.balls[0].vx = Math.cos(angle) * speed;
        this.balls[0].vy = Math.sin(angle) * speed;
    }

    // ==========================================
    // GAME LOOP
    // ==========================================
    gameLoop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 16.67, 2); // cap at 2x speed
        this.lastTime = timestamp;

        if (this.state === 'playing') {
            this.update(dt);
        }

        this.draw();
        this.animFrame = requestAnimationFrame((t) => this.gameLoop(t));
    }

    // ==========================================
    // UPDATE
    // ==========================================
    update(dt) {
        // Update paddle
        this.updatePaddle(dt);

        // Update balls
        this.updateBalls(dt);

        // Update bricks (moving)
        this.updateBricks(dt);

        // Update power-ups
        this.updatePowerups(dt);

        // Update lasers
        this.updateLasers(dt);

        // Update particles & floating texts
        this.particles.update();
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update();
            if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
        }

        // Laser auto-fire
        if (this.activePowerups[PU_LASER]) {
            this.laserCooldown -= dt;
            if (this.laserCooldown <= 0) {
                this.fireLaser();
                this.laserCooldown = 10;
            }
        }

        // Check level complete
        const remaining = this.bricks.filter(b => b.alive && b.type !== BRICK_HIDDEN || (b.alive && b.revealed));
        const allDestroyed = this.bricks.filter(b => b.alive).length === 0;
        if (allDestroyed) {
            this.levelComplete();
        }

        // Background stars
        for (const star of this.bgStars) {
            star.y += star.speed * dt;
            if (star.y > CANVAS_H) {
                star.y = 0;
                star.x = Math.random() * CANVAS_W;
            }
        }

        this.updateHUD();
    }

    updatePaddle(dt) {
        const speed = 8 * dt;

        if (this.useMouseControl) {
            const target = Math.max(this.paddle.w / 2, Math.min(CANVAS_W - this.paddle.w / 2, this.mouseX));
            const diff = target - this.paddle.x;
            this.paddle.x += diff * 0.25 * dt;
        } else {
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
                this.paddle.x -= speed;
            }
            if (this.keys['ArrowRight'] || this.keys['KeyD']) {
                this.paddle.x += speed;
            }
        }

        // Clamp
        this.paddle.x = Math.max(this.paddle.w / 2, Math.min(CANVAS_W - this.paddle.w / 2, this.paddle.x));

        // Attached ball follows paddle
        if (this.ballAttached && this.balls.length > 0) {
            this.balls[0].x = this.paddle.x;
            this.balls[0].y = PADDLE_Y - BALL_R - 1;
        }
    }

    updateBalls(dt) {
        for (let bi = this.balls.length - 1; bi >= 0; bi--) {
            const ball = this.balls[bi];
            if (this.ballAttached && bi === 0) continue;

            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;

            // Wall collisions
            if (ball.x - BALL_R < 0) {
                ball.x = BALL_R;
                ball.vx = Math.abs(ball.vx);
                this.audio.play('hit');
            }
            if (ball.x + BALL_R > CANVAS_W) {
                ball.x = CANVAS_W - BALL_R;
                ball.vx = -Math.abs(ball.vx);
                this.audio.play('hit');
            }
            if (ball.y - BALL_R < HUD_H) {
                ball.y = HUD_H + BALL_R;
                ball.vy = Math.abs(ball.vy);
                this.audio.play('hit');
            }

            // Bottom - lose ball
            if (ball.y + BALL_R > CANVAS_H) {
                this.balls.splice(bi, 1);
                if (this.balls.length === 0) {
                    this.loseLife();
                }
                continue;
            }

            // Paddle collision
            const px1 = this.paddle.x - this.paddle.w / 2;
            const px2 = this.paddle.x + this.paddle.w / 2;
            const py1 = PADDLE_Y;
            const py2 = PADDLE_Y + PADDLE_H;

            if (ball.vy > 0 &&
                ball.x + BALL_R > px1 && ball.x - BALL_R < px2 &&
                ball.y + BALL_R > py1 && ball.y - BALL_R < py2) {

                // Magnet: attach ball
                if (this.activePowerups[PU_MAGNET]) {
                    this.ballAttached = true;
                    ball.vx = 0;
                    ball.vy = 0;
                    ball.y = PADDLE_Y - BALL_R - 1;
                    this.audio.play('hit');
                    continue;
                }

                // Calculate bounce angle based on hit position
                const hitPos = (ball.x - this.paddle.x) / (this.paddle.w / 2); // -1 to 1
                const maxAngle = Math.PI * 0.38; // ~68 degrees
                const angle = hitPos * maxAngle - Math.PI / 2;

                const speed = ball.speed * (this.activePowerups[PU_SLOW] ? 0.65 : 1);
                ball.vx = Math.cos(angle) * speed;
                ball.vy = Math.sin(angle) * speed;

                // Ensure ball moves upward
                if (ball.vy > -1) ball.vy = -1;

                ball.y = py1 - BALL_R - 1;
                this.combo = 0;
                this.audio.play('hit');

                this.particles.emit(ball.x, ball.y, '#00d4ff', 5, 2, 15, 2);
            }

            // Brick collisions
            for (const brick of this.bricks) {
                if (!brick.alive) continue;
                if (!brick.visible && !brick.revealed) {
                    // Hidden brick - check collision to reveal
                    if (this.ballBrickCollision(ball, brick)) {
                        brick.visible = true;
                        brick.revealed = true;
                        this.hitBrick(brick, ball);
                        if (!ball.pierce) this.bounceBallOffBrick(ball, brick);
                    }
                    continue;
                }

                if (this.ballBrickCollision(ball, brick)) {
                    this.hitBrick(brick, ball);
                    if (!ball.pierce) {
                        this.bounceBallOffBrick(ball, brick);
                    }
                }
            }
        }
    }

    ballBrickCollision(ball, brick) {
        const bx = brick.x;
        const by = brick.y;
        const bw = brick.w;
        const bh = brick.h;

        // Find closest point on brick to ball
        const closestX = Math.max(bx, Math.min(ball.x, bx + bw));
        const closestY = Math.max(by, Math.min(ball.y, by + bh));
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;

        return (dx * dx + dy * dy) < (BALL_R * BALL_R);
    }

    bounceBallOffBrick(ball, brick) {
        const bx = brick.x + brick.w / 2;
        const by = brick.y + brick.h / 2;
        const dx = ball.x - bx;
        const dy = ball.y - by;

        if (Math.abs(dx / brick.w) > Math.abs(dy / brick.h)) {
            ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        } else {
            ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        }
    }

    hitBrick(brick, ball) {
        brick.hp--;
        brick.flash = 6;

        if (brick.hp <= 0) {
            brick.alive = false;
            this.onBrickDestroyed(brick, ball);
        } else {
            // Iron brick hit
            this.audio.play('iron');
            this.particles.emit(
                brick.x + brick.w / 2,
                brick.y + brick.h / 2,
                '#95a5a6', 5, 2, 15, 2
            );
        }
    }

    onBrickDestroyed(brick, ball) {
        const cx = brick.x + brick.w / 2;
        const cy = brick.y + brick.h / 2;

        // Combo
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        // Score (with combo multiplier)
        const baseScore = brick.type === BRICK_IRON ? 30 : 10;
        const comboMult = Math.min(this.combo, 10);
        const points = baseScore * comboMult;
        this.score += points;

        // Floating text
        if (this.combo >= 3) {
            this.floatingTexts.push(new FloatingText(cx, cy - 10, `${this.combo}x COMBO!`, '#ffcc00', 14 + Math.min(this.combo, 10)));
            this.audio.play('combo');
        }
        this.floatingTexts.push(new FloatingText(cx, cy + 5, `+${points}`, '#fff', 12));

        // Particles based on type
        const color = BRICK_COLORS[brick.row % BRICK_COLORS.length][0];
        switch (brick.type) {
            case BRICK_EXPLOSIVE:
                this.audio.play('explode');
                this.particles.emitExplosion(cx, cy, 40);
                // Destroy adjacent bricks
                this.explodeNearby(brick);
                break;
            case BRICK_MULTIBALL:
                this.audio.play('powerup');
                this.spawnExtraBalls(cx, cy, 2);
                this.particles.emit(cx, cy, '#9b59b6', 15, 3, 20, 3);
                break;
            default:
                this.audio.play('brick');
                this.particles.emit(cx, cy, color, 8, 3, 20, 2);
        }

        // Chance to drop power-up (20%)
        if (Math.random() < 0.2 && brick.type !== BRICK_MULTIBALL) {
            this.spawnPowerup(cx, cy);
        }
    }

    explodeNearby(brick) {
        for (const other of this.bricks) {
            if (!other.alive || other === brick) continue;
            const dx = Math.abs((other.x + other.w / 2) - (brick.x + brick.w / 2));
            const dy = Math.abs((other.y + other.h / 2) - (brick.y + brick.h / 2));
            if (dx < BRICK_W * 1.8 && dy < BRICK_H * 1.8) {
                other.hp -= 2;
                if (other.hp <= 0) {
                    other.alive = false;
                    const cx = other.x + other.w / 2;
                    const cy = other.y + other.h / 2;
                    this.particles.emit(cx, cy, '#ff6b6b', 6, 3, 15, 2);
                    this.score += 10;

                    // Chain explosion
                    if (other.type === BRICK_EXPLOSIVE) {
                        setTimeout(() => this.explodeNearby(other), 100);
                    }
                } else {
                    other.flash = 6;
                }

                // Reveal hidden bricks
                if (!other.revealed) {
                    other.visible = true;
                    other.revealed = true;
                }
            }
        }
    }

    spawnExtraBalls(x, y, count) {
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI / 2 + (i - (count - 1) / 2) * 0.5;
            const speed = this.levels[this.currentLevel].ballSpeed;
            this.balls.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                speed,
                pierce: this.activePowerups[PU_PIERCE] || false,
            });
        }
    }

    // ==========================================
    // POWER-UP SYSTEM
    // ==========================================
    spawnPowerup(x, y) {
        // Weighted random: life and laser are rarer
        const weights = [15, 8, 15, 10, 10, 8, 12, 5]; // expand, shrink, slow, pierce, magnet, laser, split, life
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let type = 0;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) { type = i; break; }
        }

        this.powerups.push({
            x, y, type,
            w: POWERUP_SIZE,
            h: POWERUP_SIZE,
            vy: POWERUP_SPEED,
        });
    }

    updatePowerups(dt) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const pu = this.powerups[i];
            pu.y += pu.vy * dt;

            // Collect with paddle
            const px1 = this.paddle.x - this.paddle.w / 2;
            const px2 = this.paddle.x + this.paddle.w / 2;
            if (pu.y + pu.h > PADDLE_Y && pu.y < PADDLE_Y + PADDLE_H &&
                pu.x + pu.w / 2 > px1 && pu.x - pu.w / 2 < px2) {
                this.collectPowerup(pu.type);
                this.powerups.splice(i, 1);
                continue;
            }

            // Off screen
            if (pu.y > CANVAS_H) {
                this.powerups.splice(i, 1);
            }
        }
    }

    collectPowerup(type) {
        this.audio.play('powerup');
        this.floatingTexts.push(new FloatingText(
            this.paddle.x, PADDLE_Y - 20,
            PU_EMOJIS[type] + ' ' + PU_NAMES[type],
            PU_COLORS[type], 14
        ));

        // Clear previous timer for this type
        if (this.powerupTimers[type]) {
            clearTimeout(this.powerupTimers[type]);
        }

        switch (type) {
            case PU_EXPAND:
                this.paddle.w = Math.min(180, this.paddle.w + 40);
                this.activePowerups[PU_EXPAND] = true;
                this.powerupTimers[type] = setTimeout(() => {
                    this.paddle.w = PADDLE_BASE_W;
                    delete this.activePowerups[PU_EXPAND];
                }, POWERUP_DURATION);
                break;

            case PU_SHRINK:
                this.paddle.w = Math.max(50, this.paddle.w - 30);
                this.activePowerups[PU_SHRINK] = true;
                this.powerupTimers[type] = setTimeout(() => {
                    this.paddle.w = PADDLE_BASE_W;
                    delete this.activePowerups[PU_SHRINK];
                }, POWERUP_DURATION);
                break;

            case PU_SLOW:
                this.activePowerups[PU_SLOW] = true;
                for (const ball of this.balls) {
                    ball.vx *= 0.65;
                    ball.vy *= 0.65;
                }
                this.powerupTimers[type] = setTimeout(() => {
                    delete this.activePowerups[PU_SLOW];
                    // Restore speed
                    for (const ball of this.balls) {
                        const speed = this.levels[this.currentLevel].ballSpeed;
                        const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                        if (currentSpeed > 0) {
                            const factor = speed / currentSpeed;
                            ball.vx *= factor;
                            ball.vy *= factor;
                        }
                    }
                }, POWERUP_DURATION);
                break;

            case PU_PIERCE:
                this.activePowerups[PU_PIERCE] = true;
                for (const ball of this.balls) ball.pierce = true;
                this.powerupTimers[type] = setTimeout(() => {
                    delete this.activePowerups[PU_PIERCE];
                    for (const ball of this.balls) ball.pierce = false;
                }, POWERUP_DURATION);
                break;

            case PU_MAGNET:
                this.activePowerups[PU_MAGNET] = true;
                this.powerupTimers[type] = setTimeout(() => {
                    delete this.activePowerups[PU_MAGNET];
                }, POWERUP_DURATION);
                break;

            case PU_LASER:
                this.activePowerups[PU_LASER] = true;
                this.laserCooldown = 0;
                this.powerupTimers[type] = setTimeout(() => {
                    delete this.activePowerups[PU_LASER];
                }, POWERUP_DURATION);
                break;

            case PU_SPLIT:
                for (const ball of [...this.balls]) {
                    if (this.balls.length >= 12) break;
                    this.balls.push({
                        x: ball.x,
                        y: ball.y,
                        vx: -ball.vx + (Math.random() - 0.5),
                        vy: ball.vy,
                        speed: ball.speed,
                        pierce: ball.pierce,
                    });
                }
                break;

            case PU_LIFE:
                if (this.lives < MAX_LIVES) {
                    this.lives++;
                }
                break;
        }
    }

    clearPowerupTimers() {
        for (const key of Object.keys(this.powerupTimers)) {
            clearTimeout(this.powerupTimers[key]);
        }
        this.powerupTimers = {};
    }

    // ==========================================
    // LASER SYSTEM
    // ==========================================
    fireLaser() {
        this.audio.play('laser');
        const px = this.paddle.x;
        this.lasers.push(
            { x: px - this.paddle.w / 2 + 5, y: PADDLE_Y, w: 3, h: 12 },
            { x: px + this.paddle.w / 2 - 5, y: PADDLE_Y, w: 3, h: 12 }
        );
    }

    updateLasers(dt) {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            laser.y -= 8 * dt;

            if (laser.y < HUD_H) {
                this.lasers.splice(i, 1);
                continue;
            }

            // Check brick hits
            for (const brick of this.bricks) {
                if (!brick.alive) continue;
                if (!brick.visible) continue;

                if (laser.x + laser.w > brick.x && laser.x < brick.x + brick.w &&
                    laser.y < brick.y + brick.h && laser.y + laser.h > brick.y) {
                    this.hitBrick(brick, null);
                    this.lasers.splice(i, 1);
                    break;
                }
            }
        }
    }

    // ==========================================
    // BRICK UPDATE (MOVING)
    // ==========================================
    updateBricks(dt) {
        for (const brick of this.bricks) {
            if (!brick.alive) continue;
            if (brick.flash > 0) brick.flash -= dt;

            if (brick.type === BRICK_MOVING) {
                brick.x += brick.moveDir * brick.moveSpeed * dt;
                const minX = BRICK_OFFSET_X;
                const maxX = CANVAS_W - BRICK_OFFSET_X - brick.w;
                if (brick.x < minX) {
                    brick.x = minX;
                    brick.moveDir = 1;
                }
                if (brick.x > maxX) {
                    brick.x = maxX;
                    brick.moveDir = -1;
                }
            }
        }
    }

    // ==========================================
    // LIFE / GAME OVER / LEVEL
    // ==========================================
    loseLife() {
        this.lives--;
        this.combo = 0;
        this.audio.play('lose');

        if (this.lives <= 0) {
            this.gameOver();
            return;
        }

        // Reset ball
        this.activePowerups = {};
        this.clearPowerupTimers();
        this.paddle.w = PADDLE_BASE_W;
        this.powerups = [];
        this.lasers = [];

        this.balls = [{
            x: this.paddle.x,
            y: PADDLE_Y - BALL_R - 1,
            vx: 0,
            vy: 0,
            speed: this.levels[this.currentLevel].ballSpeed,
            pierce: false,
        }];
        this.ballAttached = true;
    }

    gameOver() {
        this.state = 'gameover';

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('breakout_highscore', this.highScore.toString());
        }

        document.getElementById('gameover-title').textContent = '遊戲結束';
        document.getElementById('gameover-score').textContent = `分數: ${this.score.toLocaleString()}`;
        document.getElementById('gameover-high').textContent = `最高分: ${this.highScore.toLocaleString()}`;
        document.getElementById('gameover-overlay').classList.remove('hidden');
    }

    levelComplete() {
        this.state = 'levelcomplete';
        this.audio.play('win');

        // Bonus
        const lifeBonus = this.lives * 200;
        const comboBonus = this.maxCombo * 50;
        const totalBonus = lifeBonus + comboBonus;
        this.score += totalBonus;

        // Unlock next level
        if (this.currentLevel + 2 > this.unlockedLevel) {
            this.unlockedLevel = Math.min(TOTAL_LEVELS, this.currentLevel + 2);
            localStorage.setItem('breakout_unlocked', this.unlockedLevel.toString());
        }

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('breakout_highscore', this.highScore.toString());
        }

        document.getElementById('level-score').textContent = `分數: ${this.score.toLocaleString()}`;
        document.getElementById('level-bonus').textContent = `過關獎勵: +${totalBonus} (生命 ${lifeBonus} + 連擊 ${comboBonus})`;
        document.getElementById('level-complete-overlay').classList.remove('hidden');

        const nextBtn = document.getElementById('btn-next-level');
        if (this.currentLevel >= TOTAL_LEVELS - 1) {
            nextBtn.textContent = '🎉 通關！回主選單';
            nextBtn.onclick = () => this.quitToMenu();
        } else {
            nextBtn.textContent = '下一關';
            nextBtn.onclick = () => this.nextLevel();
        }
    }

    nextLevel() {
        this.currentLevel++;
        this.loadLevel(this.currentLevel);
        document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
        this.state = 'playing';
    }

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        document.getElementById('pause-overlay').classList.remove('hidden');
    }

    resume() {
        this.state = 'playing';
        document.getElementById('pause-overlay').classList.add('hidden');
    }

    quitToMenu() {
        this.state = 'menu';
        this.clearPowerupTimers();
        this.updateHighScoreDisplay();
        this.generateLevelButtons();
        this.showScreen('start-screen');
    }

    updateHUD() {
        let heartsStr = '';
        for (let i = 0; i < this.lives; i++) heartsStr += '❤️';
        for (let i = this.lives; i < MAX_LIVES; i++) heartsStr += '🖤';
        document.getElementById('hud-lives').textContent = heartsStr;
        document.getElementById('hud-score').textContent = `分數: ${this.score.toLocaleString()}`;
        document.getElementById('hud-level').textContent = `第 ${this.currentLevel + 1} 關 - ${this.levels[this.currentLevel].name}`;

        // Combo display
        const comboEl = document.getElementById('hud-combo');
        if (this.combo >= 3) {
            comboEl.textContent = `🔥 ${this.combo}x COMBO`;
            comboEl.style.fontSize = `${14 + Math.min(this.combo, 10)}px`;
        } else {
            comboEl.textContent = '';
        }

        // Active powerups
        const puNames = Object.keys(this.activePowerups).map(k => PU_EMOJIS[k]).join(' ');
        document.getElementById('hud-powerup').textContent = puNames;
    }

    // ==========================================
    // DRAW
    // ==========================================
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // Background
        this.drawBackground(ctx);

        if (this.state === 'menu') return;

        // Bricks
        this.drawBricks(ctx);

        // Power-ups
        this.drawPowerups(ctx);

        // Lasers
        this.drawLasers(ctx);

        // Balls
        this.drawBalls(ctx);

        // Paddle
        this.drawPaddle(ctx);

        // Particles
        this.particles.draw(ctx);

        // Floating texts
        for (const ft of this.floatingTexts) ft.draw(ctx);

        // "Click to launch" hint
        if (this.ballAttached && this.state === 'playing') {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '14px "Noto Sans TC", sans-serif';
            ctx.textAlign = 'center';
            const launchHint = this.isMobile ? '👆 點擊螢幕發射' : '點擊或按空白鍵發射';
            ctx.fillText(launchHint, CANVAS_W / 2, PADDLE_Y - 30);
        }
    }

    drawBackground(ctx) {
        // Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        grad.addColorStop(0, '#0a0a1a');
        grad.addColorStop(0.5, '#0d0d2b');
        grad.addColorStop(1, '#0a0a1a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Stars
        for (const star of this.bgStars) {
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = '#fff';
            ctx.fillRect(star.x, star.y, star.size, star.size);
        }
        ctx.globalAlpha = 1;
    }

    drawPaddle(ctx) {
        const px = this.paddle.x - this.paddle.w / 2;
        const py = PADDLE_Y;
        const pw = this.paddle.w;
        const ph = PADDLE_H;

        // Glow
        ctx.shadowColor = this.activePowerups[PU_MAGNET] ? '#cc44ff' :
                          this.activePowerups[PU_LASER] ? '#44ffff' : '#00d4ff';
        ctx.shadowBlur = 12;

        // Paddle body
        const grad = ctx.createLinearGradient(px, py, px, py + ph);
        grad.addColorStop(0, this.activePowerups[PU_MAGNET] ? '#cc44ff' :
                             this.activePowerups[PU_LASER] ? '#44ffff' : '#00d4ff');
        grad.addColorStop(1, this.activePowerups[PU_MAGNET] ? '#8833aa' :
                             this.activePowerups[PU_LASER] ? '#2299aa' : '#0066cc');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 6);
        ctx.fill();

        // Center line
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(px + pw / 2 - 1, py + 2, 2, ph - 4);

        ctx.shadowBlur = 0;

        // Laser indicators
        if (this.activePowerups[PU_LASER]) {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(px + 3, py - 3, 4, 3);
            ctx.fillRect(px + pw - 7, py - 3, 4, 3);
        }
    }

    drawBalls(ctx) {
        for (const ball of this.balls) {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);

            if (ball.pierce) {
                ctx.fillStyle = '#ffcc00';
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur = 10;
            } else {
                ctx.fillStyle = '#fff';
                ctx.shadowColor = '#00d4ff';
                ctx.shadowBlur = 8;
            }

            ctx.fill();

            // Inner highlight
            ctx.beginPath();
            ctx.arc(ball.x - 1, ball.y - 1, BALL_R * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fill();

            ctx.shadowBlur = 0;

            // Trail
            if (!this.ballAttached) {
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.arc(ball.x - ball.vx * 0.5, ball.y - ball.vy * 0.5, BALL_R * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = ball.pierce ? '#ffcc00' : '#00d4ff';
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    }

    drawBricks(ctx) {
        for (const brick of this.bricks) {
            if (!brick.alive || !brick.visible) continue;

            const x = brick.x;
            const y = brick.y;
            const w = brick.w;
            const h = brick.h;

            // Flash effect
            if (brick.flash > 0) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.roundRect(x - 1, y - 1, w + 2, h + 2, 3);
                ctx.fill();
            }

            let grad;
            switch (brick.type) {
                case BRICK_IRON: {
                    grad = ctx.createLinearGradient(x, y, x, y + h);
                    const intensity = brick.hp / 4;
                    grad.addColorStop(0, `rgb(${150 + intensity * 40}, ${160 + intensity * 40}, ${170 + intensity * 40})`);
                    grad.addColorStop(1, `rgb(${100 + intensity * 30}, ${110 + intensity * 30}, ${120 + intensity * 30})`);
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 3);
                    ctx.fill();

                    // HP indicator (bolts)
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 10px Orbitron';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${brick.hp}`, x + w / 2, y + h / 2 + 4);

                    // Border
                    ctx.strokeStyle = '#bdc3c7';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 3);
                    ctx.stroke();
                    break;
                }
                case BRICK_EXPLOSIVE: {
                    grad = ctx.createLinearGradient(x, y, x, y + h);
                    grad.addColorStop(0, '#f39c12');
                    grad.addColorStop(1, '#e74c3c');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 3);
                    ctx.fill();

                    // Explosive icon
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('💥', x + w / 2, y + h / 2 + 5);
                    break;
                }
                case BRICK_MULTIBALL: {
                    grad = ctx.createLinearGradient(x, y, x, y + h);
                    grad.addColorStop(0, '#9b59b6');
                    grad.addColorStop(1, '#8e44ad');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 3);
                    ctx.fill();

                    ctx.fillStyle = '#fff';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('⊕⊕', x + w / 2, y + h / 2 + 4);
                    break;
                }
                case BRICK_HIDDEN: {
                    grad = ctx.createLinearGradient(x, y, x, y + h);
                    grad.addColorStop(0, '#444466');
                    grad.addColorStop(1, '#333355');
                    ctx.fillStyle = grad;
                    ctx.globalAlpha = 0.7;
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 3);
                    ctx.fill();
                    ctx.globalAlpha = 1;

                    ctx.strokeStyle = '#555577';
                    ctx.setLineDash([3, 3]);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 3);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    break;
                }
                case BRICK_MOVING: {
                    grad = ctx.createLinearGradient(x, y, x, y + h);
                    grad.addColorStop(0, '#1abc9c');
                    grad.addColorStop(1, '#16a085');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 3);
                    ctx.fill();

                    // Direction arrows
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(brick.moveDir > 0 ? '→' : '←', x + w / 2, y + h / 2 + 4);
                    break;
                }
                default: {
                    // Normal brick
                    const colors = BRICK_COLORS[brick.row % BRICK_COLORS.length];
                    grad = ctx.createLinearGradient(x, y, x, y + h);
                    grad.addColorStop(0, colors[0]);
                    grad.addColorStop(1, colors[1]);
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, 3);
                    ctx.fill();

                    // Highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.15)';
                    ctx.fillRect(x + 2, y + 1, w - 4, h / 3);
                    break;
                }
            }
        }
    }

    drawPowerups(ctx) {
        for (const pu of this.powerups) {
            const cx = pu.x;
            const cy = pu.y;
            const s = POWERUP_SIZE;

            // Glow
            ctx.shadowColor = PU_COLORS[pu.type];
            ctx.shadowBlur = 8;

            // Background circle
            ctx.fillStyle = PU_COLORS[pu.type] + '33';
            ctx.beginPath();
            ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = PU_COLORS[pu.type];
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
            ctx.stroke();

            // Emoji
            ctx.shadowBlur = 0;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(PU_EMOJIS[pu.type], cx, cy + 5);
        }
        ctx.shadowBlur = 0;
    }

    drawLasers(ctx) {
        for (const laser of this.lasers) {
            ctx.fillStyle = '#ff4444';
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 6;
            ctx.fillRect(laser.x, laser.y, laser.w, laser.h);
        }
        ctx.shadowBlur = 0;
    }
}

// ==========================================
// INITIALIZE
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    new BreakoutGame();
});
