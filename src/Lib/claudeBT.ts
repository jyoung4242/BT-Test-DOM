import { Actor, ActorEvents, Component, Engine, Entity } from "excalibur";

/**
 * Status returned from behavior node execution
 */
export enum BehaviorStatus {
  Success = "success",
  Failure = "failure",
  Running = "running",
}

/**
 * Internal state of a behavior node
 */
export enum BehaviorNodeStatus {
  Free = "free",
  Busy = "busy",
  Complete = "complete",
}

/**
 * Configuration for the behavior tree component
 */
export interface BTConfig {
  owner: Actor;
  verbose?: boolean;
  maxExecutionTimeMs?: number; // Limit execution time per frame
}

/**
 * Main component that manages behavior trees for ExcaliburJS entities
 */
export class BehaviorTreeComponent extends Component {
  owner: Actor;
  private _verbose: boolean = false;
  private _root: RootNode;
  private _maxExecutionTimeMs: number;
  private _boundUpdateMethod: (event: ActorEvents["preupdate"]) => void;

  constructor(config: BTConfig) {
    super();
    this.owner = config.owner;
    this._verbose = config.verbose || false;
    this._maxExecutionTimeMs = config.maxExecutionTimeMs || 5; // Default 5ms max execution time
    this._root = new RootNode("root", config.owner, this);
    this._boundUpdateMethod = this.update.bind(this);
  }

  onAdd(owner: Entity): void {
    this.owner.on("preupdate", this._boundUpdateMethod);
  }

  onRemove(previousOwner: Entity): void {
    this.owner.off("preupdate", this._boundUpdateMethod);
  }

  get root(): RootNode {
    return this._root;
  }

  get verbose(): boolean {
    return this._verbose;
  }

  set verbose(value: boolean) {
    this._verbose = value;
  }

  /**
   * Propagates an interrupt signal through the behavior tree
   * @param data Optional data to pass with the interrupt
   */
  interrupt(data?: any): void {
    if (this._verbose) {
      console.info("BT interrupt triggered");
    }
    this._root.interrupt(data);
  }

  /**
   * Update method called each frame
   */
  update(event: ActorEvents["preupdate"]): void {
    if (this._verbose) {
      console.info("BT component update -> root");
    }

    const startTime = performance.now();
    try {
      this._root.update(event.engine, event.elapsed, startTime, this._maxExecutionTimeMs);
    } catch (error) {
      console.error("Error in behavior tree execution:", error);
      // Recover gracefully by resetting state
      this._root.reset();
    }
  }

  /**
   * Clean up resources used by this component
   */
  dispose(): void {
    this._root.dispose();
    this.owner.off("preupdate", this._boundUpdateMethod);
  }

  /**
   * Utility method for logging when verbose mode is enabled
   */
  log(message: string): void {
    if (this._verbose) {
      console.info(message);
    }
  }
}

/**
 * Base class for all behavior tree nodes
 */
export abstract class BehaviorNode {
  owner: Actor;
  parentComponent: BehaviorTreeComponent;
  status: BehaviorNodeStatus = BehaviorNodeStatus.Free;
  protected _isInterrupted: boolean = false;
  protected _interruptData: any = null;
  name: string;

  constructor(name: string, owner: Actor, parentComponent: BehaviorTreeComponent) {
    this.owner = owner;
    this.name = name;
    this.parentComponent = parentComponent;
  }

  /**
   * Set interrupt state and data
   */
  interrupt(data?: any): void {
    this.parentComponent.log(`BT interrupt set on ${this.name}`);
    this._isInterrupted = true;
    this._interruptData = data;
  }

  /**
   * Check if this node has been interrupted
   */
  get isInterrupted(): boolean {
    return this._isInterrupted;
  }

  /**
   * Precondition check before node execution
   */
  precondition(): boolean {
    return true;
  }

  /**
   * Main action for this behavior node
   */
  protected btAction(): void {}

  /**
   * Check if the action is complete
   */
  protected btActionComplete(): boolean {
    return true;
  }

  /**
   * Handle the interrupt state
   */
  protected handleInterrupt(): BehaviorStatus | undefined {
    if (this._isInterrupted) {
      this.parentComponent.log(`BT handling interrupt in ${this.name}`);
      this._isInterrupted = false;
      this._interruptData = null;
      this.reset();
      return BehaviorStatus.Failure;
    }
    return undefined;
  }

  /**
   * Reset this node's state
   */
  reset(): void {
    this.status = BehaviorNodeStatus.Free;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Base implementation - can be overridden by derived classes
  }

  /**
   * Update method called each frame
   * @param engine ExcaliburJS engine
   * @param elapsed Time elapsed since last frame
   * @param startTime Start time of the current update cycle
   * @param maxExecutionTimeMs Maximum allowed execution time
   */
  update(engine: Engine, elapsed: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    this.parentComponent.log(`BT Behavior update -> ${this.name}`);

    // Check timeout
    if (performance.now() - startTime > maxExecutionTimeMs) {
      this.parentComponent.log(`BT execution time limit reached, pausing execution`);
      return BehaviorStatus.Running;
    }

    // Handle interrupt state
    const interruptResult = this.handleInterrupt();
    if (interruptResult !== undefined) {
      return interruptResult;
    }

    // Handle busy state
    if (this.status === BehaviorNodeStatus.Busy) {
      if (this.btActionComplete()) {
        this.status = BehaviorNodeStatus.Complete;
        return BehaviorStatus.Success;
      } else {
        return BehaviorStatus.Running;
      }
    }

    // Handle complete state
    if (this.status === BehaviorNodeStatus.Complete) {
      return BehaviorStatus.Success;
    }

    // Start action if precondition is met
    if (this.precondition()) {
      this.status = BehaviorNodeStatus.Busy;
      this.parentComponent.log(`BT running behavior -> ${this.name}`);
      try {
        this.btAction();

        // If action completes immediately
        if (this.btActionComplete()) {
          this.status = BehaviorNodeStatus.Complete;
          return BehaviorStatus.Success;
        }
      } catch (error) {
        console.error(`Error in behavior node ${this.name}:`, error);
        this.reset();
        return BehaviorStatus.Failure;
      }
    } else {
      // Precondition failed
      return BehaviorStatus.Failure;
    }

    return BehaviorStatus.Running;
  }
}

/**
 * Base class for nodes that can have children
 */
export abstract class CompositeNode extends BehaviorNode {
  protected children: BehaviorNode[] = [];

  /**
   * Add a child node to this composite
   */
  addChild(child: BehaviorNode): this {
    this.children.push(child);
    return this;
  }

  /**
   * Add multiple child nodes
   */
  addChildren(...children: BehaviorNode[]): this {
    this.children.push(...children);
    return this;
  }

  /**
   * Set interrupt state on this node and all children
   */
  interrupt(data?: any): void {
    super.interrupt(data);

    // Propagate to children
    for (const child of this.children) {
      child.interrupt(data);
    }
  }

  /**
   * Clean up resources for this node and all children
   */
  dispose(): void {
    super.dispose();

    // Clean up children
    for (const child of this.children) {
      child.dispose();
    }

    this.children = [];
  }

  /**
   * Reset state for this node and all children
   */
  reset(): void {
    super.reset();

    // Reset all children
    for (const child of this.children) {
      child.reset();
    }
  }
}

/**
 * Root node for the behavior tree
 */
export class RootNode extends CompositeNode {
  constructor(name: string, owner: Actor, parentComponent: BehaviorTreeComponent) {
    super(name, owner, parentComponent);
  }

  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Process each child in order
    for (const child of this.children) {
      // Check time limit
      if (performance.now() - startTime > maxExecutionTimeMs) {
        this.parentComponent.log("BT execution time limit reached in RootNode");
        return BehaviorStatus.Running;
      }

      if (child.precondition()) {
        const result = child.update(engine, delta, startTime, maxExecutionTimeMs);
        if (result !== BehaviorStatus.Failure) {
          return result;
        }
      }
    }
    return BehaviorStatus.Failure;
  }
}

/**
 * Runs children in sequence, succeeding only if all children succeed
 */
export class SequenceNode extends CompositeNode {
  private currentIndex: number = 0;

  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Handle interrupt state
    const interruptResult = this.handleInterrupt();
    if (interruptResult !== undefined) {
      return interruptResult;
    }

    this.parentComponent.log(`BT running sequence -> ${this.name} (at index ${this.currentIndex})`);

    // Check time limit
    if (performance.now() - startTime > maxExecutionTimeMs) {
      this.parentComponent.log("BT execution time limit reached in SequenceNode");
      return BehaviorStatus.Running;
    }

    // No children case
    if (this.children.length === 0) {
      return BehaviorStatus.Success;
    }

    // Process current child
    if (this.currentIndex < this.children.length) {
      const currentChild = this.children[this.currentIndex];

      if (!currentChild.precondition()) {
        // If precondition fails, the sequence fails
        this.reset();
        return BehaviorStatus.Failure;
      }

      const result = currentChild.update(engine, delta, startTime, maxExecutionTimeMs);

      if (result === BehaviorStatus.Running) {
        // Child is still running
        return BehaviorStatus.Running;
      } else if (result === BehaviorStatus.Failure) {
        // Any child failure means sequence failure
        this.reset();
        return BehaviorStatus.Failure;
      } else {
        // Child succeeded, move to next
        this.currentIndex++;
      }
    }

    // Check if sequence is complete
    if (this.currentIndex >= this.children.length) {
      this.reset();
      return BehaviorStatus.Success;
    }

    return BehaviorStatus.Running;
  }

  reset(): void {
    super.reset();
    this.currentIndex = 0;
  }
}

/**
 * Runs children until one succeeds
 */
export class SelectorNode extends CompositeNode {
  private currentIndex: number = 0;

  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Handle interrupt state
    const interruptResult = this.handleInterrupt();
    if (interruptResult !== undefined) {
      return interruptResult;
    }

    this.parentComponent.log(`BT running selector -> ${this.name} (at index ${this.currentIndex})`);

    // Check time limit
    if (performance.now() - startTime > maxExecutionTimeMs) {
      this.parentComponent.log("BT execution time limit reached in SelectorNode");
      return BehaviorStatus.Running;
    }

    // No children case
    if (this.children.length === 0) {
      return BehaviorStatus.Failure;
    }

    // Resume from current index
    while (this.currentIndex < this.children.length) {
      const currentChild = this.children[this.currentIndex];

      if (!currentChild.precondition()) {
        // Skip this child if precondition fails
        this.currentIndex++;
        continue;
      }

      const result = currentChild.update(engine, delta, startTime, maxExecutionTimeMs);

      if (result === BehaviorStatus.Running) {
        // Child is still running
        return BehaviorStatus.Running;
      } else if (result === BehaviorStatus.Success) {
        // Any child success means selector success
        this.reset();
        return BehaviorStatus.Success;
      } else {
        // Child failed, try next one
        this.currentIndex++;
      }
    }

    // All children failed
    this.reset();
    return BehaviorStatus.Failure;
  }

  reset(): void {
    super.reset();
    this.currentIndex = 0;
  }
}

/**
 * Executes all children in parallel
 */
export class ParallelNode extends CompositeNode {
  private childrenStatus: BehaviorStatus[] = [];
  private requiredSuccesses: number;

  /**
   * Create a new parallel node
   * @param name Node name
   * @param owner Actor that owns this node
   * @param parentComponent Parent behavior tree component
   * @param requiredSuccesses Number of children that must succeed for this node to succeed (default: all)
   */
  constructor(name: string, owner: Actor, parentComponent: BehaviorTreeComponent, requiredSuccesses?: number) {
    super(name, owner, parentComponent);
    this.requiredSuccesses = requiredSuccesses || -1; // -1 means all must succeed
  }

  addChild(child: BehaviorNode): this {
    super.addChild(child);
    this.childrenStatus.push(BehaviorStatus.Running);
    return this;
  }

  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Handle interrupt state
    const interruptResult = this.handleInterrupt();
    if (interruptResult !== undefined) {
      return interruptResult;
    }

    this.parentComponent.log(`BT running parallel -> ${this.name}`);

    // Initialize tracking arrays if needed
    if (this.childrenStatus.length !== this.children.length) {
      this.childrenStatus = this.children.map(() => BehaviorStatus.Running);
    }

    let successCount = 0;
    let failureCount = 0;
    let stillRunning = false;

    // Process all children
    for (let i = 0; i < this.children.length; i++) {
      // Check time limit
      if (performance.now() - startTime > maxExecutionTimeMs) {
        this.parentComponent.log("BT execution time limit reached in ParallelNode");
        return BehaviorStatus.Running;
      }

      // Skip already completed children
      if (this.childrenStatus[i] !== BehaviorStatus.Running) {
        if (this.childrenStatus[i] === BehaviorStatus.Success) {
          successCount++;
        } else {
          failureCount++;
        }
        continue;
      }

      // Process child
      const child = this.children[i];
      if (child.precondition()) {
        const result = child.update(engine, delta, startTime, maxExecutionTimeMs);
        this.childrenStatus[i] = result;

        if (result === BehaviorStatus.Success) {
          successCount++;
        } else if (result === BehaviorStatus.Failure) {
          failureCount++;
        } else {
          stillRunning = true;
        }
      } else {
        // Precondition failed
        this.childrenStatus[i] = BehaviorStatus.Failure;
        failureCount++;
      }
    }

    // Check success condition
    const requiredSuccesses = this.requiredSuccesses < 0 ? this.children.length : this.requiredSuccesses;

    if (successCount >= requiredSuccesses) {
      this.reset();
      return BehaviorStatus.Success;
    }

    // Check if enough failures to guarantee overall failure
    const possibleSuccesses = this.children.length - failureCount;
    if (possibleSuccesses < requiredSuccesses) {
      this.reset();
      return BehaviorStatus.Failure;
    }

    // Some nodes still running
    if (stillRunning) {
      return BehaviorStatus.Running;
    }

    // All done but not enough successes
    this.reset();
    return BehaviorStatus.Failure;
  }

  reset(): void {
    super.reset();
    this.childrenStatus = this.children.map(() => BehaviorStatus.Running);
  }
}

/**
 * Base class for decorator nodes
 */
export abstract class DecoratorNode extends BehaviorNode {
  protected child: BehaviorNode | null = null;

  /**
   * Set the child for this decorator
   */
  setChild(child: BehaviorNode): this {
    this.child = child;
    return this;
  }

  /**
   * Propagate interrupt to child
   */
  interrupt(data?: any): void {
    super.interrupt(data);
    if (this.child) {
      this.child.interrupt(data);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    super.dispose();
    if (this.child) {
      this.child.dispose();
      this.child = null;
    }
  }

  /**
   * Reset state
   */
  reset(): void {
    super.reset();
    if (this.child) {
      this.child.reset();
    }
  }
}

/**
 * Inverts the result of its child node
 */
export class InverterNode extends DecoratorNode {
  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Handle interrupt state
    const interruptResult = this.handleInterrupt();
    if (interruptResult !== undefined) {
      return interruptResult;
    }

    this.parentComponent.log(`BT running inverter -> ${this.name}`);

    // Check child exists
    if (!this.child) {
      return BehaviorStatus.Failure;
    }

    // Check time limit
    if (performance.now() - startTime > maxExecutionTimeMs) {
      this.parentComponent.log("BT execution time limit reached in InverterNode");
      return BehaviorStatus.Running;
    }

    // Check precondition
    if (!this.child.precondition()) {
      return BehaviorStatus.Success; // Invert failure to success
    }

    // Process child
    const result = this.child.update(engine, delta, startTime, maxExecutionTimeMs);

    if (result === BehaviorStatus.Running) {
      return BehaviorStatus.Running;
    } else if (result === BehaviorStatus.Success) {
      return BehaviorStatus.Failure; // Invert success to failure
    } else {
      return BehaviorStatus.Success; // Invert failure to success
    }
  }
}

/**
 * Repeats its child until it fails or reaches repeat count
 */
export class RepeatNode extends DecoratorNode {
  private repeatCount: number;
  private currentCount: number = 0;

  /**
   * Create a new repeat node
   * @param name Node name
   * @param owner Actor that owns this node
   * @param parentComponent Parent behavior tree component
   * @param repeatCount Number of times to repeat (-1 for infinite)
   */
  constructor(name: string, owner: Actor, parentComponent: BehaviorTreeComponent, repeatCount: number = -1) {
    super(name, owner, parentComponent);
    this.repeatCount = repeatCount;
  }

  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Handle interrupt state
    const interruptResult = this.handleInterrupt();
    if (interruptResult !== undefined) {
      return interruptResult;
    }

    this.parentComponent.log(`BT running repeat -> ${this.name} (count: ${this.currentCount}/${this.repeatCount})`);

    // Check child exists
    if (!this.child) {
      return BehaviorStatus.Failure;
    }

    // Check time limit
    if (performance.now() - startTime > maxExecutionTimeMs) {
      this.parentComponent.log("BT execution time limit reached in RepeatNode");
      return BehaviorStatus.Running;
    }

    // Check precondition
    if (!this.child.precondition()) {
      this.reset();
      return BehaviorStatus.Failure;
    }

    // Process child
    const result = this.child.update(engine, delta, startTime, maxExecutionTimeMs);

    if (result === BehaviorStatus.Running) {
      return BehaviorStatus.Running;
    } else if (result === BehaviorStatus.Failure) {
      this.reset();
      return BehaviorStatus.Failure;
    } else {
      // Child succeeded
      this.currentCount++;
      this.child.reset();

      // Check if we've reached the repeat count
      if (this.repeatCount > 0 && this.currentCount >= this.repeatCount) {
        this.reset();
        return BehaviorStatus.Success;
      }

      // Continue running
      return BehaviorStatus.Running;
    }
  }

  reset(): void {
    super.reset();
    this.currentCount = 0;
  }
}

/**
 * Runs its child until it fails, always returning success
 */
export class SucceederNode extends DecoratorNode {
  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Handle interrupt state
    const interruptResult = this.handleInterrupt();
    if (interruptResult !== undefined) {
      return interruptResult;
    }

    this.parentComponent.log(`BT running succeeder -> ${this.name}`);

    // Check child exists
    if (!this.child) {
      return BehaviorStatus.Success;
    }

    // Check time limit
    if (performance.now() - startTime > maxExecutionTimeMs) {
      this.parentComponent.log("BT execution time limit reached in SucceederNode");
      return BehaviorStatus.Running;
    }

    // Process child regardless of precondition
    const result = this.child.update(engine, delta, startTime, maxExecutionTimeMs);

    if (result === BehaviorStatus.Running) {
      return BehaviorStatus.Running;
    } else {
      // Always succeed regardless of child result
      return BehaviorStatus.Success;
    }
  }
}

/**
 * Base class for action nodes that perform game-specific actions
 */
export abstract class ActionNode extends BehaviorNode {
  protected isComplete: boolean = false;

  btActionComplete(): boolean {
    return this.isComplete;
  }

  reset(): void {
    super.reset();
    this.isComplete = false;
  }
}

/**
 * A simple action node that completes after a specified time
 */
export class WaitNode extends ActionNode {
  private waitTime: number;
  private elapsedTime: number = 0;

  /**
   * Create a new wait node
   * @param name Node name
   * @param owner Actor that owns this node
   * @param parentComponent Parent behavior tree component
   * @param waitTime Time to wait in milliseconds
   */
  constructor(name: string, owner: Actor, parentComponent: BehaviorTreeComponent, waitTime: number) {
    super(name, owner, parentComponent);
    this.waitTime = waitTime;
  }

  btAction(): void {
    this.elapsedTime = 0;
  }

  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Handle basic node update
    const baseResult = super.update(engine, delta, startTime, maxExecutionTimeMs);
    if (baseResult !== BehaviorStatus.Running || this.status !== BehaviorNodeStatus.Busy) {
      return baseResult;
    }

    // Accumulate time
    this.elapsedTime += delta;

    // Check if wait is complete
    if (this.elapsedTime >= this.waitTime) {
      this.isComplete = true;
      return BehaviorStatus.Success;
    }

    return BehaviorStatus.Running;
  }

  reset(): void {
    super.reset();
    this.elapsedTime = 0;
  }
}

/**
 * Conditional node that checks a condition function
 */
export class ConditionNode extends BehaviorNode {
  private condition: () => boolean;

  /**
   * Create a new condition node
   * @param name Node name
   * @param owner Actor that owns this node
   * @param parentComponent Parent behavior tree component
   * @param condition Function that returns true/false
   */
  constructor(name: string, owner: Actor, parentComponent: BehaviorTreeComponent, condition: () => boolean) {
    super(name, owner, parentComponent);
    this.condition = condition;
  }

  update(engine: Engine, delta: number, startTime: number, maxExecutionTimeMs: number): BehaviorStatus {
    // Handle interrupt state
    const interruptResult = this.handleInterrupt();
    if (interruptResult !== undefined) {
      return interruptResult;
    }

    this.parentComponent.log(`BT evaluating condition -> ${this.name}`);

    try {
      const result = this.condition();
      return result ? BehaviorStatus.Success : BehaviorStatus.Failure;
    } catch (error) {
      console.error(`Error in condition node ${this.name}:`, error);
      return BehaviorStatus.Failure;
    }
  }
}
