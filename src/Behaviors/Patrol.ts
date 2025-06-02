//build BT

import { Actor, Meet, MoveTo } from "excalibur";
import { BehaviorNode, BehaviorTreeComponent, SequenceNode } from "../Components/BehaviorTree";
import { NPC } from "../Actors/NPC";

class MoveRight extends BehaviorNode {
  constructor(owner: Actor, parentComponent: BehaviorTreeComponent) {
    super("MoveRight", owner, parentComponent);
  }

  actions = new MoveTo(this.owner as NPC, 100, 0, (this.owner as NPC).speed);
}

class MoveLeft extends BehaviorNode {
  constructor(owner: Actor, parentComponent: BehaviorTreeComponent) {
    super("MoveLeft", owner, parentComponent);
  }

  actions = new MoveTo(this.owner as NPC, 0, 100, (this.owner as NPC).speed);
}

class MoveUp extends BehaviorNode {
  constructor(owner: Actor, parentComponent: BehaviorTreeComponent) {
    super("MoveUp", owner, parentComponent);
  }

  actions = new MoveTo(this.owner as NPC, 0, 0, (this.owner as NPC).speed);
}

class MoveDown extends BehaviorNode {
  constructor(owner: Actor, parentComponent: BehaviorTreeComponent) {
    super("MoveDown", owner, parentComponent);
  }

  actions = new MoveTo(this.owner as NPC, 100, 100, (this.owner as NPC).speed);
}

export class Patrol extends SequenceNode {
  constructor(owner: Actor, parentComponent: BehaviorTreeComponent) {
    super("Patrol", owner, parentComponent);
    this.addChild(new MoveRight(owner, parentComponent));
    this.addChild(new MoveDown(owner, parentComponent));
    this.addChild(new MoveLeft(owner, parentComponent));
    this.addChild(new MoveUp(owner, parentComponent));
  }

  precondition(): boolean {
    // if owner action is in middle of Meet, cancel actions
    if (!(this.owner as NPC).isPlayerDetected) {
      // if owner action is in middle of Meet, cancel actions
      const currentActions = (this.owner as NPC).actions.getQueue().getActions();
      if (currentActions.some(action => action instanceof Meet)) {
        (this.owner as NPC).actions.clearActions();
      }
      return true;
    } else {
      return false;
    }
  }
}
