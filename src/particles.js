/**
 * Spawn a brief particle burst at world position (x, y).
 * Uses Phaser Graphics + tweens — no asset files.
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {number} color   hex color (e.g. 0xFF4422)
 * @param {number} count   particle count (default 14)
 */
export function spawnBurst(scene, x, y, color = 0xFF4422, count = 14) {
  for (let i = 0; i < count; i++) {
    const angle  = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist   = 50 + Math.random() * 70;
    const size   = 3 + Math.random() * 6;
    const dur    = 350 + Math.random() * 200;

    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(-size / 2, -size / 2, size, size);
    g.x = x;
    g.y = y;
    g.setDepth(30);

    scene.tweens.add({
      targets:  g,
      x:        x + Math.cos(angle) * dist,
      y:        y + Math.sin(angle) * dist,
      alpha:    0,
      scaleX:   0.2,
      scaleY:   0.2,
      duration: dur,
      ease:     'Quad.easeOut',
      onComplete: () => g.destroy()
    });
  }
}
