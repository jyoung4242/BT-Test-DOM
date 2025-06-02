import { Actor, Meet } from "excalibur";
import { SequenceNode, BehaviorTreeComponent, BehaviorNode, BTActions } from "../Components/BehaviorTree";
import { NPC } from "../Actors/NPC";
import { player } from "../main";

class FollowNode extends BehaviorNode {
  constructor(owner: Actor, parentComponent: BehaviorTreeComponent) {
    super("Follow", owner, parentComponent);
  }
  actions: BTActions | null = new Meet(this.owner as NPC, player, (this.owner as NPC).speed);
}

export class Pursue extends SequenceNode {
  constructor(owner: Actor, parentComponent: BehaviorTreeComponent) {
    super("Patrol", owner, parentComponent);
    this.addChild(new FollowNode(owner, parentComponent));
  }

  precondition(): boolean {
    return (this.owner as NPC).isPlayerDetected && !(this.owner as NPC).hasCaughtPlayer;
  }
}
