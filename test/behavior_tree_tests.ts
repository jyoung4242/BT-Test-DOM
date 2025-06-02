import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Actor, Engine, Action } from "excalibur";
import {
  BehaviorTreeComponent,
  BehaviorStatus,
  createBehaviorTree,
  ActionNode,
  FunctionConditionNode,
  InverterNode,
  RepeaterNode,
} from "../src/Components/BehaviorTree"; // Adjust import path as needed

// Mock Excalibur classes
class MockAction extends Action {
  private _isComplete = false;
  private _duration: number;
  private _elapsed = 0;

  constructor(duration = 100) {
    super();
    this._duration = duration;
  }

  update(elapsed: number): void {
    this._elapsed += elapsed;
    if (this._elapsed >= this._duration) {
      this._isComplete = true;
    }
  }

  isComplete(): boolean {
    return this._isComplete;
  }

  reset(): void {
    this._isComplete = false;
    this._elapsed = 0;
  }
}

// Mock Actor with action management
class MockActor extends Actor {
  actions = {
    runAction: vi.fn(),
    clearActions: vi.fn(),
  };

  constructor() {
    super();
  }
}

// Mock Engine
class MockEngine extends Engine {
  constructor() {
    super();
  }
}

describe("BehaviorTreeComponent", () => {
  let actor: MockActor;
  let engine: MockEngine;

  beforeEach(() => {
    actor = new MockActor();
    engine = new MockEngine();
    vi.clearAllMocks();
  });

  describe("Basic Component Creation", () => {
    it("should create a component with default selector root", () => {
      const component = new BehaviorTreeComponent({ owner: actor });

      expect(component.owner).toBe(actor);
      expect(component.root.constructor.name).toBe("SelectorNode");
      expect(component.root.name).toBe("root");
    });

    it("should create a component with sequence root when specified", () => {
      const component = new BehaviorTreeComponent({
        owner: actor,
        rootType: "Sequence",
      });

      expect(component.root.constructor.name).toBe("SequenceNode");
    });

    it("should handle interrupt and reset events", () => {
      const component = new BehaviorTreeComponent({ owner: actor });

      // Should not throw
      component.interrupt();
      component.reset();

      expect(true).toBe(true); // If we get here, no exceptions were thrown
    });
  });

  describe("Node Status Management", () => {
    it("should initialize nodes with Ready status", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      expect(component.root.status).toBe(BehaviorStatus.Ready);
    });

    it("should handle state changes through processStateChanges", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const mockAction = new MockAction(50);
      const actionNode = new ActionNode("test", actor, component, mockAction);

      // Trigger interrupt
      component.interrupt();

      // Process state changes
      const stateChanged = actionNode.processStateChanges();

      expect(stateChanged).toBe(true);
      expect(actionNode.isInterrupted).toBe(true);
      expect(actionNode.status).toBe(BehaviorStatus.Failure);
    });
  });

  describe("ActionNode", () => {
    it("should run action on first update and return Running", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const mockAction = new MockAction(100);
      const actionNode = new ActionNode("test-action", actor, component, mockAction);

      const result = actionNode.update(engine, 16);

      expect(actor.actions.runAction).toHaveBeenCalledWith(mockAction);
      expect(result).toBe(BehaviorStatus.Running);
    });

    it("should return Success when action completes", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const mockAction = new MockAction(0); // Completes immediately
      mockAction.update(100); // Make it complete
      const actionNode = new ActionNode("test-action", actor, component, mockAction);

      const result = actionNode.update(engine, 16);

      expect(result).toBe(BehaviorStatus.Success);
    });

    it("should handle interruption properly", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const mockAction = new MockAction(100);
      const actionNode = new ActionNode("test-action", actor, component, mockAction);

      // Start the action
      actionNode.update(engine, 16);

      // Interrupt it
      component.interrupt();
      actionNode.processStateChanges();

      const result = actionNode.update(engine, 16);

      expect(result).toBe(BehaviorStatus.Failure);
      expect(actor.actions.clearActions).toHaveBeenCalled();
    });
  });

  describe("ConditionNode", () => {
    it("should return Success when condition is true", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const conditionNode = new FunctionConditionNode("test-condition", actor, component, () => true);

      const result = conditionNode.update(engine, 16);

      expect(result).toBe(BehaviorStatus.Success);
    });

    it("should return Failure when condition is false", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const conditionNode = new FunctionConditionNode("test-condition", actor, component, () => false);

      const result = conditionNode.update(engine, 16);

      expect(result).toBe(BehaviorStatus.Failure);
    });
  });

  describe("SequenceNode", () => {
    it("should execute children in order and return Success when all succeed", () => {
      const component = new BehaviorTreeComponent({
        owner: actor,
        rootType: "Sequence",
      });

      // Add conditions that will succeed
      const condition1 = new FunctionConditionNode("cond1", actor, component, () => true);
      const condition2 = new FunctionConditionNode("cond2", actor, component, () => true);

      component.root.addChild(condition1);
      component.root.addChild(condition2);

      // First update - should execute first child
      let result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Running);

      // Second update - should execute second child and complete
      result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Success);
    });

    it("should return Failure immediately if any child fails", () => {
      const component = new BehaviorTreeComponent({
        owner: actor,
        rootType: "Sequence",
      });

      const condition1 = new FunctionConditionNode("cond1", actor, component, () => true);
      const condition2 = new FunctionConditionNode("cond2", actor, component, () => false);

      component.root.addChild(condition1);
      component.root.addChild(condition2);

      // First update - first child succeeds
      let result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Running);

      // Second update - second child fails
      result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Failure);
    });
  });

  describe("SelectorNode", () => {
    it("should return Success when first child succeeds", () => {
      const component = new BehaviorTreeComponent({ owner: actor }); // Default is Selector

      const condition1 = new FunctionConditionNode("cond1", actor, component, () => true);
      const condition2 = new FunctionConditionNode("cond2", actor, component, () => false);

      component.root.addChild(condition1);
      component.root.addChild(condition2);

      const result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Success);
    });

    it("should try next child when current child fails", () => {
      const component = new BehaviorTreeComponent({ owner: actor });

      const condition1 = new FunctionConditionNode("cond1", actor, component, () => false);
      const condition2 = new FunctionConditionNode("cond2", actor, component, () => true);

      component.root.addChild(condition1);
      component.root.addChild(condition2);

      // First update - first child fails, tries second
      let result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Running);

      // Second update - second child succeeds
      result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Success);
    });

    it("should return Failure when all children fail", () => {
      const component = new BehaviorTreeComponent({ owner: actor });

      const condition1 = new FunctionConditionNode("cond1", actor, component, () => false);
      const condition2 = new FunctionConditionNode("cond2", actor, component, () => false);

      component.root.addChild(condition1);
      component.root.addChild(condition2);

      // First update - first child fails
      let result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Running);

      // Second update - second child fails, all exhausted
      result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Failure);
    });
  });

  describe("Decorator Nodes", () => {
    describe("InverterNode", () => {
      it("should invert Success to Failure", () => {
        const component = new BehaviorTreeComponent({ owner: actor });
        const inverter = new InverterNode("inverter", actor, component);
        const condition = new FunctionConditionNode("cond", actor, component, () => true);

        inverter.setChild(condition);

        const result = inverter.update(engine, 16);
        expect(result).toBe(BehaviorStatus.Failure);
      });

      it("should invert Failure to Success", () => {
        const component = new BehaviorTreeComponent({ owner: actor });
        const inverter = new InverterNode("inverter", actor, component);
        const condition = new FunctionConditionNode("cond", actor, component, () => false);

        inverter.setChild(condition);

        const result = inverter.update(engine, 16);
        expect(result).toBe(BehaviorStatus.Success);
      });

      it("should pass through Running status", () => {
        const component = new BehaviorTreeComponent({ owner: actor });
        const inverter = new InverterNode("inverter", actor, component);
        const mockAction = new MockAction(100);
        const actionNode = new ActionNode("action", actor, component, mockAction);

        inverter.setChild(actionNode);

        const result = inverter.update(engine, 16);
        expect(result).toBe(BehaviorStatus.Running);
      });
    });

    describe("RepeaterNode", () => {
      it("should repeat child indefinitely when no count specified", () => {
        const component = new BehaviorTreeComponent({ owner: actor });
        const repeater = new RepeaterNode("repeater", actor, component);
        const condition = new FunctionConditionNode("cond", actor, component, () => true);

        repeater.setChild(condition);

        // Should keep running even after child succeeds
        let result = repeater.update(engine, 16);
        expect(result).toBe(BehaviorStatus.Running);

        result = repeater.update(engine, 16);
        expect(result).toBe(BehaviorStatus.Running);
      });

      it("should repeat child specified number of times", () => {
        const component = new BehaviorTreeComponent({ owner: actor });
        const repeater = new RepeaterNode("repeater", actor, component, 2);
        const condition = new FunctionConditionNode("cond", actor, component, () => true);

        repeater.setChild(condition);

        // First iteration
        let result = repeater.update(engine, 16);
        expect(result).toBe(BehaviorStatus.Running);

        // Second iteration - should complete
        result = repeater.update(engine, 16);
        expect(result).toBe(BehaviorStatus.Success);
      });

      it("should handle child failure", () => {
        const component = new BehaviorTreeComponent({ owner: actor });
        const repeater = new RepeaterNode("repeater", actor, component, 2);
        const condition = new FunctionConditionNode("cond", actor, component, () => false);

        repeater.setChild(condition);

        const result = repeater.update(engine, 16);
        expect(result).toBe(BehaviorStatus.Failure);
      });
    });
  });

  describe("Builder Pattern", () => {
    it("should create a simple sequence tree", () => {
      const tree = createBehaviorTree(actor, "Sequence")
        .condition("check-health", () => true)
        .action("move-forward", new MockAction(50))
        .condition("check-target", () => false)
        .build();

      expect(tree.root.constructor.name).toBe("SequenceNode");
      expect(tree.root.children.length).toBe(3);
      expect(tree.root.children[0].constructor.name).toBe("FunctionConditionNode");
      expect(tree.root.children[1].constructor.name).toBe("ActionNode");
      expect(tree.root.children[2].constructor.name).toBe("FunctionConditionNode");
    });

    it("should create a nested tree structure", () => {
      const tree = createBehaviorTree(actor) // Default selector
        .sequence("patrol")
        .condition("has-energy", () => true)
        .action("move-to-point", new MockAction(100))
        .end()
        .action("idle", new MockAction(50))
        .build();

      expect(tree.root.constructor.name).toBe("SelectorNode");
      expect(tree.root.children.length).toBe(2);
      expect(tree.root.children[0].constructor.name).toBe("SequenceNode");
      expect(tree.root.children[1].constructor.name).toBe("ActionNode");
    });

    it("should create decorator nodes", () => {
      const tree = createBehaviorTree(actor)
        .inverter("not-healthy")
        .condition("is-healthy", () => true)
        .end()
        .repeater("patrol-loop", 3)
        .action("patrol", new MockAction(100))
        .end()
        .build();

      expect(tree.root.children.length).toBe(2);
      expect(tree.root.children[0].constructor.name).toBe("InverterNode");
      expect(tree.root.children[1].constructor.name).toBe("RepeaterNode");
    });

    it("should handle function-based actions", () => {
      const actionFn = () => new MockAction(75);

      const tree = createBehaviorTree(actor).action("dynamic-action", actionFn).build();

      expect(tree.root.children.length).toBe(1);
      expect(tree.root.children[0].constructor.name).toBe("ActionNode");
    });
  });

  describe("Interrupt and Reset Behavior", () => {
    it("should interrupt running actions", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const mockAction = new MockAction(1000); // Long-running action
      const actionNode = new ActionNode("long-action", actor, component, mockAction);

      // Start the action
      actionNode.update(engine, 16);
      expect(actor.actions.runAction).toHaveBeenCalled();

      // Interrupt
      component.interrupt();
      actionNode.processStateChanges();

      // Should clear actions and return failure
      expect(actor.actions.clearActions).toHaveBeenCalled();
      expect(actionNode.status).toBe(BehaviorStatus.Failure);
    });

    it("should reset nodes to Ready state", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const actionNode = new ActionNode("test", actor, component, new MockAction(50));

      // Set to running
      actionNode.update(engine, 16);

      // Reset
      component.reset();
      actionNode.processStateChanges();

      expect(actionNode.status).toBe(BehaviorStatus.Ready);
      expect(actionNode.isInterrupted).toBe(false);
    });

    it("should handle interrupt in composite nodes", () => {
      const tree = createBehaviorTree(actor, "Sequence")
        .action("action1", new MockAction(100))
        .action("action2", new MockAction(100))
        .build();

      // Start execution
      tree.root.update(engine, 16);

      // Interrupt
      tree.interrupt();
      tree.root.processStateChanges();

      const result = tree.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Failure);
    });
  });

  describe("Tree Logging", () => {
    it("should log tree structure without errors", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const tree = createBehaviorTree(actor)
        .sequence("main")
        .condition("check", () => true)
        .action("act", new MockAction(50))
        .end()
        .build();

      // Should not throw
      tree.logTree();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty composite nodes", () => {
      const component = new BehaviorTreeComponent({ owner: actor });

      const result = component.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Failure);
    });

    it("should prevent adding null children", () => {
      const component = new BehaviorTreeComponent({ owner: actor });

      expect(() => {
        component.root.addChild(null as any);
      }).toThrow("Child cannot be null");
    });

    it("should prevent adding duplicate children", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const child = new FunctionConditionNode("test", actor, component, () => true);

      component.root.addChild(child);

      expect(() => {
        component.root.addChild(child);
      }).toThrow("Child already exists in this node");
    });

    it("should handle decorator with no child", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const inverter = new InverterNode("inverter", actor, component);

      const result = inverter.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Failure);
    });
  });

  describe("Component Lifecycle", () => {
    it("should handle onAdd and onRemove properly", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const onSpy = vi.spyOn(actor, "on");
      const offSpy = vi.spyOn(actor, "off");

      // Simulate adding to entity
      component.onAdd(actor);
      expect(onSpy).toHaveBeenCalledWith("preupdate", expect.any(Function));

      // Simulate removing from entity
      component.onRemove(actor);
      expect(offSpy).toHaveBeenCalledWith("preupdate", expect.any(Function));
    });

    it("should clean up node event handlers on destroy", () => {
      const component = new BehaviorTreeComponent({ owner: actor });
      const actionNode = new ActionNode("test", actor, component, new MockAction(50));

      const offSpy = vi.spyOn(component.interruptEmitter, "off");

      actionNode.destroy();

      expect(offSpy).toHaveBeenCalledTimes(2); // interrupt and reset handlers
    });
  });

  describe("Integration Tests", () => {
    it("should execute a complete behavior tree simulation", () => {
      let health = 100;
      let hasTarget = false;
      let position = 0;

      const tree = createBehaviorTree(actor)
        .sequence("combat")
        .condition("has-health", () => health > 0)
        .condition("has-target", () => hasTarget)
        .action("attack", new MockAction(100))
        .end()
        .sequence("patrol")
        .condition("has-health", () => health > 0)
        .action("move", () => {
          position += 10;
          return new MockAction(50);
        })
        .end()
        .action("rest", new MockAction(200))
        .build();

      // First update - should try combat, fail on has-target, try patrol
      let result = tree.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Running); // Should be running patrol

      // Complete patrol movement
      result = tree.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Running);

      result = tree.root.update(engine, 16);
      expect(result).toBe(BehaviorStatus.Success); // Patrol completed
      expect(position).toBe(10); // Movement occurred
    });
  });
});

describe("Utility Functions", () => {
  let actor: MockActor;

  beforeEach(() => {
    actor = new MockActor();
  });

  it("should create behavior tree through utility function", () => {
    const tree = createBehaviorTree(actor, "Sequence");

    expect(tree).toBeDefined();
    expect(tree.build().root.constructor.name).toBe("SequenceNode");
  });
});
