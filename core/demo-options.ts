import CONFIG from "../lib/config";
//@ts-ignore

/**
 * Class for storing and managing demo configuration options
 */
export class DemoOptions {
  /**
   * Size of the Gaussian blur kernel
   */
  public blur_size: number = CONFIG.BLUR_SIZE;

  /**
   * Laplacian threshold for feature detection
   */
  public lap_thres: number = CONFIG.LAP_THRESHOLD;

  /**
   * Eigenvalue threshold for feature detection
   */
  public eigen_thres: number = CONFIG.EIGEN_THRESHOLD;

  /**
   * Threshold for matching features (lower = more strict)
   */
  public match_threshold: number = CONFIG.MATCH_THRESHOLD;

  public pattern_corners: any = [];

  /**
   * Distance between grid points
   */
  //   public grid_distance: number = CONFIG.GRID_DISTANCE;

  /**
   * Threshold for minimum number of points for tracking
   */
  public point_threshold: number = CONFIG.POINT_THRESHOLD;

  /**
   * Threshold for minimum number of good matches
   */
  public good_match_threshold: number = CONFIG.GOOD_MATCH_THRESHOLD_TRACKING;

  /**
   * Maximum allowed movement of corners between frames
   */
  public corner_movement_threshold: number = CONFIG.PRUNE_THRESHOLD;

  /**
   * Show debug information for corners
   */
  public show_corners: boolean = CONFIG.DEBUG.SHOW_CORNERS;

  /**
   * Show debug information for matches
   */
  public show_matches: boolean = CONFIG.DEBUG.SHOW_MATCHES;

  /**
   * Creates a new DemoOptions instance with default values
   */
  constructor() {}

  /**
   * Reset all options to their default values
   */
  public reset(): void {
    this.blur_size = CONFIG.BLUR_SIZE;
    this.lap_thres = CONFIG.LAP_THRESHOLD;
    this.eigen_thres = CONFIG.EIGEN_THRESHOLD;
    this.match_threshold = CONFIG.MATCH_THRESHOLD;
    // this.grid_distance = CONFIG.GRID_DISTANCE;
    this.point_threshold = CONFIG.POINT_THRESHOLD;
    this.good_match_threshold = CONFIG.GOOD_MATCH_THRESHOLD_TRACKING;
    this.corner_movement_threshold = CONFIG.PRUNE_THRESHOLD;
    this.show_corners = CONFIG.DEBUG.SHOW_CORNERS;
    this.show_matches = CONFIG.DEBUG.SHOW_MATCHES;
  }
}

export default DemoOptions;
