import CONFIG from "../lib/config";
//@ts-ignore
import * as jsfeat from "jsfeat";

/**
 * Class to store and manage keypoint data for feature detection and tracking
 */
export class PointData {
  private corners: jsfeat.keypoint_t[][] = [];
  private descriptors: jsfeat.matrix_t[] = [];
  private preview: jsfeat.matrix_t | null = null;

  /**
   * Creates a new PointData instance
   * @param corners - Array of keypoint arrays for each level (optional)
   * @param descriptors - Array of descriptor matrices for each level (optional)
   * @param preview - Preview matrix (optional)
   */
  constructor(
    corners?: jsfeat.keypoint_t[][],
    descriptors?: jsfeat.matrix_t[],
    preview?: jsfeat.matrix_t | null
  ) {
    if (corners) {
      this.corners = corners;
    } else {
      // Initialize empty corners array
      this.corners = [];
      for (let i = 0; i < CONFIG.NUM_TRAIN_LEVELS; i++) {
        this.corners[i] = [];
      }
    }

    if (descriptors) {
      this.descriptors = descriptors;
    } else {
      // Initialize empty descriptors array
      this.descriptors = [];
      for (let i = 0; i < CONFIG.NUM_TRAIN_LEVELS; i++) {
        this.descriptors[i] = null as any;
      }
    }

    this.preview = preview || null;
  }

  /**
   * Get the keypoint corners
   * @returns Array of keypoint arrays for each level
   */
  public getCorners(): jsfeat.keypoint_t[][] {
    return this.corners;
  }

  /**
   * Get the keypoint descriptors
   * @returns Array of descriptor matrices for each level
   */
  public getDescriptors(): jsfeat.matrix_t[] {
    return this.descriptors;
  }

  /**
   * Get the preview matrix
   * @returns The preview matrix or null if not available
   */
  public getPreview(): jsfeat.matrix_t | null {
    return this.preview;
  }

  public setPoints(pointData: any): any {
    this.corners = pointData.corners;
    this.descriptors = pointData.descriptors;
    this.preview = pointData.preview;
  }

  /**
   * Get corners at a specific level
   * @param level - Level index
   * @returns Array of keypoints at the specified level or empty array if level is invalid
   */
  public getCornersAtLevel(level: number): jsfeat.keypoint_t[] {
    if (level >= 0 && level < this.corners.length) {
      return this.corners[level];
    }
    return [];
  }

  /**
   * Get descriptors at a specific level
   * @param level - Level index
   * @returns Descriptor matrix at the specified level or null if level is invalid
   */
  public getDescriptorsAtLevel(level: number): jsfeat.matrix_t | null {
    if (level >= 0 && level < this.descriptors.length) {
      return this.descriptors[level];
    }
    return null;
  }

  /**
   * Get the number of keypoints at a specific level
   * @param level - Level index
   * @returns Number of keypoints at the level
   */
  public getKeypointCount(level: number = 0): number {
    if (level >= 0 && level < this.corners.length) {
      // Count keypoints with valid scores (score > 0)
      let count = 0;
      for (const point of this.corners[level]) {
        if (point && point.score > 0) count++;
      }
      return count;
    }
    return 0;
  }

  /**
   * Get the total number of keypoints across all levels
   * @returns Total number of keypoints
   */
  public getTotalKeypointCount(): number {
    let total = 0;
    for (let i = 0; i < this.corners.length; i++) {
      total += this.getKeypointCount(i);
    }
    return total;
  }

  /**
   * Add a new keypoint to a specific level
   * @param keypoint - Keypoint to add
   * @param level - Level to add the keypoint to
   */
  public addKeypoint(keypoint: jsfeat.keypoint_t, level: number = 0): void {
    if (level >= 0 && level < CONFIG.NUM_TRAIN_LEVELS) {
      this.corners[level].push(keypoint);
    }
  }

  /**
   * Check if point data has valid keypoints
   * @returns True if at least one level has keypoints, false otherwise
   */
  public hasKeypoints(): boolean {
    return this.getTotalKeypointCount() > 0;
  }

  /**
   * Clear all keypoint data
   */
  public clear(): void {
    this.corners = [];
    this.descriptors = [];
    this.preview = null;

    // Reinitialize arrays
    for (let i = 0; i < CONFIG.NUM_TRAIN_LEVELS; i++) {
      this.corners[i] = [];
      this.descriptors[i] = null as any;
    }
  }

  /**
   * Create a copy of this point data
   * @returns A new PointData instance with the same data
   */
  public clone(): PointData {
    return new PointData(
      this.corners.map((level) => [...level]),
      [...this.descriptors],
      this.preview
    );
  }
}

export default PointData;
