/**
 * Visual effects for reactive boosts.
 * Rock Break — heavy shatter with fragments, camera shake, dust puff.
 * Phase       — translucency flash on player, expanding ripple rings.
 */

/**
 * Rock Break effect: shatters the obstacle into fragments, camera shake, dust.
 * @param {Phaser.Scene} scene
 * @param {object} obs        — obstacle object (has .screenY, .lane)
 * @param {number} laneCenterX
 */
export function rockBreakEffect(scene, obs, laneCenterX) {
  const cx = laneCenterX;
  const cy = obs.screenY;

  // Camera shake
  scene.cameras.main.shake(120, 0.025);

  // Shatter fragments (8–12 rectangles)
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    const w     = 6  + Math.random() * 14;
    const h     = 4  + Math.random() * 10;
    const dur   = 350 + Math.random() * 150;

    const gfx = scene.add.graphics();
    // Vary the rock colour: dark red/brown shards
    const shade = Phaser.Math.Between(0x4a1008, 0x8a3020);
    gfx.fillStyle(shade, 1);
    gfx.fillRect(-w / 2, -h / 2, w, h);
    gfx.x = cx + (Math.random() - 0.5) * 20;
    gfx.y = cy + (Math.random() - 0.5) * 10;
    gfx.setDepth(28);

    scene.tweens.add({
      targets:  gfx,
      x:        gfx.x + Math.cos(angle) * speed,
      y:        gfx.y + Math.sin(angle) * speed,
      alpha:    0,
      angle:    (Math.random() - 0.5) * 360,
      scaleX:   0.1,
      scaleY:   0.1,
      duration: dur,
      ease:     'Quad.easeOut',
      onComplete: () => gfx.destroy()
    });
  }

  // Dust puff: 6–8 small white/grey particles
  const dustCount = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < dustCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 10 + Math.random() * 28;
    const size  = 3  + Math.random() * 4;
    const alpha = 0.55 + Math.random() * 0.35;
    const gray  = Phaser.Math.Between(0xBBBBBB, 0xEEEEEE);

    const gfx = scene.add.graphics();
    gfx.fillStyle(gray, alpha);
    gfx.fillCircle(0, 0, size);
    gfx.x = cx;
    gfx.y = cy;
    gfx.setDepth(29);

    scene.tweens.add({
      targets:  gfx,
      x:        cx + Math.cos(angle) * dist,
      y:        cy + Math.sin(angle) * dist,
      alpha:    0,
      scaleX:   0.2,
      scaleY:   0.2,
      duration: 320 + Math.random() * 120,
      ease:     'Sine.easeOut',
      onComplete: () => gfx.destroy()
    });
  }
}

/**
 * Phase effect: player turns translucent then fades back; soft ripple rings.
 * @param {Phaser.Scene} scene
 * @param {object} player      — Player instance with drawAlpha
 * @param {object} obs         — obstacle object (has .screenY, .lane)
 * @param {number} laneCenterX
 */
export function phaseEffect(scene, player, obs, laneCenterX) {
  const cx = laneCenterX;
  const cy = obs.screenY;

  // Player translucency: drop to 0.4, tween back to 1.0 over 300ms
  player.drawAlpha = 0.4;
  scene.tweens.add({
    targets:  player,
    drawAlpha: 1.0,
    duration: 300,
    ease:     'Sine.easeIn'
  });

  // Two expanding rings
  for (let ring = 0; ring < 2; ring++) {
    const delay = ring * 60;
    const gfx   = scene.add.graphics();
    gfx.setDepth(27);

    // Animate via a proxy object so we can tween a custom property
    const proxy = { radius: 0, alpha: 0.7 };
    scene.tweens.add({
      targets:  proxy,
      radius:   80,
      alpha:    0,
      duration: 300,
      delay,
      ease:     'Sine.easeOut',
      onUpdate: () => {
        gfx.clear();
        gfx.lineStyle(2, 0xAADDFF, proxy.alpha);
        gfx.strokeCircle(cx, cy, proxy.radius);
      },
      onComplete: () => gfx.destroy()
    });
  }
}
