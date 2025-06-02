import { Actor, Color, Engine } from "excalibur";
import { KeyboardControl } from "../Components/KeyboardControl";

export class Player extends Actor {
  speed: number = 200;
  keyControl: KeyboardControl;
  constructor() {
    super({
      width: 50,
      height: 50,
      color: Color.Red,
      x: 400,
      y: 200,
    });
    this.addComponent((this.keyControl = new KeyboardControl(this.speed)));
  }

  onInitialize(engine: Engine): void {
    engine.currentScene.camera.strategy.lockToActor(this);
    this.keyControl.init(this);
  }
}
