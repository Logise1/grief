// Cinematic Particle System
class Particle {
  constructor(x, y, vx, vy, size, color, maxLife, type = 'default') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.color = color;
    this.alpha = 1;
    this.life = maxLife;
    this.maxLife = maxLife;
    this.type = type;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.05;
  }

  update(dt) {
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;

    // Custom behaviors based on stage/type
    if (this.type === 'rain') {
      // Wind drift for rain
      this.vx = -1.5;
    } else if (this.type === 'fog') {
      // Gentle floating sine wave motion
      this.vy += Math.sin(this.life * 0.01) * 0.01 * dt;
    } else if (this.type === 'ash') {
      // Rise with turbulence
      this.vx += (Math.random() - 0.5) * 0.1 * dt;
    } else if (this.type === 'light') {
      // Gentle float and fade
      this.vx += Math.sin(this.life * 0.05) * 0.05 * dt;
    }
  }

  draw(ctx, cameraX = 0, cameraY = 0) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x - cameraX, this.y - cameraY);
    ctx.rotate(this.angle);

    ctx.fillStyle = this.color;
    
    if (this.type === 'rain') {
      // Draw rain as a diagonal streak
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.vx * 2, this.vy * 2);
      ctx.stroke();
    } else if (this.type === 'fog') {
      // Draw fog as soft radial blobs
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
      grad.addColorStop(0, this.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'light') {
      // Soft glowing orb without using expensive shadowBlur
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
      grad.addColorStop(0, this.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Simple square/rectangle particle
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    }

    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx, cameraX, cameraY) {
    this.particles.forEach(p => p.draw(ctx, cameraX, cameraY));
  }

  clear() {
    this.particles = [];
  }

  // Spawners
  spawn(x, y, vx, vy, size, color, maxLife, type = 'default') {
    this.particles.push(new Particle(x, y, vx, vy, size, color, maxLife, type));
  }

  spawnBurst(x, y, count, speed, size, color, life, type = 'default') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = (0.3 + Math.random() * 0.7) * speed;
      const vx = Math.cos(angle) * mag;
      const vy = Math.sin(angle) * mag;
      this.spawn(x, y, vx, vy, size * (0.6 + Math.random() * 0.8), color, life * (0.6 + Math.random() * 0.8), type);
    }
  }

  spawnFog(width, height, count = 1) {
    for (let i = 0; i < count; i++) {
      // Spawn on the right side of the viewport, moving left
      const x = Math.random() * width;
      const y = Math.random() * height;
      const vx = -0.2 - Math.random() * 0.3;
      const vy = (Math.random() - 0.5) * 0.1;
      const size = 60 + Math.random() * 80;
      this.spawn(x, y, vx, vy, size, 'rgba(160, 160, 160, 0.05)', 300 + Math.random() * 200, 'fog');
    }
  }

  spawnAsh(width, height, cameraX, cameraY, count = 1) {
    for (let i = 0; i < count; i++) {
      // Spawn at the bottom/sides, drift up and left/right
      const x = cameraX + Math.random() * width;
      const y = cameraY + height + 20;
      const vx = (Math.random() - 0.5) * 0.8;
      const vy = -0.8 - Math.random() * 1.2;
      const size = 2 + Math.random() * 3;
      // Vibrant fire colors: red, orange, yellow
      const r = 200 + Math.floor(Math.random() * 55);
      const g = 50 + Math.floor(Math.random() * 100);
      const b = 20;
      const color = `rgba(${r}, ${g}, ${b}, ${0.5 + Math.random() * 0.5})`;
      this.spawn(x, y, vx, vy, size, color, 120 + Math.random() * 100, 'ash');
    }
  }

  spawnBargainingTick(x, y) {
    // Clock-like sparks that drift up
    const vx = (Math.random() - 0.5) * 0.4;
    const vy = -0.4 - Math.random() * 0.6;
    const size = 3 + Math.random() * 4;
    this.spawn(x, y, vx, vy, size, 'rgba(224, 169, 109, 0.6)', 80 + Math.random() * 50, 'light');
  }

  spawnRain(width, height, cameraX, cameraY, count = 2) {
    for (let i = 0; i < count; i++) {
      // Spawn above the viewport, falling down and slightly left
      const x = cameraX + Math.random() * (width + 200) - 100;
      const y = cameraY - 20;
      const vx = -2;
      const vy = 10 + Math.random() * 5;
      const size = 10 + Math.random() * 15;
      const color = 'rgba(52, 152, 219, 0.35)';
      this.spawn(x, y, vx, vy, size, color, 100, 'rain');
    }
  }

  spawnRainSplash(x, y) {
    // Little vertical splash particles
    for (let i = 0; i < 3; i++) {
      const vx = (Math.random() - 0.5) * 1.5 - 0.5;
      const vy = -1 - Math.random() * 2;
      const size = 1.5;
      this.spawn(x, y, vx, vy, size, 'rgba(52, 152, 219, 0.5)', 10 + Math.random() * 10);
    }
  }

  spawnAcceptanceLight(width, height, cameraX, cameraY, count = 1) {
    for (let i = 0; i < count; i++) {
      const x = cameraX + Math.random() * width;
      const y = cameraY + height + 10;
      const vx = (Math.random() - 0.5) * 0.5;
      const vy = -0.3 - Math.random() * 0.6;
      const size = 4 + Math.random() * 8;
      const color = `rgba(241, 196, 15, ${0.15 + Math.random() * 0.25})`;
      this.spawn(x, y, vx, vy, size, color, 200 + Math.random() * 150, 'light');
    }
  }

  spawnHopeLight(width, height, cameraX, cameraY, count = 1) {
    for (let i = 0; i < count; i++) {
      const x = cameraX + Math.random() * width;
      const y = cameraY + height + 10;
      const vx = (Math.random() - 0.5) * 0.5;
      const vy = -0.3 - Math.random() * 0.6;
      const size = 4 + Math.random() * 8;
      const color = `rgba(46, 204, 113, ${0.15 + Math.random() * 0.25})`;
      this.spawn(x, y, vx, vy, size, color, 200 + Math.random() * 150, 'light');
    }
  }

  spawnJumpSparks(x, y, stageIndex) {
    let color = 'rgba(255, 255, 255, 0.4)';
    if (stageIndex === 5) color = 'rgba(241, 196, 15, 0.6)';
    else if (stageIndex === 6) color = 'rgba(46, 204, 113, 0.6)';
    // A small puff of dust/spark when leaping
    this.spawnBurst(x, y, 6, 1.2, 2, color, 25);
  }
}
