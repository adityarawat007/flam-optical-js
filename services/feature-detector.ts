import DemoOptions from "../core/demo-options";
import ImageUtils from "../core/image-utils";
import Match from "../core/match";
import CONFIG from "../lib/config";
import { Point2D } from "../types";
//@ts-ignore
import * as jsfeat from "jsfeat";

/**
 * Class for detecting features in images and matching against a pattern
 */
export class FeatureDetector {
  // DOM Elements
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trainted_pattern_corners: any;
  // Configuration
  public options: DemoOptions;

  // Detection state
  private found: boolean = false;
  //   private count: number = 0;
  private good_screen_points: Point2D[] = [];
  //   private good_pattern_points: Point2D[] = [];

  // JSFeat matrices
  private img_u8: jsfeat.matrix_t;
  private img_u8_smooth: jsfeat.matrix_t;
  private screen_descriptors: jsfeat.matrix_t;
  private screen_corners: any;
  private matches: any;
  private homo3x3: jsfeat.matrix_t;
  private match_mask: jsfeat.matrix_t;
  private offset: { x: number; y: number; z: number };
  private scale: { x: number; y: number; z: number };

  /**
   * Creates a new FeatureDetector instance
   * @param canvasElement - Canvas element for drawing
   */
  constructor(
    canvasElement: HTMLCanvasElement,
    trainted_pattern_corners: any,
    offset: { x: number; y: number; z: number },
    scale: { x: number; y: number; z: number }
  ) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.trainted_pattern_corners = trainted_pattern_corners;

    this.offset = offset;
    this.scale = scale;

    if (!this.ctx) {
      throw new Error("Could not get canvas context");
    }

    this.options = new DemoOptions();

    // Initialize profiler metrics
    // profiler.add("grayscale");
    // profiler.add("gauss blur");
    // profiler.add("keypoints");
    // profiler.add("orb descriptors");
    // profiler.add("matching");

    // Initialize JSFeat matrices
    this.initializeMatrices();

    // Set up canvas styles
    this.ctx.fillStyle = "rgb(0,255,0)";
    this.ctx.strokeStyle = "rgb(0,255,0)";
  }

  /**
   * Initialize JSFeat matrices and data structures
   */
  private initializeMatrices(): void {
    this.img_u8 = new jsfeat.matrix_t(
      this.canvas.width,
      this.canvas.height,
      jsfeat.U8_t | jsfeat.C1_t
    );

    this.img_u8_smooth = new jsfeat.matrix_t(
      this.canvas.width,
      this.canvas.height,
      jsfeat.U8_t | jsfeat.C1_t
    );

    this.screen_descriptors = new jsfeat.matrix_t(
      32,
      CONFIG.MAX_CORNERS,
      jsfeat.U8_t | jsfeat.C1_t
    );

    this.screen_corners = Array(this.canvas.width * this.canvas.height)
      .fill(null)
      .map(() => new jsfeat.keypoint_t(0, 0, 0, 0, -1));

    this.matches = Array(this.canvas.width * this.canvas.height)
      .fill(null)
      .map(() => new Match());

    this.homo3x3 = new jsfeat.matrix_t(3, 3, jsfeat.F32C1_t);
    this.match_mask = new jsfeat.matrix_t(CONFIG.MAX_CORNERS, 1, jsfeat.U8C1_t);
  }

  /**
   * Get whether a pattern was found in the last processed frame
   * @returns True if pattern was found, false otherwise
   */
  public isFound(): boolean {
    return this.found;
  }

  /**
   * Get homography matrix for the found pattern
   * @returns Homography matrix or null if not found
   */
  public getHomography(): jsfeat.matrix_t | null {
    return this.found ? this.homo3x3 : null;
  }

  /**
   * Get good screen points from matching
   * @returns Array of points
   */
  public getGoodScreenPoints(): Point2D[] {
    return this.good_screen_points;
  }

  /**
   * Process an image
   * @param imageData - Image data to process
   * @param patternCorners - Pattern corners to match against
   * @param patternDescriptors - Pattern descriptors to match against
   * @param patternPreview - Pattern preview for visualization
   * @returns True if pattern was found, false otherwise
   */
  public processImage(
    imageData: ImageData,
    patternCorners: jsfeat.keypoint_t[][],
    patternDescriptors: jsfeat.matrix_t[],
    patternPreview: jsfeat.matrix_t | null
  ): any {
    this.found = false;

    // Convert to grayscale
    // profiler.start("grayscale");
    jsfeat.imgproc.grayscale(
      imageData.data,
      this.canvas.width,
      this.canvas.height,
      this.img_u8
    );
    // profiler.stop("grayscale");

    // Apply Gaussian blur
    // profiler.start("gauss blur");
    jsfeat.imgproc.gaussian_blur(
      this.img_u8,
      this.img_u8_smooth,
      this.options.blur_size
    );
    // profiler.stop("gauss blur");

    // Detect keypoints
    // profiler.start("keypoints");
    const num_corners = this.detectKeypoints(
      this.img_u8_smooth,
      this.screen_corners,
      CONFIG.MAX_CORNERS,
      this.options.lap_thres,
      this.options.eigen_thres
    );
    // profiler.stop("keypoints");

    // Compute descriptors
    // profiler.start("orb descriptors");
    jsfeat.orb.describe(
      this.img_u8_smooth,
      this.screen_corners,
      num_corners,
      this.screen_descriptors
    );
    // profiler.stop("orb descriptors");

    // Draw corners if debug is enabled
    if (this.options.show_corners) {
      const data_u32 = new Uint32Array(imageData.data.buffer);
      this.renderCorners(
        this.screen_corners,
        num_corners,
        data_u32,
        this.canvas.width
      );
    }

    let num_matches = 0;
    let good_matches = 0;

    // Match against pattern
    if (patternPreview) {
      if (this.options.show_corners) {
        const data_u32 = new Uint32Array(imageData.data.buffer);
        ImageUtils.renderMonoImage(
          patternPreview.data,
          data_u32,
          patternPreview.cols,
          patternPreview.rows,
          this.canvas.width
        );
      }

      //   profiler.start("matching");
      num_matches = this.matchPattern(
        patternDescriptors,
        // patternCorners,
        this.screen_descriptors
        // num_corners
      );

      if (num_matches >= this.options.point_threshold) {
        good_matches = this.findTransform(this.matches, num_matches);

        if (good_matches >= this.options.good_match_threshold) {
          this.found = true;
        }
      }
      //   profiler.stop("matching");
    }

    // Draw visualization
    if (this.options.show_matches && num_matches > 0) {
      this.ctx.putImageData(imageData, 0, 0);

      if (this.options.show_matches) {
        this.renderMatches(this.ctx, this.matches, num_matches, patternCorners);
      }

      //   if (good_matches >= this.options.good_match_threshold) {
      //     this.renderPatternShape(this.ctx, patternPreview);
      //   }
    } else {
      this.ctx.putImageData(imageData, 0, 0);

      //   if (good_matches >= this.options.good_match_threshold) {
      //     this.renderPatternShape(this.ctx, patternPreview);
      //   }
    }

    const shape_pts = patternPreview
      ? ImageUtils.transformCorners(
          this.homo3x3.data,
          patternPreview.cols * 2,
          patternPreview.rows * 2,
          this.offset,
          this.scale
        )
      : [];

    return {
      found: this.found,
      homography: this.homo3x3,
      goodScreenPoints: this.good_screen_points,
      corners: shape_pts,
    };
  }

  /**
   * Detect keypoints in an image
   * @param img - Input image
   * @param corners - Array to store detected corners
   * @param maxAllowed - Maximum number of corners to detect
   * @param lapThres - Laplacian threshold
   * @param eigenThres - Eigenvalue threshold
   * @returns Number of corners detected
   */
  private detectKeypoints(
    img: jsfeat.matrix_t,
    corners: jsfeat.keypoint_t[],
    maxAllowed: number,
    lapThres: number,
    eigenThres: number
  ): number {
    jsfeat.yape06.laplacian_threshold = lapThres;
    jsfeat.yape06.min_eigen_value_threshold = eigenThres;

    let count = jsfeat.yape06.detect(img, corners, 17); // 17 is the border

    // Sort and limit corners by score
    if (count > maxAllowed) {
      jsfeat.math.qsort(
        corners,
        0,
        count - 1,
        (a: any, b: any) => b.score < a.score
      );
      count = maxAllowed;
    }

    // Calculate angle for each corner
    for (let i = 0; i < count; ++i) {
      corners[i].angle = this.calculateAngle(img, corners[i].x, corners[i].y);
    }

    return count;
  }

  /**
   * Calculate orientation angle for a corner
   * @param img - Input image
   * @param px - X coordinate
   * @param py - Y coordinate
   * @returns Orientation angle in radians
   */
  private calculateAngle(img: jsfeat.matrix_t, px: number, py: number): number {
    const half_k = 15;
    let m_01 = 0,
      m_10 = 0;
    const step = img.cols;
    const center_off = Math.floor(py * step + px);

    // Center line
    for (let u = -half_k; u <= half_k; ++u) {
      m_10 += u * img.data[center_off + u];
    }

    // Other lines
    for (let v = 1; v <= half_k; ++v) {
      let v_sum = 0;
      const d = CONFIG.U_MAX[v];

      for (let u = -d; u <= d; ++u) {
        const val_plus = img.data[center_off + u + v * step];
        const val_minus = img.data[center_off + u - v * step];
        v_sum += val_plus - val_minus;
        m_10 += u * (val_plus + val_minus);
      }

      m_01 += v * v_sum;
    }

    return Math.atan2(m_01, m_10);
  }

  /**
   * Draw detected corners on an image
   * @param corners - Array of detected corners
   * @param count - Number of corners
   * @param img - Destination image (Uint32Array)
   * @param step - Image step (width)
   */
  private renderCorners(
    corners: jsfeat.keypoint_t[],
    count: number,
    img: Uint32Array,
    step: number
  ): void {
    const pix = (0xff << 24) | (0x00 << 16) | (0xff << 8) | 0x00; // Green

    for (let i = 0; i < count; ++i) {
      const { x, y } = corners[i];
      const off = Math.floor(x + y * step);

      img[off] =
        img[off - 1] =
        img[off + 1] =
        img[off - step] =
        img[off + step] =
          pix;
    }
  }

  /**
   * Match pattern descriptors against screen descriptors
   * @param patternDescriptors - Pattern descriptors
   * @param patternCorners - Pattern corners
   * @param screenDescriptors - Screen descriptors
   * @param numCorners - Number of screen corners
   * @returns Number of matches found
   */
  private matchPattern(
    patternDescriptors: jsfeat.matrix_t[],
    // patternCorners: jsfeat.keypoint_t[][],
    screenDescriptors: jsfeat.matrix_t
    // numCorners: number
  ): number {
    const q_cnt = screenDescriptors.rows;
    const query_u32 = screenDescriptors.buffer.i32;
    let num_matches = 0;
    let qd_off = 0;

    for (let qidx = 0; qidx < q_cnt; ++qidx) {
      let best_dist = 256;
      let best_dist2 = 256;
      let best_idx = -1;
      let best_lev = -1;

      // Search through all pattern pyramid levels
      for (let lev = 0; lev < CONFIG.NUM_TRAIN_LEVELS; ++lev) {
        const lev_descr = patternDescriptors[lev];
        const ld_cnt = lev_descr.rows;
        const ld_i32 = lev_descr.buffer.i32;
        let ld_off = 0;

        // Compare with all pattern descriptors at this level
        for (let pidx = 0; pidx < ld_cnt; ++pidx) {
          let curr_d = 0;

          // Calculate Hamming distance
          for (let k = 0; k < 8; ++k) {
            curr_d += ImageUtils.popcnt32(
              query_u32[qd_off + k] ^ ld_i32[ld_off + k]
            );
          }

          // Keep track of two best matches (for ratio test)
          if (curr_d < best_dist) {
            best_dist2 = best_dist;
            best_dist = curr_d;
            best_lev = lev;
            best_idx = pidx;
          } else if (curr_d < best_dist2) {
            best_dist2 = curr_d;
          }

          ld_off += 8;
        }
      }

      // Apply matching threshold
      if (best_dist < this.options.match_threshold) {
        this.matches[num_matches].screen_idx = qidx;
        this.matches[num_matches].pattern_lev = best_lev;
        this.matches[num_matches].pattern_idx = best_idx;
        this.matches[num_matches].distance = best_dist;
        num_matches++;
      }

      qd_off += 8;
    }

    return num_matches;
  }

  /**
   * Find homography transformation from matches
   * @param matches - Array of matches
   * @param count - Number of matches
   * @returns Number of good matches after RANSAC
   */
  private findTransform(matches: Match[], count: number): number {
    const mm_kernel = new jsfeat.motion_model.homography2d();
    const ransac_param = new jsfeat.ransac_params_t(4, 3, 0.5, 0.99);

    const pattern_xy: Point2D[] = [];
    const screen_xy: Point2D[] = [];

    // Extract matched point pairs
    for (let i = 0; i < count; ++i) {
      const m = matches[i];
      const s_kp = this.screen_corners[m.screen_idx];
      const p_kp = this.trainted_pattern_corners[m.pattern_lev][m.pattern_idx];

      pattern_xy[i] = { x: p_kp.x, y: p_kp.y };
      screen_xy[i] = { x: s_kp.x, y: s_kp.y };
    }

    // Run RANSAC
    const ok = jsfeat.motion_estimator.ransac(
      ransac_param,
      mm_kernel,
      pattern_xy,
      screen_xy,
      count,
      this.homo3x3,
      this.match_mask,
      1000
    );

    if (!ok) {
      jsfeat.matmath.identity_3x3(this.homo3x3, 1.0);
      return 0;
    }

    // Keep only inliers
    let good_cnt = 0;
    for (let i = 0; i < count; ++i) {
      if (this.match_mask.data[i]) {
        pattern_xy[good_cnt] = pattern_xy[i];
        screen_xy[good_cnt] = screen_xy[i];
        good_cnt++;
      }
    }

    // Store good points for later use
    this.good_screen_points = screen_xy.slice(0, good_cnt);
    // this.good_pattern_points = pattern_xy.slice(0, good_cnt);

    // Refine homography with all inliers
    mm_kernel.run(pattern_xy, screen_xy, this.homo3x3, good_cnt);

    return good_cnt;
  }

  /**
   * Render matches between pattern and screen
   * @param ctx - Canvas context
   * @param matches - Array of matches
   * @param count - Number of matches
   * @param patternCorners - Pattern corners
   */
  private renderMatches(
    ctx: CanvasRenderingContext2D,
    matches: Match[],
    count: number,
    patternCorners: jsfeat.keypoint_t[][]
  ): void {
    for (let i = 0; i < count; ++i) {
      const m = matches[i];
      const s_kp = this.screen_corners[m.screen_idx];
      const p_kp = patternCorners[m.pattern_lev][m.pattern_idx];

      // Use different colors for inliers and outliers
      ctx.strokeStyle = this.match_mask.data[i]
        ? "rgb(0,255,0)" // Green for inliers
        : "rgb(255,0,0)"; // Red for outliers

      ctx.beginPath();
      ctx.moveTo(s_kp.x, s_kp.y);
      ctx.lineTo(p_kp.x * 0.5, p_kp.y * 0.5); // Scale pattern points
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /**
   * Render shape around detected pattern
   * @param ctx - Canvas context
   * @param patternPreview - Pattern preview
   */
  //   private renderPatternShape(
  //     ctx: CanvasRenderingContext2D,
  //     patternPreview: jsfeat.matrix_t | null
  //   ): void {
  //     if (!patternPreview) return;

  //     const shape_pts = ImageUtils.transformCorners(
  //       this.homo3x3.data,
  //       patternPreview.cols * 2,
  //       patternPreview.rows * 2
  //     );

  //     ctx.strokeStyle = "rgb(0,255,0)";
  //     ctx.beginPath();
  //     ctx.moveTo(shape_pts[0].x, shape_pts[0].y);
  //     ctx.lineTo(shape_pts[1].x, shape_pts[1].y);
  //     ctx.lineTo(shape_pts[2].x, shape_pts[2].y);
  //     ctx.lineTo(shape_pts[3].x, shape_pts[3].y);
  //     ctx.lineTo(shape_pts[0].x, shape_pts[0].y);
  //     ctx.lineWidth = 4;
  //     ctx.stroke();
  //   }
}

export default FeatureDetector;
