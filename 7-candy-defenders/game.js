// game.js
// The 'Kingdom Rush' style engine. Handles waves, paths, rendering, and logic.

const V_WIDTH = 1024;
const V_HEIGHT = 768;

const Game = {
    canvas: null,
    ctx: null,
    lastTime: 0,
    
    // State
    hearts: 20,
    gold: 150,
    wave: 1,
    waveActive: false,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    
    // Entities
    enemies: [],
    towers: [],
    projectiles: [],
    
    // Map Definition
    path: [
        {x: -50, y: 150},
        {x: 200, y: 150},
        {x: 350, y: 350},
        {x: 700, y: 350},
        {x: 850, y: 600},
        {x: 1100, y: 600} // End point
    ],
    
    // Predefined tower placement slots
    nodes: [
        { x: 150, y: 250, occupied: false },
        { x: 400, y: 200, occupied: false },
        { x: 450, y: 480, occupied: false },
        { x: 750, y: 200, occupied: false },
        { x: 800, y: 450, occupied: false }
    ],
    
    selectedNodeIndex: -1,

    // Definitions
    towerDefs: {
        'DPS':    { cost: 100, range: 150, damage: 15, cooldown: 1.0, color: '#f8a5c2', type: 'basic', name: 'Cupcake' },
        'SNIPER': { cost: 150, range: 300, damage: 40, cooldown: 2.5, color: '#63cdda', type: 'anti-air', name: 'Lollipop' },
        'SLOW':   { cost: 120, range: 120, damage: 5, cooldown: 1.5, color: '#d1ccc0', type: 'slow', name: 'Fountain' }
    },
    
    enemyDefs: {
        'RUNNER': { hp: 30, speed: 60, radius: 15, color: '#786fa6', air: false },
        'BRICK':  { hp: 100, speed: 30, radius: 25, color: '#596275', air: false },
        'FLOAT':  { hp: 40, speed: 45, radius: 18, color: '#f19066', air: true },
        'BOSS':   { hp: 500, speed: 20, radius: 40, color: '#e66767', air: false }
    },

    init: function() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Handle responsive canvas scaling internally to maintain V_WIDTH/V_HEIGHT coords
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Input handling
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Sync UI
        this.updateHUD();
        
        // Start Loops
        MathEngine.init();
        requestAnimationFrame((t) => this.loop(t));
    },

    resize: function() {
        // Set actual pixel dimensions to virtual resolution
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
        
        // Scaling formula
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

    // ----------------------------------------------------------------
    // INPUT & BUILDING
    // ----------------------------------------------------------------
    
    handleClick: function(e) {
        // Translate client coords to canvas virtual coords
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = V_WIDTH / rect.width;
        const scaleY = V_HEIGHT / rect.height;
        
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        
        // Check if we tapped a node
        let clickedNode = false;
        for (let i = 0; i < this.nodes.length; i++) {
            let node = this.nodes[i];
            const dist = Math.hypot(node.x - clickX, node.y - clickY);
            if (dist < 40 && !node.occupied) { // Large 80px hitbox
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
        // Position UI over HTML coords
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
            
            this.towers.push({
                x: node.x,
                y: node.y,
                type: type,
                def: def,
                timer: 0
            });
            
            this.closeMenu();
        } else {
            // Flash red or slight feedback on gold UI
            const uiGold = document.getElementById('ui-gold');
            uiGold.style.color = 'red';
            setTimeout(() => uiGold.style.color = '', 300);
        }
    },

    // ----------------------------------------------------------------
    // LOGIC UPDATE
    // ----------------------------------------------------------------

    loop: function(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; // Cap delta
        this.lastTime = timestamp;

        this.update(dt);
        this.render();

        if (this.hearts > 0) {
            requestAnimationFrame((t) => this.loop(t));
        } else {
            document.getElementById('game-over-screen').style.display = 'flex';
        }
    },

    update: function(dt) {
        // Spawning
        if (this.waveActive && this.enemiesToSpawn > 0) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy();
                this.enemiesToSpawn--;
                this.spawnTimer = 1.5; // seconds between spawns
            }
        }

        // Enemy movement
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            
            // Slow effect decay
            let currentSpeed = e.baseSpeed;
            if (e.slowTimer > 0) {
                e.slowTimer -= dt;
                currentSpeed *= 0.5;
            }
            
            // Move towards next waypoint
            let target = this.path[e.pathIndex];
            let dx = target.x - e.x;
            let dy = target.y - e.y;
            let dist = Math.hypot(dx, dy);
            
            if (dist < 5) {
                e.pathIndex++;
                if (e.pathIndex >= this.path.length) {
                    // Reached end!
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

        // Tower combat
        this.towers.forEach(t => {
            t.timer -= dt;
            if (t.timer <= 0) {
                // Find target
                let target = null;
                for (let e of this.enemies) {
                    // Snipers only target air if present (simple priority), others ignore air
                    if (e.isAir && t.def.type !== 'anti-air') continue;
                    
                    let dist = Math.hypot(e.x - t.x, e.y - t.y);
                    if (dist <= t.def.range) {
                        target = e;
                        break; // target first in range
                    }
                }
                
                if (target) {
                    this.fireProjectile(t, target);
                    t.timer = t.def.cooldown;
                }
            }
        });

        // Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            let target = p.target;
            
            // Homing logic
            let dx = target.x - p.x;
            let dy = target.y - p.y;
            let dist = Math.hypot(dx, dy);
            
            if (dist < 15 || target.hp <= 0) {
                // Hit!
                target.hp -= p.damage;
                if (p.isSlow) target.slowTimer = 2.0; // 2 seconds of slow
                
                this.projectiles.splice(i, 1);
                
                // Death check
                if (target.hp <= 0) {
                    const idx = this.enemies.indexOf(target);
                    if (idx > -1) {
                        // Sparkle effect could go here
                        this.enemies.splice(idx, 1);
                    }
                }
            } else {
                let pSpeed = 400 * dt;
                p.x += (dx / dist) * pSpeed;
                p.y += (dy / dist) * pSpeed;
            }
        }
        
        // Wave Check
        if (this.waveActive && this.enemiesToSpawn === 0 && this.enemies.length === 0) {
            this.endWave();
        }
    },

    spawnEnemy: function() {
        // Wave scaling logic
        let type = 'RUNNER';
        if (this.wave > 2 && Math.random() > 0.6) type = 'BRICK';
        if (this.wave > 3 && Math.random() > 0.8) type = 'FLOAT';
        
        let isBoss = false;
        if (this.enemiesToSpawn === 1 && this.wave % 5 === 0) {
            type = 'BOSS';
            isBoss = true;
        }

        let base = this.enemyDefs[type];
        
        // HP Scaling
        let scaledHp = base.hp * (1 + this.wave * (isBoss ? 0.25 : 0.12));
        let scaledSpeed = base.speed * (1 + this.wave * 0.03);

        this.enemies.push({
            x: this.path[0].x,
            y: this.path[0].y,
            pathIndex: 1,
            hp: scaledHp,
            maxHp: scaledHp,
            baseSpeed: scaledSpeed,
            radius: base.radius,
            color: base.color,
            isAir: base.air,
            isBoss: isBoss,
            slowTimer: 0
        });
    },

    fireProjectile: function(tower, target) {
        this.projectiles.push({
            x: tower.x,
            y: tower.y,
            target: target,
            damage: tower.def.damage,
            color: tower.def.color,
            isSlow: tower.def.type === 'slow'
        });
    },

    // ----------------------------------------------------------------
    // RENDERING
    // ----------------------------------------------------------------

    render: function() {
        // Clear background
        this.ctx.fillStyle = '#A5E6A1';
        this.ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

        // Draw Path (Cookie Crumb Road)
        this.ctx.strokeStyle = '#F7D794';
        this.ctx.lineWidth = 40;
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(this.path[0].x, this.path[0].y);
        for(let i=1; i<this.path.length; i++) {
            this.ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        this.ctx.stroke();

        // Draw Nodes
        this.nodes.forEach((n, idx) => {
            this.ctx.fillStyle = n.occupied ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.6)';
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, 25, 0, Math.PI*2);
            this.ctx.fill();
            if (this.selectedNodeIndex === idx && !n.occupied) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }
        });

        // Draw Towers
        this.towers.forEach(t => {
            // Base shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y+5, 20, 0, Math.PI*2);
            this.ctx.fill();

            // Tower Body
            this.ctx.fillStyle = t.def.color;
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, 20, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Little indicator
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(t.def.name[0], t.x, t.y+4);
        });

        // Draw Enemies
        this.enemies.forEach(e => {
            // Shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y+e.radius*0.5, e.radius, 0, Math.PI*2);
            this.ctx.fill();

            // Body
            this.ctx.fillStyle = e.slowTimer > 0 ? '#82ccdd' : e.color; // Freeze effect color
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            // Health bar
            let hpPercent = e.hp / e.maxHp;
            this.ctx.fillStyle = '#eb2f06';
            this.ctx.fillRect(e.x - 15, e.y - e.radius - 10, 30, 4);
            this.ctx.fillStyle = '#78e08f';
            this.ctx.fillRect(e.x - 15, e.y - e.radius - 10, 30 * hpPercent, 4);
            
            if(e.isAir) {
               // Little wings or visual indicator
               this.ctx.fillStyle = '#fff';
               this.ctx.fillRect(e.x-e.radius-5, e.y, 10, 5);
               this.ctx.fillRect(e.x+e.radius-5, e.y, 10, 5);
            }
        });

        // Draw Projectiles
        this.projectiles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 6, 0, Math.PI*2);
            this.ctx.fill();
        });
    }
};

// Boot
window.onload = () => Game.init();
