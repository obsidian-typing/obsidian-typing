export class DependencyGraph<Item extends string> {
    private dependents: Partial<Record<Item, Set<Item>>>;
    private dependencies: Partial<Record<Item, Set<Item>>>;

    constructor() {
        this.dependents = {};
        this.dependencies = {};
    }

    addDependency(dependent: Item, dependency: Item): void {
        if (!(dependency in this.dependents)) {
            this.dependents[dependency] = new Set();
        }

        if (!(dependent in this.dependencies)) {
            this.dependencies[dependent] = new Set();
        }

        this.dependents[dependency]!.add(dependent);
        this.dependencies[dependent]!.add(dependency);
    }

    getDependents(dependency: Item): Set<Item> | undefined {
        return this.dependents[dependency];
    }

    getDependencies(dependent: Item): Set<Item> | undefined {
        return this.dependencies[dependent];
    }
}
