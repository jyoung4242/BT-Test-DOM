// main.ts
import "./style.css";

import { UI } from "@peasy-lib/peasy-ui";
import { Engine, DisplayMode, Actor } from "excalibur";
import { model, template } from "./UI/UI";
import { BehaviorTreeComponent, BTConfig, RootNode } from "./Lib/BehaviorTree";

await UI.create(document.body, model, template).attached;

const game = new Engine({
  width: 800, // the width of the canvas
  height: 600, // the height of the canvas
  canvasElementId: "cnv", // the DOM canvas element ID, if you are providing your own
  displayMode: DisplayMode.Fixed, // the display mode
  pixelArt: true,
});

await game.start();

class Player extends Actor {
  bt: BehaviorTreeComponent;
  constructor() {
    super();
    const btConfig: BTConfig = { owner: this, verbose: true };
    this.addComponent((this.bt = new BehaviorTreeComponent(btConfig)));
  }
}
