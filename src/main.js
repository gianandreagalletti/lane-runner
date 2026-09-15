import Phaser from 'phaser';
import { MenuScene }   from './MenuScene.js';
import { PlanScene }   from './PlanScene.js';
import { RunScene }    from './RunScene.js';
import { ResultScene } from './ResultScene.js';
import { CANVAS_W, CANVAS_H } from './track.js';

new Phaser.Game({
  type:            Phaser.AUTO,
  width:           CANVAS_W,
  height:          CANVAS_H,
  backgroundColor: '#06080f',
  scene:           [MenuScene, PlanScene, RunScene, ResultScene],
  parent:          document.body,
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
