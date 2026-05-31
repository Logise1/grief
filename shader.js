// WebGL Post-Processing Handler
class ShaderPostProcessor {
  constructor(webglCanvas, game2DCanvas) {
    this.canvas = webglCanvas;
    this.gameCanvas = game2DCanvas;
    this.gl = webglCanvas.getContext('webgl') || webglCanvas.getContext('experimental-webgl');
    if (!this.gl) {
      console.error("WebGL not supported, falling back to 2D canvas.");
      return;
    }

    const gl = this.gl;

    // Compile Vertex Shader
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_position * 0.5 + 0.5;
      }
    `;
    this.vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);

    // Compile Fragment Shader (GLSL ES 1.0)
    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      uniform float u_time;
      uniform int u_stage;
      uniform float u_screenshake;
      uniform float u_transition;

      float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 ip = floor(p);
        vec2 fp = fract(p);
        fp = fp * fp * (3.0 - 2.0 * fp);
        float a = rand(ip);
        float b = rand(ip + vec2(1.0, 0.0));
        float c = rand(ip + vec2(0.0, 1.0));
        float d = rand(ip + vec2(1.0, 1.0));
        return mix(mix(a, b, fp.x), mix(c, d, fp.x), fp.y);
      }

      void main() {
        vec2 uv = v_texCoord;
        
        // Screenshake displacement in UV coordinates
        if (u_screenshake > 0.0) {
          uv.x += (rand(vec2(u_time, 0.0)) - 0.5) * u_screenshake * 0.003;
          uv.y += (rand(vec2(0.0, u_time)) - 0.5) * u_screenshake * 0.003;
        }

        // 1. Stage-specific distortions
        if (u_stage == 0) {
          // Intro: VHS tracking & rolling lines (scales with transition)
          float checkTime = u_time * 0.5;
          float roll = fract(checkTime);
          if (abs(uv.y - roll) < 0.015) {
            uv.x += sin(uv.y * 100.0) * 0.015 * u_transition;
          }
          float lineNoise = rand(vec2(floor(u_time * 20.0), 0.0));
          if (lineNoise > 0.97) {
            uv.x += (rand(vec2(uv.y, u_time)) - 0.5) * 0.012 * u_transition;
          }
        }
        else if (u_stage == 2) { 
          // Anger: Aggressive heat wave + fire wave
          float intensity = 0.004 + u_screenshake * 0.003;
          uv.x += sin(uv.y * 40.0 + u_time * 8.0) * intensity;
          uv.y += cos(uv.x * 30.0 + u_time * 6.0) * intensity * 0.5;
        } 
        else if (u_stage == 3) { 
          // Bargaining: Shifting digital block glitch
          float blockTime = floor(u_time * 12.0);
          float blockLine = floor(uv.y * 30.0);
          float lineGlitch = rand(vec2(blockTime, blockLine));
          if (lineGlitch > 0.94) {
            uv.x += (rand(vec2(blockTime, blockLine)) - 0.5) * 0.025;
          }
        }
        else if (u_stage == 4) { 
          // Depression: Heavy lens water drop/smudge distortion
          float wX = sin(uv.y * 20.0 + u_time * 1.5) * 0.004;
          float wY = cos(uv.x * 25.0 + u_time * 1.2) * 0.004;
          float rainSpeed = u_time * 2.0;
          float rainDrop = noise(vec2(uv.x * 8.0, uv.y * 2.0 - rainSpeed));
          if (rainDrop > 0.85) {
            wX += sin(uv.y * 150.0) * 0.008 * (rainDrop - 0.85);
          }
          uv.x += wX;
          uv.y += wY;
        }

        // 2. Chromatic Aberration (Radial)
        float ca = 0.0;
        if (u_stage == 0) ca = 0.005 * u_transition;
        else if (u_stage == 1) ca = 0.004;
        else if (u_stage == 2) ca = 0.012 + u_screenshake * 0.008; 
        else if (u_stage == 3) ca = 0.006;
        else if (u_stage == 4) ca = 0.004;
        
        vec4 col;
        float distFromCenter = length(uv - vec2(0.5));
        float dynamicCA = ca * distFromCenter;

        if (dynamicCA > 0.0) {
          float r = texture2D(u_texture, uv + vec2(dynamicCA, 0.0)).r;
          float g = texture2D(u_texture, uv).g;
          float b = texture2D(u_texture, uv - vec2(dynamicCA, 0.0)).b;
          
          if (u_stage == 3) {
            float blockTime = floor(u_time * 12.0);
            float blockLine = floor(uv.y * 30.0);
            float lineGlitch = rand(vec2(blockTime, blockLine));
            if (lineGlitch > 0.94) {
              r = texture2D(u_texture, uv + vec2(0.025, 0.01)).r;
              b = texture2D(u_texture, uv - vec2(0.025, -0.01)).b;
            }
          }
          col = vec4(r, g, b, 1.0);
        } else {
          col = texture2D(u_texture, uv);
        }

        // 3. Film Grain / Noise
        float grain = 0.0;
        if (u_stage == 0) grain = 0.18 * u_transition;
        else if (u_stage == 1) grain = 0.08;
        else if (u_stage == 2) grain = 0.07;
        else if (u_stage == 4) grain = 0.12;
        else if (u_stage == 5) grain = 0.04;
        else if (u_stage == 6) grain = 0.025;

        if (grain > 0.0) {
          float n = (rand(uv + vec2(u_time * 0.01, u_time * 0.02)) - 0.5) * grain;
          col.rgb += vec3(n);
        }

        // 4. Color grading, vignetting, scanlines and lighting overlays
        float vignette = smoothstep(0.8, 0.4, distFromCenter * 1.3);

        if (u_stage == 0) { 
          float gray = dot(col.rgb, vec3(0.299, 0.587, 0.114));
          vec3 grayCol = vec3(gray * 0.85);
          // Transition smoothly from normal full color sky to desaturated void grayscale
          col.rgb = mix(col.rgb, grayCol, u_transition);
          float scan = sin(uv.y * 420.0 + u_time * 2.0) * 0.04 * u_transition;
          col.rgb -= vec3(scan);
          col.rgb *= mix(1.0, vignette, u_transition);
        } else if (u_stage == 1) { 
          float gray = dot(col.rgb, vec3(0.299, 0.587, 0.114));
          col.rgb = mix(col.rgb, vec3(gray), 0.4);
          col.rgb *= mix(1.0, vignette, 0.45);
        } else if (u_stage == 2) { 
          float pulse = sin(u_time * 6.0) * 0.08 + 0.92;
          col.r = col.r * 1.25 * pulse;
          col.g = col.g * 0.78;
          col.b = col.b * 0.72;
          float angerVig = smoothstep(0.85, 0.45, distFromCenter * 1.2);
          col.rgb = mix(col.rgb * angerVig, col.rgb, 0.3);
          col.r += (1.0 - angerVig) * 0.25 * pulse;
        } else if (u_stage == 3) { 
          col.r = col.r * 1.15;
          col.g = col.g * 1.05;
          col.b = col.b * 0.82;
          float gridLine = sin(uv.y * 100.0 - u_time * 4.0);
          if (gridLine > 0.98) {
            col.rgb += vec3(0.04, 0.03, 0.01);
          }
        } else if (u_stage == 4) { 
          col.r = col.r * 0.65;
          col.g = col.g * 0.82;
          col.b = col.b * 1.35;
          float gray = dot(col.rgb, vec3(0.299, 0.587, 0.114));
          col.rgb = mix(col.rgb, vec3(gray), 0.35);
          col.rgb *= mix(0.4, 1.0, vignette);
        } else if (u_stage == 5) { 
          col.r = col.r * 1.08 + 0.03;
          col.g = col.g * 1.06 + 0.02;
          col.b = col.b * 0.92;
          vec2 lightPos = vec2(0.2, 0.1);
          vec2 toLight = uv - lightPos;
          float angle = atan(toLight.y, toLight.x);
          float beam = sin(angle * 6.0 + u_time * 0.4) * 0.5 + 0.5;
          beam *= smoothstep(1.2, 0.0, length(toLight));
          col.rgb += vec3(0.05, 0.04, 0.01) * beam;
        } else if (u_stage == 6) { 
          col.r = col.r * 0.90;
          col.g = col.g * 1.12 + 0.03;
          col.b = col.b * 0.95;
          vec2 lightPos = vec2(0.8, 0.1);
          vec2 toLight = uv - lightPos;
          float angle = atan(toLight.y, toLight.x);
          float beam = sin(angle * 8.0 - u_time * 0.3) * 0.5 + 0.5;
          beam *= smoothstep(1.5, 0.0, length(toLight));
          col.rgb += vec3(0.02, 0.07, 0.03) * beam;
        }

        gl_FragColor = col;
      }
    `;
    this.fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

    // Create Shader Program
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vertexShader);
    gl.attachShader(this.program, this.fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("Shader Program linking failed:", gl.getProgramInfoLog(this.program));
      return;
    }

    // Set up full-screen quad vertices (2 triangles covering -1 to 1 clip space)
    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Create texture representing the 2D game screen
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Retrieve locations for attributes & uniforms
    this.uTimeLoc = gl.getUniformLocation(this.program, 'u_time');
    this.uStageLoc = gl.getUniformLocation(this.program, 'u_stage');
    this.uScreenshakeLoc = gl.getUniformLocation(this.program, 'u_screenshake');
    this.uTransitionLoc = gl.getUniformLocation(this.program, 'u_transition');
    this.aPositionLoc = gl.getAttribLocation(this.program, 'a_position');
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader Compilation error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  resize(width, height) {
    if (!this.gl) return;
    this.gl.viewport(0, 0, width, height);
  }

  render(timestamp, currentStage, screenshake = 0.0, transition = 1.0) {
    if (!this.gl) {
      // Fallback: copy offscreen 2D canvas to the display canvas
      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(this.gameCanvas, 0, 0, this.canvas.width, this.canvas.height);
      }
      return;
    }

    const gl = this.gl;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use linked shader program
    gl.useProgram(this.program);

    // Bind the vertex buffer
    gl.enableVertexAttribArray(this.aPositionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, 0, 0);

    // Update WebGL texture with current frame from 2D Canvas
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Specify the source of texture: the offscreen 2D canvas
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.gameCanvas);

    // Send dynamic uniforms to the GPU
    gl.uniform1f(this.uTimeLoc, timestamp / 1000.0); // Convert time to seconds
    gl.uniform1i(this.uStageLoc, currentStage);
    gl.uniform1f(this.uScreenshakeLoc, screenshake);
    gl.uniform1f(this.uTransitionLoc, transition);

    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
