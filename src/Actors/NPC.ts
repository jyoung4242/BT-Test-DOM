import { Actor, BaseAlign, Color, Engine, Font, Label, Meet, MoveTo, Rectangle, TextAlign } from "excalibur";
import { npc, player } from "../main";
import { BehaviorTreeComponent, createBehaviorTree } from "../Components/BehaviorTree";

export class NPC extends Actor {
  speed: number = 100;
  isPlayerDetected: boolean = false;
  hasCaughtPlayer: boolean = false;
  player: Actor;
  distanceLabel: Label;
  bt: BehaviorTreeComponent;
  constructor(player: Actor) {
    super({
      width: 50,
      height: 50,
      color: Color.Blue,
    });

    this.player = player;

    //prettier-ignore
    this.bt = createBehaviorTree(this)
      .sequence("patrol")
        .condition("doIRunMyPatrols", this.doIRunMyPatrols)
        .action("move right", new MoveTo(this, 100, 0, this.speed))
        .action("move down", new MoveTo(this, 100, 100, this.speed))
        .action("move left", new MoveTo(this, 0, 100, this.speed))
        .action("move up", new MoveTo(this, 0, 0, this.speed))
      .end()
      .root()
      .sequence("pursue")
        .condition("doIChasePlayer", this.doIChasePlayer)
        .action("pursue", new Meet(this, this.player, this.speed))
      .end()
      .build();

    this.addComponent(this.bt);

    this.bt.logTree();

    this.distanceLabel = new Label({
      text: "",
      width: 50,
      height: 50,
      x: 0,
      y: 0,
      color: Color.White,
      font: new Font({
        family: "Arial",
        size: 16,
        textAlign: TextAlign.Center,
        baseAlign: BaseAlign.Middle,
      }),
    });
    this.addChild(this.distanceLabel);
  }

  onInitialize(engine: Engine): void {}

  onPreUpdate(engine: Engine, delta: number): void {
    //check for player
    const distance = this.pos.distance(player.pos);
    this.distanceLabel.text = distance.toFixed(0);

    if (!this.isPlayerDetected) {
      this.isPlayerDetected = distance < 200;
      if (this.isPlayerDetected) {
        this.bt.interrupt();
        this.bt.reset();
      }
    }

    if (!this.hasCaughtPlayer) {
      this.hasCaughtPlayer = distance < 5;
    }

    if (distance > 400 && this.isPlayerDetected) {
      this.isPlayerDetected = false;
      this.hasCaughtPlayer = false;
      this.bt.interrupt();
      this.bt.reset();
    }

    if (this.isPlayerDetected && this.hasCaughtPlayer) {
      npc.speed = 0;
    }

    if (this.isPlayerDetected && !this.hasCaughtPlayer) {
      this.changeColor(Color.Yellow);
      this.distanceLabel.color = Color.Black;
    } else if (this.hasCaughtPlayer && this.isPlayerDetected) {
      this.changeColor(Color.Green);
      this.distanceLabel.color = Color.White;
    } else {
      this.changeColor(Color.Blue);
      this.distanceLabel.color = Color.White;
    }
  }

  changeColor(color: Color) {
    let newRaster = new Rectangle({ width: this.width, height: this.height, color: color });
    newRaster.color = color;
    this.graphics.use(newRaster);
  }

  doIChasePlayer = (): boolean => {
    return this.isPlayerDetected && !this.hasCaughtPlayer;
  };

  doIRunMyPatrols = (): boolean => {
    return !this.isPlayerDetected || this.hasCaughtPlayer;
  };
}
