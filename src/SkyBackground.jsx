import { useEffect, useRef } from 'react';

/* ────────────────────────────────────────────────────────
   SkyBackground — Dynamic, time-aware, weather-driven
   canvas background with smooth transitions.
──────────────────────────────────────────────────────── */

// --- Palettes ---
const PALETTES = {
  morning: [
    ['#1a0533','#6b1f3a','#c0392b','#e8714a','#ffc86e'], // Pre-dawn
    ['#3d1060','#a8306a','#e06040','#f5a060','#ffe0a0'], // Sunrise
    ['#3a6daa','#6a9fd4','#a0c8ee','#c8e4f8','#e8f8ff'], // Morning blue
  ],
  day: [['#0B3D8C','#1565C0','#42A5F5','#90CAF9','#B3E5FC']],
  evening: [
    ['#3a6daa','#6a9fd4','#a0c8ee','#c8e4f8','#e8f8ff'], // Afternoon blue
    ['#2d4b8e','#7b5b9c','#b3628e','#de7575','#f2a679'], // Sunset
    ['#1a0533','#3b1c54','#5e2f75','#8f4577','#c46671']  // Dusk
  ],
  night: [['#010812','#021428','#0B2044','#122A52','#1A365D']],
  cloudy: [['#37474F','#546E7A','#78909C','#90A4AE','#B0BEC5']],
  rain: [['#0D2137','#1B3A55','#1E4060','#16344F','#1F4366']],
  thunder: [['#080012','#130228','#1E0840','#150332','#25064D']],
  snow: [['#1E3D6B','#2E5A96','#4A7EC2','#7BA8D8','#B8D4EE']],
  fog: [['#5C6B6E','#7A8D90','#9BAAAC','#B8C5C7','#CFD8DA']]
};

function lerpColor(a, b, t) {
  const ah=parseInt(a.slice(1),16), bh=parseInt(b.slice(1),16);
  const [ar,ag,ab]=[(ah>>16)&0xff,(ah>>8)&0xff,ah&0xff];
  const [br,bg,bb]=[(bh>>16)&0xff,(bh>>8)&0xff,bh&0xff];
  return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
}

function getGradient(paletteArray, t) {
  if (paletteArray.length === 1) return paletteArray[0];
  const total = paletteArray.length - 1;
  const idx = Math.min(Math.floor(t * total), total - 1);
  const frac = t * total - idx;
  return paletteArray[idx].map((c, i) => lerpColor(c, paletteArray[idx + 1][i], frac));
}

// --- Time and Weather Logic ---
function getSceneInfo(code, isDayFlag, localHour) {
  let wState = 'clear';
  if ([95,96,99].includes(code)) wState = 'thunder';
  else if ([71,73,75,77,85,86].includes(code)) wState = 'snow';
  else if ([45,48].includes(code)) wState = 'fog';
  else if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) wState = 'rain';
  else if ([1,2,3].includes(code)) wState = 'cloudy';

  // For specific weather events, the weather IS the scene phase.
  if (wState !== 'clear') {
    return { wState, timePhase: wState, sceneKey: wState };
  }

  // If clear, fallback to time phase (morning, day, evening, night)
  let timePhase = 'day';
  if (localHour >= 5 && localHour < 9) timePhase = 'morning';
  else if (localHour >= 9 && localHour < 17) timePhase = 'day';
  else if (localHour >= 17 && localHour < 20) timePhase = 'evening';
  else timePhase = 'night';

  return { wState: 'clear', timePhase, sceneKey: timePhase };
}

// --- Particles ---
class Bird {
  constructor(W, H, startX, wind) {
    this.W = W; this.H = H;
    this.x = startX ?? -120;
    this.baseY = H * (0.06 + Math.random() * 0.28);
    this.speed = (0.55 + Math.random() * 0.7) + (wind * 0.05);
    this.size  = 4 + Math.random() * 5;
    this.waveAmp  = 10 + Math.random() * 12;
    this.waveFreq = 0.006 + Math.random() * 0.006;
    this.flapSpeed = 1.8 + Math.random() * 1.6;
    this.flapPhase = Math.random() * Math.PI * 2;
  }
  update(wind) {
    this.x += this.speed + (wind * 0.02);
    this.y = this.baseY + Math.sin(this.x * this.waveFreq) * this.waveAmp;
    if (this.x > this.W + 120) {
      this.x = -140 - Math.random() * 200;
      this.baseY = this.H * (0.06 + Math.random() * 0.28);
    }
  }
  draw(ctx, ts) {
    const flap = Math.sin(ts * 0.001 * this.flapSpeed + this.flapPhase);
    const wing = flap * this.size * 0.95;
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.strokeStyle = 'rgba(20,10,5,0.6)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(-this.size*.9,-wing,-this.size*2.1,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(this.size*.9,-wing,this.size*2.1,0); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,1.3,0,Math.PI*2); ctx.fillStyle='rgba(20,10,5,0.6)'; ctx.fill();
    ctx.restore();
  }
}

class Cloud {
  constructor(W, H, isDark) {
    this.W = W; this.H = H;
    this.isDark = isDark;
    this.reset();
    // Distribute clouds evenly across the screen on initial load
    this.x = Math.random() * W * 1.5 - W * 0.2; 
  }
  
  reset() {
    this.z = 0.3 + Math.random() * 0.7; // Depth parallax: 0.3 = back, 1.0 = front
    this.r = (60 + Math.random() * 60) * this.z; // Cloud core scale
    this.x = -this.r * 6 - Math.random() * 300;
    this.y = this.H * (0.02 + Math.random() * 0.35); // Clouds stick to top
    this.speed = (0.08 + Math.random() * 0.12) * this.z; 
    
    // Generate a highly realistic cumulus cloud structure
    this.puffs = [];
    const width = this.r * 2.8; // Total width spread
    
    // 1. Bottom layer (flatter, wide base)
    for(let i=0; i<5; i++) {
      this.puffs.push({
        ox: -width/2 + (width * (i/4)),
        oy: (Math.random() - 0.5) * 15, // Keep bottom relatively flat
        rad: this.r * (0.4 + Math.random() * 0.3)
      });
    }
    // 2. Middle layer (bulk of the cloud)
    for(let i=0; i<3; i++) {
      this.puffs.push({
        ox: -width/3 + (width * 0.66 * (i/2)),
        oy: -this.r * (0.4 + Math.random() * 0.3),
        rad: this.r * (0.6 + Math.random() * 0.4)
      });
    }
    // 3. Top layer (highest fluffy peaks)
    for(let i=0; i<2; i++) {
      this.puffs.push({
        ox: -width/6 + (width * 0.33 * i),
        oy: -this.r * (0.8 + Math.random() * 0.3),
        rad: this.r * (0.5 + Math.random() * 0.3)
      });
    }
  }

  update(wind) {
    this.x += this.speed + (wind * 0.05 * this.z);
    // Recycle cloud when it goes fully off screen right
    if (this.x > this.W + this.r * 4) {
      this.reset();
    }
  }

  draw(ctx, alphaMod = 1) {
    const baseAlpha = (this.isDark ? 0.6 : 0.85) * alphaMod * (0.5 + this.z * 0.5);
    
    // Calculate the physical height of the cloud for a perfect vertical gradient
    let minY = 0, maxY = 0;
    this.puffs.forEach(p => {
      minY = Math.min(minY, p.oy - p.rad);
      maxY = Math.max(maxY, p.oy + p.rad);
    });

    // Create a unified top-to-bottom gradient (sunlight hitting tops, shadows on bottom)
    const grad = ctx.createLinearGradient(0, minY, 0, maxY);
    if (this.isDark) {
      grad.addColorStop(0, `rgba(140,155,170,${baseAlpha})`);   // Lighter gray peaks
      grad.addColorStop(1, `rgba(50,65,80,${baseAlpha * 0.9})`); // Dark heavy rain bottoms
    } else {
      grad.addColorStop(0, `rgba(255,255,255,${baseAlpha})`);       // Pure white peaks (sunlight)
      grad.addColorStop(0.7, `rgba(240,245,250,${baseAlpha})`);     // Soft white body
      grad.addColorStop(1, `rgba(200,215,230,${baseAlpha * 0.9})`); // Soft blueish-gray shadow at bottom
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Add a soft atmospheric glow/shadow to the cloud edges
    ctx.shadowColor = this.isDark ? `rgba(30,40,50,${baseAlpha*0.3})` : `rgba(255,255,255,${baseAlpha*0.6})`;
    ctx.shadowBlur = 20 * this.z;
    
    // Draw all puffs as one single interconnected path
    ctx.beginPath();
    this.puffs.forEach(p => {
      ctx.moveTo(p.ox + p.rad, p.oy);
      ctx.arc(p.ox, p.oy, p.rad, 0, Math.PI*2);
    });
    
    // Fill the entire cloud shape with the beautiful vertical gradient
    ctx.fillStyle = grad;
    ctx.fill();
    
    ctx.restore();
  }
}

class RainDrop {
  constructor(W, H, heavy) {
    this.W = W; this.H = H; this.heavy = heavy; this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * this.W;
    // Clouds live around H * 0.05 to H * 0.35.
    // We want rain to start emerging around H * 0.2 to H * 0.3.
    const cloudBase = this.H * 0.2;
    
    // If init, spread them across the screen but BELOW the clouds.
    // If resetting, spawn them exactly at the cloud base.
    this.y = init 
      ? cloudBase + Math.random() * (this.H - cloudBase) 
      : cloudBase - 20 + Math.random() * 60;
      
    this.speed = this.heavy ? 18 + Math.random() * 10 : 9 + Math.random() * 6;
    this.len   = this.heavy ? 25 + Math.random() * 15 : 12 + Math.random() * 10;
    this.alpha = 0.15 + Math.random() * 0.3;
    this.splash = false;
  }
  update(wind) {
    if (this.splash) {
      this.splashLife -= 0.1;
      if (this.splashLife <= 0) this.reset(false);
      return;
    }
    this.y += this.speed;
    this.x += (this.heavy ? 1.5 : 0.5) + (wind * 0.2);
    if (this.y > this.H - 10) {
      if (Math.random() > 0.5) {
        this.splash = true;
        this.splashLife = 1;
        this.y = this.H - 5 + Math.random() * 10;
      } else {
        this.reset(false);
      }
    }
  }
  draw(ctx) {
    if (this.splash) {
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 8 * (1-this.splashLife), 3 * (1-this.splashLife), 0, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(200,220,255,${this.splashLife * 0.5})`;
      ctx.lineWidth = 1; ctx.stroke();
      return;
    }
    ctx.save();
    ctx.strokeStyle = `rgba(180,210,240,${this.alpha})`;
    ctx.lineWidth = this.heavy ? 1.5 : 1;
    ctx.beginPath(); ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + (this.heavy?3:1), this.y + this.len);
    ctx.stroke(); ctx.restore();
  }
}

class SnowFlake {
  constructor(W, H) {
    this.W = W; this.H = H; this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * this.W;
    this.y = init ? Math.random() * this.H : Math.random() * -50;
    this.r = 1 + Math.random() * 2.5;
    this.speed = 0.8 + Math.random() * 1.5;
    this.drift = (Math.random() - 0.5) * 1.5;
    this.alpha = 0.4 + Math.random() * 0.5;
    this.wobble = Math.random() * Math.PI * 2;
  }
  update(wind) {
    this.wobble += 0.05;
    this.y += this.speed; 
    this.x += this.drift + Math.sin(this.wobble) * 0.5 + (wind * 0.15);
    if (this.y > this.H + 10) this.reset(false);
    if (this.x > this.W + 10) this.x = -10;
    if (this.x < -10) this.x = this.W + 10;
  }
  draw(ctx) {
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${this.alpha})`; ctx.fill();
  }
}

class FogLayer {
  constructor(W, H, index) {
    this.W = W; this.H = H; this.index = index;
    this.y = H * (0.3 + index * 0.15);
    this.phase = Math.random() * Math.PI * 2;
  }
  draw(ctx, ts, wind) {
    const yOffset = Math.sin(ts * 0.0003 + this.index * 1.3) * 20;
    const y = this.y + yOffset;
    const g = ctx.createLinearGradient(0, y-80, 0, y+80);
    const alpha = 0.15 + 0.1 * Math.sin(ts * 0.0005 + this.index * 0.8 + wind * 0.01);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${Math.max(0, alpha)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y-80, this.W, 160);
  }
}

class ParticleSystem {
  constructor(scene, W, H, wind) {
    this.scene = scene;
    const { wState, timePhase } = scene;
    
    this.stars = (timePhase === 'night' || timePhase === 'evening') ? Array.from({length: 150}, () => ({
      x: Math.random()*W, y: Math.random()*H*0.7, r: 0.3+Math.random()*1.2, a: Math.random(), tf: 0.5+Math.random()
    })) : [];
    
    this.birds = (timePhase === 'morning' || timePhase === 'day' || timePhase === 'evening') 
      ? Array.from({length: 7}, (_, i) => new Bird(W, H, -100 - i*80, wind)) : [];
      
    this.clouds = [];
    if (wState === 'cloudy' || wState === 'rain' || wState === 'thunder' || wState === 'snow') {
      const isDark = wState !== 'cloudy'; // Rain, thunder, snow use dark clouds
      // Create a massive, dense cloud ceiling for rain and thunder
      const count = (wState === 'rain' || wState === 'thunder') ? 35 : 12;
      this.clouds = Array.from({length: count}, () => new Cloud(W, H, isDark));
    }

    this.drops = (wState === 'rain' || wState === 'thunder') 
      ? Array.from({length: wState === 'thunder' ? 300 : 150}, () => new RainDrop(W, H, wState === 'thunder')) : [];
      
    this.flakes = wState === 'snow' ? Array.from({length: 250}, () => new SnowFlake(W, H)) : [];
    this.fogLayers = wState === 'fog' ? Array.from({length: 5}, (_, i) => new FogLayer(W, H, i)) : [];
    
    this.lightning = wState === 'thunder' ? { active: false, alpha: 0, next: 2000 + Math.random()*5000, bolt: null } : null;
  }
}

function makeBolt(W, H) {
  const x = W * (0.2 + Math.random() * 0.6);
  const pts = [{ x, y: 0 }];
  let cy = 0;
  while (cy < H * 0.8) {
    cy += 30 + Math.random() * 50;
    pts.push({ x: pts[pts.length-1].x + (Math.random()-0.5)*100, y: cy });
  }
  return pts;
}

// --- Renderers ---
function drawSkyGradient(ctx, W, H, palette, cycleProgress = 0) {
  const colors = getGradient(palette, cycleProgress);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.25, colors[1]);
  grad.addColorStop(0.5, colors[2]);
  grad.addColorStop(0.75, colors[3]);
  grad.addColorStop(1, colors[4]);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
}

function drawSun(ctx, W, H, ts, timePhase) {
  const isMorningOrEvening = timePhase === 'morning' || timePhase === 'evening';
  const sx = W * 0.82;
  const sy = isMorningOrEvening ? H * 0.5 : H * 0.15;
  const sr = 45;

  const coreColor = '#FFF59D';
  const glowColor = '255,210,60';

  [[5,.05],[3,.1],[1.8,.15]].forEach(([m,a]) => {
    const g = ctx.createRadialGradient(sx,sy,sr,sx,sy,sr*m);
    g.addColorStop(0,`rgba(${glowColor},${a})`); g.addColorStop(1,`rgba(${glowColor},0)`);
    ctx.beginPath(); ctx.arc(sx,sy,sr*m,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  });

  ctx.save(); ctx.translate(sx,sy); ctx.rotate(ts*0.0002);
  for(let i=0;i<16;i++){
    const a=(i/16)*Math.PI*2, len=sr*(1.2+0.3*Math.sin(ts*0.001+i));
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*sr, Math.sin(a)*sr); ctx.lineTo(Math.cos(a)*(sr+len),Math.sin(a)*(sr+len));
    ctx.strokeStyle=`rgba(${glowColor},${0.08+0.04*Math.sin(ts*0.001+i)})`; ctx.lineWidth=2; ctx.stroke();
  }
  ctx.restore();

  const disk=ctx.createRadialGradient(sx-sr*.2,sy-sr*.2,sr*.1,sx,sy,sr);
  disk.addColorStop(0, '#FFFFFF'); disk.addColorStop(0.4, coreColor); disk.addColorStop(1, '#FFB300');
  ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fillStyle=disk; ctx.fill();
}

function drawMoon(ctx, W, H) {
  const mx=W*0.2, my=H*0.15, mr=32;
  const mg=ctx.createRadialGradient(mx,my,mr,mx,my,mr*4);
  mg.addColorStop(0,'rgba(200,220,255,0.15)'); mg.addColorStop(1,'rgba(200,220,255,0)');
  ctx.beginPath(); ctx.arc(mx,my,mr*4,0,Math.PI*2); ctx.fillStyle=mg; ctx.fill();

  const moonG=ctx.createRadialGradient(mx-mr*.2,my-mr*.2,mr*.1,mx,my,mr);
  moonG.addColorStop(0,'#FFFFFF'); moonG.addColorStop(0.5,'#E3F2FD'); moonG.addColorStop(1,'#90CAF9');
  ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fillStyle=moonG; ctx.fill();

  ctx.beginPath(); ctx.arc(mx+mr*.3,my,mr,0,Math.PI*2); ctx.fillStyle='rgba(5,15,30,0.4)'; ctx.fill();
}

function drawHorizonHaze(ctx, W, H, timePhase) {
  const y = H * 0.7;
  const g = ctx.createLinearGradient(0, y-100, 0, y+100);
  let color = '255,255,255';
  if (timePhase === 'morning' || timePhase === 'evening') color = '255,200,100';
  else if (timePhase === 'day') color = '200,230,255';
  else color = '50,80,120';
  
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.5, `rgba(${color},0.15)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle=g; ctx.fillRect(0, y-100, W, 200);
}

// --- Main Engine ---
export default function SkyBackground({ weatherCode, isDay, localHour, windSpeed }) {
  const canvasRef = useRef(null);
  const propsRef = useRef({ weatherCode, isDay, localHour, windSpeed });
  propsRef.current = { weatherCode, isDay, localHour, windSpeed };

  const engineRef = useRef({
    currentScene: null,
    nextScene: null,
    transitionAlpha: 1, // 1 means currentScene is fully rendered
    particles: null,
    nextParticles: null,
    lastTime: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let raf;

    function renderScene(sceneInfo, sys, ts, alphaMod) {
      if (alphaMod <= 0.01) return;
      ctx.globalAlpha = alphaMod;

      const { wState, timePhase } = sceneInfo;
      
      const palKey = timePhase; 
      const cycleProg = (timePhase === 'morning' || timePhase === 'evening') ? ((ts % 60000) / 60000) : 0;
      drawSkyGradient(ctx, W, H, PALETTES[palKey] || PALETTES.day, cycleProg);

      if (sys.stars.length) {
        sys.stars.forEach(s => {
          const twinkle = 0.5 + 0.5*Math.sin(ts*0.002*s.tf + s.tp);
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
          ctx.fillStyle = `rgba(255,255,255,${s.a*twinkle})`; ctx.fill();
        });
      }

      if (timePhase === 'night') drawMoon(ctx, W, H);
      else if (timePhase === 'morning' || timePhase === 'day' || timePhase === 'evening') drawSun(ctx, W, H, ts, timePhase);

      if (timePhase === 'morning' || timePhase === 'day' || timePhase === 'evening') {
        drawHorizonHaze(ctx, W, H, timePhase);
      }

      // 5. Rain & Thunder (Drawn BEFORE clouds so rain emerges FROM behind them)
      sys.drops.forEach(d => { d.update(propsRef.current.windSpeed); d.draw(ctx); });
      if (sys.lightning) {
        const lt = sys.lightning;
        if (!lt.active && ts > lt.next) {
          lt.active = true; lt.alpha = 1; lt.bolt = makeBolt(W, H);
        }
        if (lt.active) {
          lt.alpha -= 0.03;
          if (lt.alpha <= 0) { lt.active = false; lt.next = ts + 2000 + Math.random()*6000; }
          else {
            ctx.fillStyle = `rgba(230,240,255,${lt.alpha * 0.4})`; ctx.fillRect(0,0,W,H);
            if (lt.bolt) {
              ctx.save(); ctx.strokeStyle = `rgba(255,255,220,${lt.alpha})`;
              ctx.lineWidth = 4; ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
              ctx.beginPath(); lt.bolt.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
              ctx.stroke(); ctx.restore();
            }
          }
        }
      }

      // 6. Clouds (Drawn ON TOP of rain/lightning for realistic depth)
      sys.clouds.forEach(c => { c.update(propsRef.current.windSpeed); c.draw(ctx, alphaMod); });

      // 7. Birds
      sys.birds.forEach(b => { b.update(propsRef.current.windSpeed); b.draw(ctx, ts); });

      // 8. Snow & Fog
      sys.flakes.forEach(f => { f.update(propsRef.current.windSpeed); f.draw(ctx); });
      sys.fogLayers.forEach(f => f.draw(ctx, ts, propsRef.current.windSpeed));

      ctx.globalAlpha = 1;
    }

    function frame(ts) {
      const e = engineRef.current;
      const { weatherCode: wc, isDay: id, localHour: lh, windSpeed: ws } = propsRef.current;
      
      const targetSceneInfo = getSceneInfo(wc, id, lh);

      // Initialize
      if (!e.currentScene) {
        e.currentScene = targetSceneInfo;
        e.particles = new ParticleSystem(targetSceneInfo, W, H, ws);
      } 
      // Trigger Transition
      else if (e.currentScene.sceneKey !== targetSceneInfo.sceneKey && (!e.nextScene || e.nextScene.sceneKey !== targetSceneInfo.sceneKey)) {
        e.nextScene = targetSceneInfo;
        e.nextParticles = new ParticleSystem(targetSceneInfo, W, H, ws);
      }

      // Handle Transition blending
      if (e.nextScene) {
        e.transitionAlpha -= 0.015; // smooth fade
        if (e.transitionAlpha <= 0) {
          e.currentScene = e.nextScene;
          e.particles = e.nextParticles;
          e.nextScene = null;
          e.nextParticles = null;
          e.transitionAlpha = 1;
        }
      }

      // Clear
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);

      // Render
      if (e.nextScene) {
        // Draw new scene underneath, old scene fades out on top
        renderScene(e.nextScene, e.nextParticles, ts, 1);
        renderScene(e.currentScene, e.particles, ts, e.transitionAlpha);
      } else {
        renderScene(e.currentScene, e.particles, ts, 1);
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const e = engineRef.current;
      if (e.particles) e.particles = new ParticleSystem(e.currentScene, W, H, propsRef.current.windSpeed);
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:-2, display:'block', pointerEvents:'none' }}
      aria-hidden="true"
    />
  );
}
