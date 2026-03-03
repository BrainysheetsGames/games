// game.js

const V_WIDTH = 1024;
const V_HEIGHT = 768;

const Game = {
    canvas: null,
    ctx: null,
    lastTime: 0,
    
    hearts: 20,
    gold: 150,
    wave: 1,
    waveActive: false,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    
    enemies: [],
    towers: [],
    projectiles: [],
    
    path: [
        {x: -50, y: 150}, {x: 200, y: 150}, {x: 350, y: 350},
        {x: 700, y: 350}, {x: 850, y: 600}, {x: 1100, y: 600}
    ],
    
    nodes: [
        { x: 150, y: 250, occupied: false }, { x: 400, y: 200, occupied: false },
        { x: 450, y: 480, occupied: false }, { x: 750, y: 200, occupied: false },
        { x: 800, y: 450, occupied: false }
    ],
    selectedNodeIndex: -1,

    // ARTWORK DEFINITIONS (Using High-Res Emoji as Vector Art)
    towerDefs: {
        'DPS':    { cost: 100, range: 150, damage: 15, cooldown: 1.0, type: 'basic', emoji: '🧁', projColor: '#ff9ff3' },
        'SNIPER': { cost: 150, range: 300, damage: 40, cooldown: 2.5, type: 'anti-air', emoji: '🍭', projColor: '#48dbfb' },
        'SLOW':   { cost: 120, range: 120, damage: 5, cooldown: 1.5, type: 'slow', emoji: '⛲', projColor: '#54a0ff' }
    },
    
    enemyDefs: {
        'RUNNER': { hp: 30, speed: 60, radius: 20, air: false, emoji: '🍬' },
        'BRICK':  { hp: 100, speed: 30, radius: 25, air: false, emoji: '🍫' },
        'FLOAT':  { hp: 40, speed: 45, radius: 22, air: true, emoji: '🍡' },
        'BOSS':   { hp: 500, speed: 20, radius: 40, air: false, emoji: '🍩' }
    },

    init: function() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        this.updateHUD();
        MathEngine.init();
        requestAnimationFrame((t) => this.loop(t));
    },

    resize: function() {
        this.canvas.width = V_WIDTH;
        this.canvas.height = V_HEIGHT;
    },

    addGold: function(amount) {
        this.gold += amount;
        this.updateHUD();
    },

    updateHUD: function() {
        document.getElementById('ui-hearts').innerText = this.hearts;
        document.getElementById('ui-wave').innerText = this.wave;
        document.getElementById('ui-gold').innerText = this.gold;
    },

    startWave: function() {
        if (this.waveActive) return;
        this.waveActive = true;
        document.getElementById('start-wave-btn').style.display = 'none';
        this.enemiesToSpawn = 5 + (this.wave * 2);
        this.spawnTimer = 0;
    },
    
    endWave: function() {
        this.waveActive = false;
        this.wave++;
        this.updateHUD();
        document.getElementById('start-wave-btn').style.display = 'block';
        document.getElementById('start-wave-btn').innerText = `Start Wave ${this.wave}`;
    },
    
    handleClick: function(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = V_WIDTH / rect.width;
        const scaleY = V_HEIGHT / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        
        let clickedNode = false;
        for (let i = 0; i < this.nodes.length; i++) {
            let node = this.nodes[i];
            if (Math.hypot(node.x - clickX, node.y - clickY) < 40 && !node.occupied) {
                this.selectedNodeIndex = i;
                this.openMenu(e.clientX, e.clientY);
                clickedNode = true;
                break;
            }
        }
        if (!clickedNode) this.closeMenu();
    },

    openMenu: function(screenX, screenY) {
        const menu = document.getElementById('build-menu');
        menu.style.display = 'flex';
        menu.style.left = screenX + 'px';
        menu.style.top = screenY + 'px';
    },

    closeMenu: function() {
        document.getElementById('build-menu').style.display = 'none';
        this.selectedNodeIndex = -1;
    },

    buyTower: function(type) {
        const def = this.towerDefs[type];
        if (this.gold >= def.cost && this.selectedNodeIndex !== -1) {
            this.gold -= def.cost;
            this.updateHUD();
            
            const node = this.nodes[this.selectedNodeIndex];
            node.occupied = true;
            this.towers.push({ x: node.x, y: node.y, type: type, def: def, timer: 0 });
            this.closeMenu();
        } else {
            const uiGold = document.getElementById('ui-gold');
            uiGold.style.color = 'red';
            setTimeout(() => uiGold.style.color = '', 300);
        }
    },

    loop: function(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; 
        this.lastTime = timestamp;

        this.update(dt);
        this.render();

        if (this.hearts > 0) requestAnimationFrame((t) => this.loop(t));
        else document.getElementById('game-over-screen').style.display = 'flex';
    },

    update: function(dt) {
        if (this.waveActive && this.enemiesToSpawn > 0) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy();
                this.enemiesToSpawn--;
                this.spawnTimer = 1.5; 
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            let currentSpeed = e.baseSpeed;
            if (e.slowTimer > 0) { e.slowTimer -= dt; currentSpeed *= 0.5; }
            
            let target = this.path[e.pathIndex];
            let dx = target.x - e.x;
            let dy = target.y - e.y;
            let dist = Math.hypot(dx, dy);
            
            if (dist < 5) {
                e.pathIndex++;
                if (e.pathIndex >= this.path.length) {
                    this.hearts -= (e.isBoss ? 5 : 1);
                    this.updateHUD();
                    this.enemies.splice(i, 1);
                    continue;
                }
            } else {
                e.x += (dx / dist) * currentSpeed * dt;
                e.y += (dy / dist) * currentSpeed * dt;
            }
        }

        this.towers.forEach(t => {
            t.timer -= dt;
            if (t.timer <= 0) {
                let target = null;
                for (let e of this.enemies) {
                    if (e.isAir && t.def.type !== 'anti-air') continue;
                    if (Math.hypot(e.x - t.x, e.y - t.y) <= t.def.range) {
                        target = e;
                        break; 
                    }
                }
                if (target) {
                    this.projectiles.push({
                        x: t.x, y: t.y - 15, target: target,
                        damage: t.def.damage, color: t.def.projColor, isSlow: t.def.type === 'slow'
                    });
                    t.timer = t.def.cooldown;
                }
            }
        });

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            let target = p.target;
            let dx = target.x - p.x;
            let dy = target.y - p.y;
            let dist = Math.hypot(dx, dy);
            
            if (dist < 15 || target.hp <= 0) {
                target.hp -= p.damage;
                if (p.isSlow) target.slowTimer = 2.0; 
                this.projectiles.splice(i, 1);
                
                if (target.hp <= 0) {
                    const idx = this.enemies.indexOf(target);
                    if (idx > -1) this.enemies.splice(idx, 1);
                }
            } else {
                let pSpeed = 400 * dt;
                p.x += (dx / dist) * pSpeed;
                p.y += (dy / dist) * pSpeed;
            }
        }
        
        if (this.waveActive && this.enemiesToSpawn === 0 && this.enemies.length === 0) {
            this.endWave();
        }
    },

    spawnEnemy: function() {
        let type = 'RUNNER';
        if (this.wave > 2 && Math.random() > 0.6) type = 'BRICK';
        if (this.wave > 3 && Math.random() > 0.8) type = 'FLOAT';
        
        let isBoss = (this.enemiesToSpawn === 1 && this.wave % 5 === 0);
        if (isBoss) type = 'BOSS';

        let base = this.enemyDefs[type];
        let scaledHp = base.hp * (1 + this.wave * (isBoss ? 0.25 : 0.12));

        this.enemies.push({
            x: this.path[0].x, y: this.path[0].y, pathIndex: 1,
            hp: scaledHp, maxHp: scaledHp, baseSpeed: base.speed * (1 + this.wave * 0.03),
            radius: base.radius, emoji: base.emoji, isAir: base.air, isBoss: isBoss, slowTimer: 0
        });
    },

    render: function() {
        this.ctx.fillStyle = '#A5E6A1';
        this.ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

        // Path Artwork (Crumb border + fill)
        this.ctx.strokeStyle = '#e1b12c'; // Darker border
        this.ctx.lineWidth = 48;
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(this.path[0].x, this.path[0].y);
        for(let i=1; i<this.path.length; i++) this.ctx.lineTo(this.path[i].x, this.path[i].y);
        this.ctx.stroke();

        this.ctx.strokeStyle = '#F7D794'; // Inner crumb path
        this.ctx.lineWidth = 40;
        this.ctx.stroke();

        // Nodes (Build spots)
        this.nodes.forEach((n, idx) => {
            this.ctx.fillStyle = n.occupied ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.7)';
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, 20, 0, Math.PI*2);
            this.ctx.fill();
            if (this.selectedNodeIndex === idx && !n.occupied) {
                this.ctx.strokeStyle = '#ff6b81';
                this.ctx.lineWidth = 4;
                this.ctx.stroke();
            }
        });

        // Drawn Towers (Pedestal + Artwork)
        this.towers.forEach(t => {
            // Shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.beginPath();
            this.ctx.ellipse(t.x, t.y + 12, 22, 10, 0, 0, Math.PI*2);
            this.ctx.fill();

            // Pedestal Base
            this.ctx.fillStyle = '#ecf0f1';
            this.ctx.beginPath();
            this.ctx.ellipse(t.x, t.y + 8, 20, 10, 0, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#bdc3c7';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // High-Res Artwork
            this.ctx.font = '36px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(t.def.emoji, t.x, t.y - 10);
        });

        // Enemies
        this.enemies.forEach(e => {
            let drawY = e.isAir ? e.y - 15 : e.y; // Make floaters hover higher
            
            // Drop Shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.beginPath();
            this.ctx.ellipse(e.x, e.y + 10, e.radius, e.radius/2, 0, 0, Math.PI*2);
            this.ctx.fill();

            // Ice block visual if slowed
            if (e.slowTimer > 0) {
                this.ctx.fillStyle = 'rgba(72, 219, 251, 0.4)';
                this.ctx.beginPath();
                this.ctx.arc(e.x, drawY, e.radius + 5, 0, Math.PI*2);
                this.ctx.fill();
            }

            // Entity Artwork
            this.ctx.font = `${e.isBoss ? 50 : 32}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(e.emoji, e.x, drawY);

            // Health bar UI
            let hpPercent = e.hp / e.maxHp;
            this.ctx.fillStyle = '#eb2f06';
            this.ctx.fillRect(e.x - 15, drawY - e.radius - 10, 30, 5);
            this.ctx.fillStyle = '#78e08f';
            this.ctx.fillRect(e.x - 15, drawY - e.radius - 10, 30 * hpPercent, 5);
        });

        // Projectiles (Gumballs / Water blasts)
        this.projectiles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 8, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        });
    }
};
