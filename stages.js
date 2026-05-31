// Global empty levels database to be populated from levels.json
const STAGES = [];

// Dictionary of procedural visual rendering routines for each stage
const drawSpecialRoutines = {
  0: function(ctx, game) {
    // THE VOID: Draw a happy memory landscape in the upper zone
    let transitionFactor = Math.min(1.0, Math.max(0.0, (game.player.y - 400) / 300));
    let alpha = 1.0 - transitionFactor;
    
    if (alpha > 0.0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      
      // Draw a peaceful tree at x: 800
      let tx = 800 - game.camera.x;
      let ty = 400 - game.camera.y; // Ground is at y: 400
      
      // Trunk
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(tx - 10, ty - 80, 20, 80);
      
      // Leaves (layers of green)
      ctx.fillStyle = "#81c784";
      ctx.beginPath();
      ctx.arc(tx, ty - 90, 45, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "#4caf50";
      ctx.beginPath();
      ctx.arc(tx - 25, ty - 110, 35, 0, Math.PI*2);
      ctx.arc(tx + 25, ty - 110, 35, 0, Math.PI*2);
      ctx.fill();
      
      // Draw a tiny bench under the tree
      ctx.fillStyle = "#a1887f";
      ctx.fillRect(tx - 50, ty - 15, 40, 6);
      ctx.fillRect(tx - 45, ty - 9, 4, 9);
      ctx.fillRect(tx - 19, ty - 9, 4, 9);
      
      // Draw a silhouette representing the memories
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ffffff";
      
      // Silhouette
      let sx = tx + 30;
      ctx.beginPath();
      ctx.arc(sx, ty - 28, 5, 0, Math.PI*2); // Head
      ctx.fill();
      ctx.fillRect(sx - 3, ty - 23, 6, 23); // Body
      
      ctx.restore();
    }
  },
  1: function(ctx, game) {
    // DENIAL: Draw fog layers drifting
    ctx.fillStyle = "rgba(200, 200, 200, 0.03)";
    for(let i = 0; i < 3; i++) {
      ctx.fillRect(-game.camera.x * 0.1 * i, 0, this.width, this.height);
    }
  },
  2: function(ctx, game) {
    // ANGER: Lava glow at bottom
    ctx.save();
    const grad = ctx.createLinearGradient(0, this.height - 50, 0, this.height);
    grad.addColorStop(0, "rgba(231, 76, 60, 0)");
    grad.addColorStop(0.5, "rgba(231, 76, 60, 0.15)");
    grad.addColorStop(1, "rgba(231, 76, 60, 0.4)");
    ctx.fillStyle = grad;
    ctx.fillRect(game.camera.x, this.height - 200, game.canvas.width, 200);
    ctx.restore();
  },
  3: function(ctx, game) {
    // BARGAINING: Golden coordinate grid overlay
    ctx.save();
    ctx.strokeStyle = "rgba(224, 169, 109, 0.05)";
    ctx.lineWidth = 1;
    const step = 80;
    for(let x = 0; x < this.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x - game.camera.x * 0.2, 0);
      ctx.lineTo(x - game.camera.x * 0.2, this.height);
      ctx.stroke();
    }
    ctx.restore();
  },
  4: function(ctx, game) {
    // DEPRESSION: Draw static dark water waves at bottom
    ctx.save();
    ctx.fillStyle = "rgba(10, 25, 47, 0.75)";
    
    const waveOffset = Math.sin(Date.now() * 0.003) * 6;
    ctx.beginPath();
    ctx.moveTo(game.camera.x, this.waterLevel - game.camera.y + waveOffset);
    
    const segments = 20;
    const segmentWidth = game.canvas.width / segments;
    for (let i = 0; i <= segments; i++) {
      const x = game.camera.x + i * segmentWidth;
      const y = this.waterLevel - game.camera.y + Math.sin(i * 0.8 + Date.now() * 0.004) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(game.camera.x + game.canvas.width, this.height);
    ctx.lineTo(game.camera.x, this.height);
    ctx.closePath();
    ctx.fill();

    // Deep dark water fill below screen bottom
    ctx.fillRect(game.camera.x, this.waterLevel - game.camera.y + 8, game.canvas.width, 200);
    ctx.restore();
  },
  5: function(ctx, game) {
    // ACCEPTANCE: Golden volumetric light shafts
    ctx.save();
    const numShafts = 4;
    ctx.fillStyle = "rgba(241, 196, 15, 0.04)";
    for(let i = 0; i < numShafts; i++) {
      const xStart = 500 + i * 600 - game.camera.x * 0.3;
      ctx.beginPath();
      ctx.moveTo(xStart, 0);
      ctx.lineTo(xStart + 150, 0);
      ctx.lineTo(xStart + 350, this.height);
      ctx.lineTo(xStart + 100, this.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },
  6: function(ctx, game) {
    // HOPE: Soft green/golden rays and seedlings of light
    ctx.save();
    ctx.fillStyle = "rgba(46, 204, 113, 0.03)";
    const numShafts = 3;
    for(let i = 0; i < numShafts; i++) {
      const xStart = 300 + i * 500 - game.camera.x * 0.2;
      ctx.beginPath();
      ctx.moveTo(xStart, 0);
      ctx.lineTo(xStart + 100, 0);
      ctx.lineTo(xStart + 250, this.height);
      ctx.lineTo(xStart + 150, this.height);
      ctx.closePath();
      ctx.fill();
    }

    // Draw glowing beacon of hope at x: 2700
    const bx = 2740 - game.camera.x;
    const by = 600 - game.camera.y;
    const grad = ctx.createLinearGradient(bx - 30, by - 400, bx + 30, by);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
    grad.addColorStop(0.5, "rgba(46, 204, 113, 0.35)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0.75)");
    
    ctx.fillStyle = grad;
    ctx.fillRect(bx - 30, by - 400, 60, 400);

    // Draw a small glowing seedling/tree of light
    ctx.strokeStyle = "rgba(46, 204, 113, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - 10, by - 40, bx, by - 70);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx, by - 30);
    ctx.quadraticCurveTo(bx + 20, by - 50, bx + 15, by - 60);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx, by - 50);
    ctx.quadraticCurveTo(bx - 20, by - 65, bx - 15, by - 75);
    ctx.stroke();

    // Glow orb on top
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#2ecc71";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx, by - 75, 8, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }
};
