import { ProfilerMetric } from "@/types";
/**
 * Performance profiling utility for measuring execution time of operations
 */
export class Profiler {
  private metrics: Map<string, ProfilerMetric>;

  constructor() {
    this.metrics = new Map();
  }

  /**
   * Registers a new metric to be tracked
   * @param name - The name of the metric
   */
  public add(name: string): void {
    this.metrics.set(name, {
      name,
      start_time: 0,
      end_time: 0,
      delta_time: 0,
    });
  }

  /**
   * Starts timing a specific metric
   * @param name - The name of the metric to start
   */
  public start(name: string): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric "${name}" not found. Call add() first.`);
      return;
    }

    metric.start_time = performance.now();
  }

  /**
   * Stops timing a specific metric and calculates the elapsed time
   * @param name - The name of the metric to stop
   */
  public stop(name: string): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric "${name}" not found. Call add() first.`);
      return;
    }

    metric.end_time = performance.now();
    metric.delta_time = metric.end_time - metric.start_time;
  }

  /**
   * Gets the elapsed time for a specific metric
   * @param name - The name of the metric
   * @returns The elapsed time in milliseconds
   */
  public getTime(name: string): number {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Metric "${name}" not found. Call add() first.`);
      return 0;
    }

    return metric.delta_time;
  }

  /**
   * Gets a formatted log of all metrics
   * @returns A formatted string with all metrics
   */
  public log(): string {
    let result = "";

    this.metrics.forEach((metric) => {
      result += `${metric.name}: ${metric.delta_time.toFixed(2)}ms\n`;
    });

    return result;
  }

  /**
   * Gets all metrics as an array
   * @returns An array of all metrics
   */
  public getMetrics(): ProfilerMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Resets all metrics
   */
  public reset(): void {
    this.metrics.forEach((metric) => {
      metric.start_time = 0;
      metric.end_time = 0;
      metric.delta_time = 0;
    });
  }
}
// Export a singleton instance for global use
export const profiler = new Profiler();
export default profiler;
