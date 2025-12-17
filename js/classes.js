/**
 * ============================================================
 * GAME CLASSES - Player, Boss, Particles, etc.
 * ============================================================
 */

const CONFIG = {
    gravity: 0.6,
    friction: 0.82,
    airResistance: 0.94,
    moveSpeed: 1.2,
    maxSpeed: 8,
    jumpForce: -14,
    wallJumpForceX: 12,
    wallJumpForceY: -13,
    wallSlideSpeed: 2.5,
    dashForce: 18,
    dashCooldown: 45,
    attackCooldown: 25,
    attackDamage: 40,
    recoilForce: 16,
    coyoteTime: 6,
    jumpBuffer: 5,
    variableJump: 0.5,
    maxJumps: 2,
    cooldownShot: 35,
    cooldownHeal: 500,
    healAmount: 30,
    projectileSpeed: 15,
    projectileDamage: 20,
    bossHp: 500
};

// ============================================================
// PARTICLE
// ============================================================
class Particle {
    constructor(x, y, color, speed, life, type = 'square') {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * speed;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 4 + 2;
        this.type = type;
        this.gravity = 0.15;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life--;
        this.size *= 0.96;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        
        if (this.type === 'spark') {
            ctx.translate(this.x, this.y);
            ctx.rotate(Math.random() * Math.PI);
            ctx.fillRect(-this.size, -this.size/4, this.size*2, this.size/2);
        } else {
            ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        }
        
        ctx.restore();
    }
}

// ============================================================
// PROJECTILE
// ============================================================
class Projectile {
    constructor(x, y, angle, color) {
        this.x = x;
        this.y = y;
        this.w = 12;
        this.h = 12;
        this.vx = Math.cos(angle) * CONFIG.projectileSpeed;
        this.vy = Math.sin(angle) * CONFIG.projectileSpeed;
        this.life = 60;
        this.color = color;
    }

    update(particles) {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        
        if (Math.random() > 0.5) {
            particles.push(new Particle(this.x, this.y, this.color, 1, 10));
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============================================================
// PLATFORM
// ============================================================
class Platform {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    draw(ctx) {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = "#334155";
        ctx.fillRect(this.x, this.y, this.w, 5);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.w, this.h);
    }
}

// ============================================================
// PLAYER
// ============================================================
class Player {
    constructor(x, y, playerNum, color) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.w = 32;
        this.h = 48;
        this.vx = 0;
        this.vy = 0;
        this.playerNum = playerNum;
        this.color = color;
        
        this.hp = 100;
        this.maxHp = 100;
        this.invulnTimer = 0;
        
        this.grounded = false;
        this.facingRight = playerNum === 1;
        this.wallDir = 0;
        this.wallJumpLockout = 0;
        
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.jumpCount = 0;
        
        this.canDash = true;
        this.dashTimer = 0;
        this.isDashing = false;
        this.dashDirection = 0;
        
        this.attackCooldownTimer = 0;
        this.isAttacking = false;
        this.attackDuration = 0;
        this.attackHitbox = null;
        this.hasHitBoss = false;
        
        this.shotTimer = 0;
        this.healTimer = 0;
        
        this.scaleX = 1;
        this.scaleY = 1;
        
        // Input state (will be set externally)
        this.input = {
            left: false,
            right: false,
            jump: false,
            jumpPressed: false,
            jumpReleased: false,
            down: false,
            attack: false,
            attackPressed: false,
            shot: false,
            shotPressed: false,
            heal: false,
            healPressed: false
        };
    }

    // Serialize state for network sync
    serialize() {
        return {
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            hp: this.hp,
            facingRight: this.facingRight,
            isAttacking: this.isAttacking,
            isDashing: this.isDashing,
            grounded: this.grounded,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            attackCooldownTimer: this.attackCooldownTimer,
            shotTimer: this.shotTimer,
            healTimer: this.healTimer,
            jumpCount: this.jumpCount
        };
    }

    // Apply state from network
    deserialize(data) {
        this.x = data.x;
        this.y = data.y;
        this.vx = data.vx;
        this.vy = data.vy;
        this.hp = data.hp;
        this.facingRight = data.facingRight;
        this.isAttacking = data.isAttacking;
        this.isDashing = data.isDashing;
        this.grounded = data.grounded;
        this.scaleX = data.scaleX;
        this.scaleY = data.scaleY;
        this.attackCooldownTimer = data.attackCooldownTimer;
        this.shotTimer = data.shotTimer;
        this.healTimer = data.healTimer;
        this.jumpCount = data.jumpCount;
    }

    takeDamage(amount, knockbackX, particles) {
        if (this.invulnTimer > 0) return;
        
        this.hp -= amount;
        this.invulnTimer = 30;
        this.vx = knockbackX * 10;
        this.vy = -5;
        
        for (let i = 0; i < 15; i++) {
            particles.push(new Particle(this.x + this.w/2, this.y + this.h/2, "#ef4444", 6, 25));
        }
        
        if (this.hp <= 0) {
            this.respawn();
        }
    }

    respawn() {
        this.x = this.startX;
        this.y = this.startY;
        this.hp = this.maxHp;
        this.vx = 0;
        this.vy = 0;
    }

    update(platforms, boss, particles, projectiles, width, height, shake) {
        if (this.invulnTimer > 0) this.invulnTimer--;
        this.wallDir = 0;
        if (this.wallJumpLockout > 0) this.wallJumpLockout--;

        const centerX = this.x + this.w / 2;
        const centerY = this.y + this.h / 2;

        // Face boss
        if (boss && !boss.dead) {
            this.facingRight = (boss.x + boss.w/2) > centerX;
        }

        // Abilities
        if (this.shotTimer > 0) this.shotTimer--;
        if (this.healTimer > 0) this.healTimer--;

        // Shot ability
        if (this.input.shotPressed && this.shotTimer === 0) {
            this.shotTimer = CONFIG.cooldownShot;
            const angle = this.facingRight ? 0 : Math.PI;
            projectiles.push(new Projectile(centerX, centerY, angle, this.color));
            this.vx -= Math.cos(angle) * 3;
            shake.amount = Math.max(shake.amount, 3);
            this.input.shotPressed = false;
        }

        // Heal ability
        if (this.input.healPressed && this.healTimer === 0) {
            this.healTimer = CONFIG.cooldownHeal;
            this.hp = Math.min(this.hp + CONFIG.healAmount, this.maxHp);
            for (let i = 0; i < 20; i++) {
                particles.push(new Particle(centerX, centerY, "#4ade80", 4, 25));
            }
            this.input.healPressed = false;
        }

        // Movement
        if (this.isDashing) {
            this.vx = this.dashDirection * CONFIG.dashForce;
            this.vy = 0;
            if (Math.random() > 0.5) {
                particles.push(new Particle(centerX, centerY, this.color, 2, 10));
            }
        } else {
            if (this.wallJumpLockout <= 0) {
                if (this.input.right) this.vx += CONFIG.moveSpeed;
                if (this.input.left) this.vx -= CONFIG.moveSpeed;
            }

            this.vx *= this.grounded ? CONFIG.friction : CONFIG.airResistance;
            
            if (Math.abs(this.vx) > CONFIG.maxSpeed && this.wallJumpLockout <= 0) {
                this.vx *= 0.95;
            }

            this.vy += CONFIG.gravity;
        }

        // Dash
        if (this.dashTimer > 0) this.dashTimer--;
        else if (this.grounded) this.canDash = true;

        if (this.input.down && this.canDash && !this.isDashing && this.dashTimer === 0 && Math.abs(this.vx) > 0.5) {
            this.startDash(particles, shake);
        }

        // Jump
        if (this.grounded) {
            this.coyoteTimer = CONFIG.coyoteTime;
            this.jumpCount = 0;
        } else if (this.coyoteTimer > 0) {
            this.coyoteTimer--;
        }

        if (this.input.jumpPressed) {
            this.jumpBufferTimer = CONFIG.jumpBuffer;
            this.input.jumpPressed = false;
        }
        if (this.jumpBufferTimer > 0) this.jumpBufferTimer--;

        if (this.jumpBufferTimer > 0) {
            if (!this.grounded && this.wallDir !== 0) {
                this.performWallJump(particles);
            } else if (this.coyoteTimer > 0) {
                this.performJump(particles);
            } else if (this.jumpCount < CONFIG.maxJumps) {
                this.performDoubleJump(particles);
            }
        }

        if (this.input.jumpReleased) {
            if (this.vy < 0) this.vy *= CONFIG.variableJump;
            this.input.jumpReleased = false;
        }

        // Combat
        if (this.attackCooldownTimer > 0) this.attackCooldownTimer--;

        if (this.input.attackPressed && this.attackCooldownTimer === 0) {
            this.performAttack(shake);
            this.input.attackPressed = false;
        }

        if (this.isAttacking) {
            this.attackDuration--;
            if (this.attackHitbox) {
                const cx = this.x + this.w/2;
                const cy = this.y + this.h/2;
                this.attackHitbox.x = cx + Math.cos(this.attackHitbox.angle) * 30 - 20;
                this.attackHitbox.y = cy + Math.sin(this.attackHitbox.angle) * 30 - 20;
            }
            if (this.attackDuration <= 0) {
                this.isAttacking = false;
                this.attackHitbox = null;
            } else {
                this.checkEnvironmentRecoil(platforms, particles, shake);
            }
        }

        // Collision X
        this.x += this.vx;
        this.handleCollision(platforms, 'x', particles, shake);

        // Wall slide
        if (!this.grounded && this.wallDir !== 0 && this.vy > 0 && !this.isDashing) {
            this.vy = Math.min(this.vy, CONFIG.wallSlideSpeed);
            if (Math.random() > 0.8) {
                particles.push(new Particle(this.x + (this.wallDir > 0 ? this.w : 0), this.y + Math.random() * this.h, "#94a3b8", 2, 15));
            }
        }

        // Collision Y
        this.y += this.vy;
        this.grounded = false;
        this.handleCollision(platforms, 'y', particles, shake);

        // Animation
        this.scaleX += (1 - this.scaleX) * 0.15;
        this.scaleY += (1 - this.scaleY) * 0.15;

        if (this.isDashing && this.dashTimer > CONFIG.dashCooldown - 10) {}
        else this.isDashing = false;

        // Bounds
        if (this.y > height + 200) {
            this.takeDamage(20, 0, particles);
            this.x = width / 2;
            this.y = 100;
            this.vy = 0;
        }
    }

    startDash(particles, shake) {
        this.isDashing = true;
        this.canDash = false;
        this.dashTimer = CONFIG.dashCooldown;
        this.dashDirection = Math.abs(this.vx) > 0.1 ? Math.sign(this.vx) : (this.facingRight ? 1 : -1);
        this.jumpCount = 0;
        shake.amount = Math.max(shake.amount, 4);
        for (let i = 0; i < 10; i++) {
            particles.push(new Particle(this.x + this.w/2, this.y + this.h/2, this.color, 6, 20));
        }
        this.scaleX = 1.4;
        this.scaleY = 0.6;
    }

    performJump(particles) {
        this.vy = CONFIG.jumpForce;
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this.grounded = false;
        this.jumpCount = 1;
        this.scaleX = 0.7;
        this.scaleY = 1.4;
        for (let i = 0; i < 6; i++) {
            particles.push(new Particle(this.x + this.w/2, this.y + this.h, "#94a3b8", 3, 20));
        }
    }

    performDoubleJump(particles) {
        this.vy = CONFIG.jumpForce;
        this.jumpBufferTimer = 0;
        this.grounded = false;
        this.jumpCount++;
        this.scaleX = 0.8;
        this.scaleY = 1.2;
        for (let i = 0; i < 6; i++) {
            particles.push(new Particle(this.x + this.w/2, this.y + this.h, "#a5f3fc", 4, 15));
        }
    }

    performWallJump(particles) {
        this.vy = CONFIG.wallJumpForceY;
        this.vx = -this.wallDir * CONFIG.wallJumpForceX;
        this.wallJumpLockout = 10;
        this.jumpBufferTimer = 0;
        this.grounded = false;
        this.jumpCount = 1;
        this.scaleX = 0.6;
        this.scaleY = 1.3;
        const px = this.wallDir > 0 ? this.x + this.w : this.x;
        for (let i = 0; i < 8; i++) {
            particles.push(new Particle(px, this.y + this.h/2, "#cbd5e1", 5, 20));
        }
    }

    performAttack(shake) {
        this.isAttacking = true;
        this.attackDuration = 8;
        this.attackCooldownTimer = CONFIG.attackCooldown;
        this.hasHitBoss = false;
        this.jumpCount = 0;

        const angle = this.facingRight ? 0 : Math.PI;
        const cx = this.x + this.w/2;
        const cy = this.y + this.h/2;

        this.attackHitbox = {
            x: cx + Math.cos(angle) * 30 - 20,
            y: cy + Math.sin(angle) * 30 - 20,
            w: 40,
            h: 40,
            angle: angle
        };
        shake.amount = Math.max(shake.amount, 2);
    }

    checkEnvironmentRecoil(platforms, particles, shake) {
        if (!this.attackHitbox) return;

        let hit = false;
        for (let p of platforms) {
            if (checkRectCollide(this.attackHitbox, p)) {
                hit = true;
                break;
            }
        }

        if (hit) {
            this.vx = -Math.cos(this.attackHitbox.angle) * CONFIG.recoilForce;
            this.vy = -Math.sin(this.attackHitbox.angle) * CONFIG.recoilForce;

            for (let i = 0; i < 10; i++) {
                particles.push(new Particle(this.attackHitbox.x + 20, this.attackHitbox.y + 20, "#fff", 6, 20, 'spark'));
            }
            shake.amount = Math.max(shake.amount, 6);
        }
    }

    handleCollision(platforms, axis, particles, shake) {
        for (let p of platforms) {
            if (checkRectCollide(this, p)) {
                if (axis === 'x') {
                    if (this.vx > 0) {
                        this.x = p.x - this.w;
                        this.wallDir = 1;
                    } else if (this.vx < 0) {
                        this.x = p.x + p.w;
                        this.wallDir = -1;
                    }
                    this.vx = 0;
                } else {
                    if (this.vy > 0) {
                        this.y = p.y - this.h;
                        this.grounded = true;
                        if (this.vy > 10) {
                            this.scaleX = 1.4;
                            this.scaleY = 0.6;
                            for (let i = 0; i < 6; i++) {
                                particles.push(new Particle(this.x + this.w/2, this.y + this.h, "#94a3b8", 3, 20));
                            }
                            shake.amount = Math.max(shake.amount, Math.min(this.vy / 2, 5));
                        }
                        this.vy = 0;
                    } else if (this.vy < 0) {
                        this.y = p.y + p.h;
                        this.vy = 0;
                        this.scaleX = 1.2;
                        this.scaleY = 0.8;
                    }
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();

        const cx = this.x + this.w / 2;
        const cy = this.y + this.h;

        ctx.translate(cx, cy);
        ctx.scale(this.scaleX, this.scaleY);
        ctx.translate(-cx, -cy);

        // Motion blur
        if (this.isDashing || Math.abs(this.vx) > CONFIG.maxSpeed) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.vx * 2, this.y - this.vy * 2, this.w, this.h);
            ctx.globalAlpha = 1.0;
        }

        // Body
        let bodyColor = this.color;
        if (this.invulnTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
            bodyColor = "rgba(255,255,255,0.5)";
        } else if (this.isDashing) {
            bodyColor = "#ffffff";
        } else if (this.jumpCount >= CONFIG.maxJumps && !this.grounded) {
            bodyColor = this.playerNum === 1 ? "#0369a1" : "#9d174d";
        }

        ctx.fillStyle = bodyColor;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.shadowBlur = 0;

        // Eye
        ctx.fillStyle = "white";
        const eyeOffset = this.facingRight ? 6 : -14;
        ctx.fillRect(this.x + this.w/2 + eyeOffset, this.y + 10, 8, 8);

        // Attack arc
        if (this.isAttacking && this.attackHitbox) {
            ctx.save();
            ctx.translate(this.x + this.w/2, this.y + this.h/2);
            ctx.rotate(this.attackHitbox.angle);
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 4;
            ctx.arc(0, 0, 50, -Math.PI/3, Math.PI/3);
            ctx.stroke();
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineTo(0, 0);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    }
}

// ============================================================
// BOSS
// ============================================================
class Boss {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 60;
        this.h = 80;
        this.color = "#a855f7";
        this.hp = CONFIG.bossHp;
        this.maxHp = CONFIG.bossHp;
        
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        
        this.state = "idle";
        this.timer = 0;
        this.flashTimer = 0;
        
        this.baseSpeed = 2;
        this.dashSpeed = 15;
        this.dead = false;
    }

    serialize() {
        return {
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            hp: this.hp,
            state: this.state,
            timer: this.timer,
            angle: this.angle,
            dead: this.dead,
            flashTimer: this.flashTimer
        };
    }

    deserialize(data) {
        this.x = data.x;
        this.y = data.y;
        this.vx = data.vx;
        this.vy = data.vy;
        this.hp = data.hp;
        this.state = data.state;
        this.timer = data.timer;
        this.angle = data.angle;
        this.dead = data.dead;
        this.flashTimer = data.flashTimer;
    }

    update(player, particles, width, height) {
        if (this.dead) return;
        
        if (this.flashTimer > 0) this.flashTimer--;

        const hpPct = this.hp / this.maxHp;
        const currentSpeed = this.baseSpeed + (1 - hpPct) * 2;

        const dx = (player.x + player.w/2) - (this.x + this.w/2);
        const dy = (player.y + player.h/2) - (this.y + this.h/2);
        const dist = Math.sqrt(dx*dx + dy*dy);

        switch(this.state) {
            case "idle":
                this.vy = Math.sin(Date.now() / 500) * 0.5;
                if (dist < 600) {
                    this.state = "chase";
                }
                break;

            case "chase":
                this.vx += (Math.sign(dx) * currentSpeed - this.vx) * 0.05;
                this.vy += (Math.sign(dy) * currentSpeed - this.vy) * 0.05;
                
                this.x += this.vx;
                this.y += this.vy;

                if (Math.random() < 0.01 + (1 - hpPct) * 0.02) {
                    this.state = "charge_tell";
                    this.timer = 60;
                    this.vx = 0;
                    this.vy = 0;
                }
                break;

            case "charge_tell":
                this.timer--;
                this.angle = Math.atan2(dy, dx);
                this.flashTimer = 2;

                if (this.timer <= 0) {
                    this.state = "charge_act";
                    this.timer = 30;
                    this.vx = Math.cos(this.angle) * this.dashSpeed;
                    this.vy = Math.sin(this.angle) * this.dashSpeed;
                    for (let i = 0; i < 20; i++) {
                        particles.push(new Particle(this.x + this.w/2, this.y + this.h/2, this.color, 6, 25));
                    }
                }
                break;

            case "charge_act":
                this.x += this.vx;
                this.y += this.vy;
                this.timer--;

                particles.push(new Particle(this.x + Math.random()*this.w, this.y + Math.random()*this.h, this.color, 0, 20));

                if (checkRectCollide(this, player)) {
                    player.takeDamage(20, Math.sign(this.vx), particles);
                }

                if (this.timer <= 0) {
                    this.state = "chase";
                    this.vx *= 0.1;
                    this.vy *= 0.1;
                }
                break;
        }

        // Bounds
        if (this.y > height - 100) this.vy -= 0.5;
        if (this.x < 50) this.x = 50;
        if (this.x > width - 50 - this.w) this.x = width - 50 - this.w;
    }

    takeDamage(amount, kx, ky, particles) {
        if (this.dead) return;
        
        this.hp -= amount;
        this.flashTimer = 5;
        this.x += kx * 5;
        this.y += ky * 5;

        for (let i = 0; i < 8; i++) {
            particles.push(new Particle(this.x + this.w/2, this.y + this.h/2, "#fff", 6, 20, 'spark'));
        }

        if (this.hp <= 0) {
            this.dead = true;
            for (let i = 0; i < 100; i++) {
                particles.push(new Particle(this.x + this.w/2, this.y + this.h/2, this.color, 10, 40));
            }
            for (let i = 0; i < 50; i++) {
                particles.push(new Particle(this.x + this.w/2, this.y + this.h/2, "#fff", 8, 30, 'spark'));
            }
        }
    }

    draw(ctx) {
        if (this.dead) return;
        
        ctx.save();

        let dx = 0, dy = 0;
        if (this.flashTimer > 0) {
            dx = (Math.random() - 0.5) * 5;
            dy = (Math.random() - 0.5) * 5;
            ctx.fillStyle = "#fff";
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.translate(this.x + this.w/2 + dx, this.y + this.h/2 + dy);

        if (this.state === "charge_act" || this.state === "charge_tell") {
            ctx.rotate(this.angle);
        }

        // Diamond shape
        ctx.beginPath();
        ctx.moveTo(0, -this.h/2);
        ctx.lineTo(this.w/2, 0);
        ctx.lineTo(0, this.h/2);
        ctx.lineTo(-this.w/2, 0);
        ctx.closePath();
        ctx.fill();

        // Glowing core
        ctx.fillStyle = "#e879f9";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = "#fff";
        ctx.fillRect(-15, -5, 30, 4);

        ctx.restore();
    }
}

// ============================================================
// UTILITY
// ============================================================
function checkRectCollide(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

function formatTime(frames) {
    const totalSeconds = frames / 60;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds % 1) * 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, Particle, Projectile, Platform, Player, Boss, checkRectCollide, formatTime };
}

