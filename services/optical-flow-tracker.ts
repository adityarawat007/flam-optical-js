import { DemoOptions } from "../core/demo-options";
import { ImageUtils } from "../core/image-utils";
import CONFIG from "../lib/config";
import { Point2D } from "../types";
// @ts-ignore
import * as jsfeat from "jsfeat";

/**
 * Class for tracking features with Lucas-Kanade optical flow
 */
export class OpticalFlowTracker {
  // DOM Elements
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private referenceWidth: number = 0;
  private referenceHeight: number = 0;
  // Configuration
  public options: DemoOptions;

  // Optical flow parameters
  private curr_img_pyr: jsfeat.pyramid_t;
  private prev_img_pyr: jsfeat.pyramid_t;
  private point_status: Uint8Array;
  private prev_xy: Float32Array;
  private curr_xy: Float32Array;
  private point_count: number = 0;
  private previousCorners: Point2D[] | null = null;
  private grid_distance: number;

  // Matrices for homography calculation
  private base_homography: jsfeat.matrix_t;
  private homo3x3: jsfeat.matrix_t;
  private match_mask: jsfeat.matrix_t;
  private offset: { x: number; y: number; z: number };
  private scale: { x: number; y: number; z: number };

  /**
   * Creates a new OpticalFlowTracker instance
   * @param canvasElement - Canvas element for drawing
   */
  constructor(
    canvasElement: HTMLCanvasElement,
    offset: { x: number; y: number; z: number },
    scale: { x: number; y: number; z: number }
  ) {
    this.canvas = canvasElement;
    this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.grid_distance = CONFIG.GRID_DISTANCE;
    this.point_status = new Uint8Array(CONFIG.MAX_CORNERS);
    this.prev_xy = new Float32Array(CONFIG.MAX_CORNERS * 2);
    this.curr_xy = new Float32Array(CONFIG.MAX_CORNERS * 2);
    this.offset = offset;
    this.scale = scale;

    if (!this.context) {
      throw new Error("Could not get canvas context");
    }

    this.options = new DemoOptions();

    // Initialize profiler metrics
    // profiler.add('pyramid build');
    // profiler.add('optical flow');
    // profiler.add('homography');

    // Initialize optical flow data structures
    this.initializeDataStructures();

    // Set up canvas
    this.setupCanvas();
  }

  /**
   * Initialize optical flow data structures
   */
  private initializeDataStructures(): void {
    // Create image pyramids
    this.curr_img_pyr = new jsfeat.pyramid_t(5);
    this.prev_img_pyr = new jsfeat.pyramid_t(5);

    // Allocate pyramid memory
    this.curr_img_pyr.allocate(
      this.canvas.width,
      this.canvas.height,
      jsfeat.U8_t | jsfeat.C1_t
    );

    this.prev_img_pyr.allocate(
      this.canvas.width,
      this.canvas.height,
      jsfeat.U8_t | jsfeat.C1_t
    );

    // Create matrices for homography calculation
    this.base_homography = new jsfeat.matrix_t(3, 3, jsfeat.F32C1_t);
    this.homo3x3 = new jsfeat.matrix_t(3, 3, jsfeat.F32C1_t);
    this.match_mask = new jsfeat.matrix_t(CONFIG.MAX_CORNERS, 1, jsfeat.U8C1_t);

    // Create arrays for tracking points
    this.point_status = new Uint8Array(CONFIG.MAX_CORNERS);
    this.prev_xy = new Float32Array(CONFIG.MAX_CORNERS * 2);
    this.curr_xy = new Float32Array(CONFIG.MAX_CORNERS * 2);

    // Initialize homography with identity matrix
    jsfeat.matmath.identity_3x3(this.base_homography, 1.0);
  }

  /**
   * Set up canvas and event listeners
   */
  private setupCanvas(): void {
    // Set canvas drawing styles
    this.context.fillStyle = "rgb(255,0,0)";
    this.context.strokeStyle = "rgb(0,255,0)";

    // Add click listener for manual point addition
    this.canvas.addEventListener("click", this.handleCanvasClick.bind(this));
  }

  /**
   * Handle clicks on the canvas to add tracking points
   * @param e - MouseEvent from the click
   */
  private handleCanvasClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Ensure click is within canvas bounds
    if (x > 0 && y > 0 && x < this.canvas.width && y < this.canvas.height) {
      // Add point if we have space
      if (this.point_count < CONFIG.MAX_CORNERS) {
        this.curr_xy[this.point_count * 2] = x;
        this.curr_xy[this.point_count * 2 + 1] = y;
        this.point_count++;
      }
    }
  }

  /**
   * Initialize tracking with a homography matrix
   * @param homography - 3x3 homography matrix
   * @param points - Points to track
   */
  public initWithHomography(
    homography: jsfeat.matrix_t,
    points: Point2D[],
    width?: number,
    height?: number
  ): void {
    // Reset tracking
    this.point_count = 0;
    this.previousCorners = null;

    // Copy homography
    for (let i = 0; i < 9; i++) {
      this.base_homography.data[i] = homography.data[i];
    }

    // Store reference dimensions if provided
    if (width && height) {
      this.referenceWidth = width;
      this.referenceHeight = height;
    } else {
      // Calculate bounding box of the points as fallback
      let minX = Infinity,
        minY = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity;

      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }

      this.referenceWidth = maxX - minX;
      this.referenceHeight = maxY - minY;
    }

    // Add points for tracking
    for (let i = 0; i < points.length && i < CONFIG.MAX_CORNERS; i++) {
      this.curr_xy[this.point_count << 1] = points[i].x;
      this.curr_xy[(this.point_count << 1) + 1] = points[i].y;
      this.point_count++;
    }
  }

  /**
   * Get the current tracking count
   * @returns Number of points being tracked
   */
  public getTrackingCount(): number {
    return this.point_count;
  }

  /**
   * Check if tracking is active
   * @returns True if actively tracking
   */
  public isTracking(): boolean {
    return this.point_count >= this.options.point_threshold;
  }

  /**
   * Process a frame for optical flow tracking
   * @param imageData - Image data to process
   * @returns True if tracking is active
   */
  public processFrame(
    imageData: ImageData,
    drawDampedBox: boolean,
    dampedCorners: Point2D[],
    currentOpticalFrame: number
  ): Point2D[] | boolean {
    // Draw the current frame
    this.context.drawImage(
      this.canvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // Swap previous and current data
    const tmp_xy = this.prev_xy;
    this.prev_xy = this.curr_xy;
    this.curr_xy = tmp_xy;

    const tmp_pyr = this.prev_img_pyr;
    this.prev_img_pyr = this.curr_img_pyr;
    this.curr_img_pyr = tmp_pyr;

    // Check if we have enough points to track
    if (this.checkPointDensity() < 25) {
      this.loseTracking();
      return false;
    }

    // Convert to grayscale and build pyramid
    // profiler.start('pyramid build');
    jsfeat.imgproc.grayscale(
      imageData.data,
      this.canvas.width,
      this.canvas.height,
      this.curr_img_pyr.data[0]
    );
    this.curr_img_pyr.build(this.curr_img_pyr.data[0], true);
    // profiler.stop('pyramid build');

    // Track points with Lucas-Kanade optical flow
    // profiler.start('optical flow');
    jsfeat.optical_flow_lk.track(
      this.prev_img_pyr,
      this.curr_img_pyr,
      this.prev_xy,
      this.curr_xy,
      this.point_count,
      50, // Window size
      50, // Max iterations
      this.point_status,
      0.01, // Epsilon
      0.001 // Min eigen threshold
    );
    // profiler.stop('optical flow');

    // Remove points that couldn't be tracked
    this.pruneFlowPoints();

    // Check if we have enough points left
    if (this.point_count < this.options.point_threshold) {
      this.loseTracking();
      return false;
    }

    // Debug visualization of tracked points
    if (this.options.show_corners) {
      this.drawAllTrackedPoints();
    }

    // Find transformation between frames
    // profiler.start('homography');
    const transformSuccess = this.findTransform();

    // Transform corners and check movement
    if (transformSuccess) {
      const currentCorners = this.transformImageCorners();

      // Check corner movement if we have previous corners
      if (this.previousCorners) {
        const avgMovement = ImageUtils.calculateAverageCornerMovement(
          currentCorners,
          this.previousCorners
        );

        if (avgMovement > this.options.corner_movement_threshold) {
          this.loseTracking();
          return false;
        }
      } else {
        // Store current corners as previous
        this.previousCorners = currentCorners;
      }

      // Render the tracked object shape
      let newDampedCorners: Point2D[];
      if (drawDampedBox) {
        newDampedCorners = currentCorners.map(
          (each: Point2D, index: number) => ({
            x:
              (each.x * currentOpticalFrame +
                dampedCorners[index].x *
                  (CONFIG.MAX_PERSIST_OPTICAL_FRAMES - currentOpticalFrame)) /
              CONFIG.MAX_PERSIST_OPTICAL_FRAMES,
            y:
              (each.y * currentOpticalFrame +
                dampedCorners[index].y *
                  (CONFIG.MAX_PERSIST_OPTICAL_FRAMES - currentOpticalFrame)) /
              CONFIG.MAX_PERSIST_OPTICAL_FRAMES,
          })
        );
      } else {
        newDampedCorners = currentCorners;
      }
      // this.renderPatternShape(this.context, newDampedCorners);
      //   profiler.stop("homography");
      return newDampedCorners;
    } else {
      //   profiler.stop("homography");
      this.loseTracking();
      return false;
    }
  }

  /**
   * Calculate average distance between tracked points
   * @returns Average distance between points
   */
  private checkPointDensity(): number {
    if (this.point_count < 2) return 0;

    let sum = 0;
    let count = 0;

    // Calculate distances between all point pairs
    for (let i = 0; i < this.point_count; i++) {
      for (let j = i + 1; j < this.point_count; j++) {
        const dx = this.curr_xy[i * 2] - this.curr_xy[j * 2];
        const dy = this.curr_xy[i * 2 + 1] - this.curr_xy[j * 2 + 1];
        sum += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Remove points that couldn't be tracked
   */
  private pruneFlowPoints(): void {
    let j = 0;

    // Keep only points with tracking status = 1
    for (let i = 0; i < this.point_count; ++i) {
      if (this.point_status[i] === 1) {
        if (j < i) {
          this.curr_xy[j * 2] = this.curr_xy[i * 2];
          this.curr_xy[j * 2 + 1] = this.curr_xy[i * 2 + 1];
          this.prev_xy[j * 2] = this.prev_xy[i * 2];
          this.prev_xy[j * 2 + 1] = this.prev_xy[i * 2 + 1];
        }

        ++j;
      }
    }

    this.point_count = j;
  }

  /**
   * Draw all tracked points
   */
  private drawAllTrackedPoints(): void {
    this.context.fillStyle = "red";

    for (let i = 0; i < this.point_count; i++) {
      this.context.beginPath();
      this.context.arc(
        this.curr_xy[i * 2],
        this.curr_xy[i * 2 + 1],
        3,
        0,
        2 * Math.PI
      );
      this.context.fill();
    }
  }

  /**
   * Find transformation between frames
   * @returns True if successfully found transform
   */
  private findTransform(): boolean {
    const mm_kernel = new jsfeat.motion_model.homography2d();
    const ransac_param = new jsfeat.ransac_params_t(4, 3, 0.5, 0.99);

    const pattern_xy: Point2D[] = [];
    const screen_xy: Point2D[] = [];

    // Extract point pairs
    for (let i = 0; i < this.point_count; i++) {
      pattern_xy.push({
        x: this.prev_xy[i * 2],
        y: this.prev_xy[i * 2 + 1],
      });

      screen_xy.push({
        x: this.curr_xy[i * 2],
        y: this.curr_xy[i * 2 + 1],
      });
    }

    // Run RANSAC
    const ok = jsfeat.motion_estimator.ransac(
      ransac_param,
      mm_kernel,
      pattern_xy,
      screen_xy,
      this.point_count,
      this.homo3x3,
      this.match_mask,
      1000
    );

    if (!ok) {
      jsfeat.matmath.identity_3x3(this.homo3x3, 1.0);
      return false;
    }

    // Keep only inliers
    let good_cnt = 0;
    for (let i = 0; i < this.point_count; ++i) {
      if (this.match_mask.data[i]) {
        pattern_xy[good_cnt] = pattern_xy[i];
        screen_xy[good_cnt] = screen_xy[i];
        good_cnt++;
      }
    }

    // Update tracked points
    for (let i = 0; i < good_cnt; i++) {
      this.curr_xy[i * 2] = screen_xy[i].x;
      this.curr_xy[i * 2 + 1] = screen_xy[i].y;
    }
    this.point_count = good_cnt;

    // Check if we have enough good matches
    if (this.point_count < this.options.good_match_threshold) {
      this.loseTracking();
      return false;
    }

    // Refine homography with inliers
    mm_kernel.run(pattern_xy, screen_xy, this.homo3x3, good_cnt);

    // Update global homography
    jsfeat.matmath.multiply_3x3(
      this.base_homography,
      this.homo3x3,
      this.base_homography
    );

    return true;
  }

  /**
   * Transform corners using the homography matrix
   * @returns Array of transformed corner points
   */
  private transformImageCorners(): Point2D[] {
    // Use the stored reference dimensions instead of canvas dimensions
    return ImageUtils.transformCorners(
      this.base_homography.data,
      this.referenceWidth,
      this.referenceHeight,
      this.offset,
      this.scale
    );
  }

  /**
   * Render bounding shape for tracked object
   * @param ctx - Canvas context
   * @param shape_pts - Corner points of the shape
   */
  public renderPatternShape(
    ctx: CanvasRenderingContext2D,
    shape_pts: Point2D[]
  ): void {
    // Check if shape is a valid quadrilateral
    if (!this.isQuadrilateral(shape_pts)) {
      return;
    }

    ctx.strokeStyle = "rgb(0,255,0)";
    ctx.beginPath();
    ctx.moveTo(shape_pts[0].x, shape_pts[0].y);
    ctx.lineTo(shape_pts[1].x, shape_pts[1].y);
    ctx.lineTo(shape_pts[2].x, shape_pts[2].y);
    ctx.lineTo(shape_pts[3].x, shape_pts[3].y);
    ctx.lineTo(shape_pts[0].x, shape_pts[0].y);
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  /**
   * Check if a shape is a valid quadrilateral
   * @param shape_pts - Corner points of the shape
   * @returns True if valid quadrilateral
   */
  private isQuadrilateral(shape_pts: Point2D[]): boolean {
    if (shape_pts.length !== 4) {
      return false;
    }

    // Calculate side lengths
    const side1 = this.distance(shape_pts[0], shape_pts[1]);
    const side2 = this.distance(shape_pts[1], shape_pts[2]);
    const side3 = this.distance(shape_pts[2], shape_pts[3]);
    const side4 = this.distance(shape_pts[3], shape_pts[0]);

    // Calculate diagonals
    const diag1 = this.distance(shape_pts[0], shape_pts[2]);
    const diag2 = this.distance(shape_pts[1], shape_pts[3]);

    // Calculate angles using law of cosines
    const angle1 = Math.acos(
      (side1 * side1 + side4 * side4 - diag2 * diag2) / (2 * side1 * side4)
    );

    const angle2 = Math.acos(
      (side1 * side1 + side2 * side2 - diag1 * diag1) / (2 * side1 * side2)
    );

    const angle3 = Math.acos(
      (side2 * side2 + side3 * side3 - diag2 * diag2) / (2 * side2 * side3)
    );

    const angle4 = Math.acos(
      (side3 * side3 + side4 * side4 - diag1 * diag1) / (2 * side3 * side4)
    );

    // Convert to degrees and sum
    const angleSumDeg = (angle1 + angle2 + angle3 + angle4) * (180 / Math.PI);

    // A quadrilateral's interior angles should sum to 360 degrees
    if (Math.abs(angleSumDeg - 360) > 5) {
      return false;
    }

    // Check none of the angles are extremely acute or obtuse
    const anglesDeg = [angle1, angle2, angle3, angle4].map(
      (angle) => angle * (180 / Math.PI)
    );

    return anglesDeg.every((angle) => angle > 15 && angle < 165);
  }

  /**
   * Calculate distance between two points
   * @param p1 - First point
   * @param p2 - Second point
   * @returns Euclidean distance
   */
  private distance(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Reset tracking state
   */
  private loseTracking(): void {
    this.point_count = 0;
    this.previousCorners = null;
    jsfeat.matmath.identity_3x3(this.base_homography, 1.0);
  }

  /**
   * Add points from a grid within a quadrilateral
   * @param shape_pts - Corner points of the quadrilateral
   */
  public addGridPoints(shape_pts: Point2D[]): void {
    if (this.point_count >= CONFIG.MAX_CORNERS) {
      return;
    }

    const gridPoints = ImageUtils.getInsidePoints(
      shape_pts,
      this.grid_distance
    );

    for (const point of gridPoints) {
      if (this.point_count >= CONFIG.MAX_CORNERS) {
        break;
      }

      this.curr_xy[this.point_count * 2] = point.x;
      this.curr_xy[this.point_count * 2 + 1] = point.y;
      this.point_count++;
    }
  }
}

export default OpticalFlowTracker;
