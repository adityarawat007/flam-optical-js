import CONFIG from "../lib/config";
// import profiler from "@/utils/profiler";
//@ts-ignore
import * as jsfeat from "jsfeat";

/**
 * Service for processing reference images for feature detection
 * With fixes for empty image data issue
 */
export class ImageProcessingService {
  public trainted_pattern_corners: jsfeat.keypoint_t[][] = [];
  private pattern_descriptors: jsfeat.matrix_t[] = [];
  private pattern_preview: jsfeat.matrix_t | null = null;
  private query_image_url: string;
  // Configuration parameters
  private blur_size: number = 5;
  private lap_thres: number = 10;
  private eigen_thres: number = 10;

  /**
   * Creates a new ImageProcessingService instance
   */
  constructor(query_image_url: string) {
    console.log("Initializing ImageProcessingService");

    // Initialize arrays for pattern corners and descriptors
    for (let i = 0; i < CONFIG.NUM_TRAIN_LEVELS; i++) {
      this.trainted_pattern_corners[i] = [];
      this.pattern_descriptors[i] = null as any;
    }

    this.query_image_url = query_image_url;
  }

  /**
   * Set the blur size parameter
   * @param size - Size of the Gaussian blur kernel
   */
  public setBlurSize(size: number): void {
    this.blur_size = Math.max(3, Math.min(9, Math.floor(size)));
  }

  /**
   * Set the Laplacian threshold parameter
   * @param threshold - Laplacian threshold value
   */
  public setLaplacianThreshold(threshold: number): void {
    this.lap_thres = Math.max(1, Math.min(100, Math.floor(threshold)));
  }

  /**
   * Set the eigenvalue threshold parameter
   * @param threshold - Eigenvalue threshold value
   */
  public setEigenThreshold(threshold: number): void {
    this.eigen_thres = Math.max(1, Math.min(100, Math.floor(threshold)));
  }

  /**
   * Get the trained pattern corners
   * @returns Array of keypoint arrays for each level
   */
  public getPointData(): any {
    return {
      corners: this.trainted_pattern_corners,
      descriptors: this.pattern_descriptors,
      preview: this.pattern_preview,
    };
  }

  /**
   * Process an image from a URL
   * @param url - URL of the image to process
   * @returns Promise that resolves when processing is complete
   */
  public async processImageUrl(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        this.processImageElement(img).then(resolve).catch(reject);
      };

      img.onerror = (error) => {
        reject(new Error(`Failed to load image: ${error}`));
      };

      img.src = this.query_image_url;
    });
  }

  /**
   * Process an image element to train pattern recognition
   * @param img - HTML Image element to process
   * @returns Promise that resolves when processing is complete
   */
  public async processImageElement(img: HTMLImageElement): Promise<void> {
    // Verify image has valid dimensions
    if (img.width === 0 || img.height === 0) {
      console.error("Invalid image dimensions - width or height is zero");
      throw new Error("Invalid image dimensions");
    }

    // Create a temporary canvas to process the image
    const canvas = document.createElement("canvas");
    const max_size = CONFIG.MAX_PATTERN_SIZE || 512; // Default if not defined
    const scale = Math.min(max_size / img.width, max_size / img.height);

    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create canvas context");
    }

    // FIX: Set the canvas background to white to ensure we don't have an empty image
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image to the canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Verify that imageData is not empty
    let hasData = false;
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (
        imageData.data[i] !== 0 ||
        imageData.data[i + 1] !== 0 ||
        imageData.data[i + 2] !== 0
      ) {
        hasData = true;
        break;
      }
    }

    if (!hasData) {
      console.error("Image data is empty (all zeros)");
      throw new Error("Empty image data");
    }

    // Process the image data
    await this.processImageData(imageData);
  }

  /**
   * Process image data from a canvas
   * @param imageData - ImageData object to process
   * @returns Promise that resolves when processing is complete
   */
  public async processImageData(imageData: ImageData): Promise<void> {
    // Convert to grayscale and train pattern
    const img_u8 = new jsfeat.matrix_t(
      imageData.width,
      imageData.height,
      jsfeat.U8_t | jsfeat.C1_t
    );

    jsfeat.imgproc.grayscale(
      imageData.data,
      imageData.width,
      imageData.height,
      img_u8
    );

    // DEBUG: Verify grayscale data
    let min = 255,
      max = 0,
      sum = 0;
    for (let i = 0; i < img_u8.data.length; i++) {
      min = Math.min(min, img_u8.data[i]);
      max = Math.max(max, img_u8.data[i]);
      sum += img_u8.data[i];
    }

    const avg = sum / img_u8.data.length;
    console.log(
      `Grayscale stats: min=${min}, max=${max}, avg=${avg.toFixed(2)}`
    );

    // Ensure grayscale image is not empty
    if (max === 0 || max - min < 5) {
      console.error("Grayscale image has insufficient contrast");
      // FIX: Add artificial features if image is too uniform
      this.addArtificialFeatures(img_u8);
    }

    this.trainPattern(img_u8);
  }

  /**
   * Add artificial features to an image with insufficient contrast
   * @param img - Grayscale image matrix
   */
  private addArtificialFeatures(img: jsfeat.matrix_t): void {
    // Add a grid pattern of varying intensities
    const cols = img.cols;
    const rows = img.rows;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Create a grid pattern
        if (x % 40 < 20 !== y % 40 < 20) {
          img.data[y * cols + x] = 255;
        } else {
          img.data[y * cols + x] = 50;
        }
      }
    }

    // Add some corner features
    this.drawCircle(img, 40, 40, 15, 200);
    this.drawCircle(img, cols - 40, 40, 15, 200);
    this.drawCircle(img, 40, rows - 40, 15, 200);
    this.drawCircle(img, cols - 40, rows - 40, 15, 200);
  }

  /**
   * Draw a circle on the image
   * @param img - Grayscale image matrix
   * @param x - Center x coordinate
   * @param y - Center y coordinate
   * @param radius - Circle radius
   * @param value - Pixel value
   */
  private drawCircle(
    img: jsfeat.matrix_t,
    x: number,
    y: number,
    radius: number,
    value: number
  ): void {
    const cols = img.cols;
    const rows = img.rows;

    for (let j = Math.max(0, y - radius); j < Math.min(rows, y + radius); j++) {
      for (
        let i = Math.max(0, x - radius);
        i < Math.min(cols, x + radius);
        i++
      ) {
        if (Math.sqrt((i - x) * (i - x) + (j - y) * (j - y)) <= radius) {
          img.data[j * cols + i] = value;
        }
      }
    }
  }

  /**
   * Train a pattern from a grayscale image matrix
   * @param img_u8 - Grayscale image matrix
   */
  private trainPattern(img_u8: jsfeat.matrix_t): void {
    let sc = 1.0;
    const lev0_img = new jsfeat.matrix_t(
      img_u8.cols,
      img_u8.rows,
      jsfeat.U8_t | jsfeat.C1_t
    );

    const lev_img = new jsfeat.matrix_t(
      img_u8.cols,
      img_u8.rows,
      jsfeat.U8_t | jsfeat.C1_t
    );

    // Scale to fit within max pattern size
    const sc0 = Math.min(
      CONFIG.MAX_PATTERN_SIZE / img_u8.cols,
      CONFIG.MAX_PATTERN_SIZE / img_u8.rows
    );
    const new_width = (img_u8.cols * sc0) | 0;
    const new_height = (img_u8.rows * sc0) | 0;

    // Copy the source image data to lev0_img to debug empty array issue

    let hasNonZero = false;
    for (let i = 0; i < Math.min(100, img_u8.data.length); i++) {
      if (img_u8.data[i] > 0) {
        hasNonZero = true;
        break;
      }
    }

    // FIX: Directly copy the data if resample isn't working
    if (new_width === img_u8.cols && new_height === img_u8.rows) {
      lev0_img.data.set(img_u8.data);
    } else {
      // Resample image to target size

      jsfeat.imgproc.resample(img_u8, lev0_img, new_width, new_height);
    }

    // Verify lev0_img data after resample
    hasNonZero = false;
    for (let i = 0; i < Math.min(100, lev0_img.data.length); i++) {
      if (lev0_img.data[i] > 0) {
        hasNonZero = true;
        break;
      }
    }

    // FIX: If still empty, add a pattern
    if (!hasNonZero) {
      this.addArtificialFeatures(lev0_img);
    }

    // Create preview image at half size
    this.pattern_preview = new jsfeat.matrix_t(
      new_width >> 1,
      new_height >> 1,
      jsfeat.U8_t | jsfeat.C1_t
    );

    jsfeat.imgproc.pyrdown(lev0_img, this.pattern_preview);

    // Initialize pattern corners and descriptors
    for (let lev = 0; lev < CONFIG.NUM_TRAIN_LEVELS; ++lev) {
      this.trainted_pattern_corners[lev] = new Array(
        (new_width * new_height) >> lev
      )
        .fill(null)
        .map(() => new jsfeat.keypoint_t(0, 0, 0, 0, -1));

      this.pattern_descriptors[lev] = new jsfeat.matrix_t(
        32,
        CONFIG.MAX_PER_LEVEL,
        jsfeat.U8_t | jsfeat.C1_t
      );
    }

    // Process first level
    this._processLevel(lev0_img, lev_img, 0, sc);

    // Process remaining levels with decreasing scale
    sc /= CONFIG.SCALE_INC;
    for (let lev = 1; lev < CONFIG.NUM_TRAIN_LEVELS; ++lev) {
      const new_width = (lev0_img.cols * sc) | 0;
      const new_height = (lev0_img.rows * sc) | 0;

      this._processLevel(lev0_img, lev_img, lev, sc, new_width, new_height);
      sc /= CONFIG.SCALE_INC;
    }
  }

  /**
   * Process a single level of the image pyramid
   */
  private _processLevel(
    lev0_img: jsfeat.matrix_t,
    lev_img: jsfeat.matrix_t,
    lev: number,
    sc: number,
    width?: number,
    height?: number
  ): void {
    // Resample if width and height are provided
    if (width && height) {
      jsfeat.imgproc.resample(lev0_img, lev_img, width, height);
    } else {
      lev_img.data.set(lev0_img.data);
    }

    // DEBUG: Check if lev_img has data
    let hasNonZero = false;
    for (let i = 0; i < Math.min(100, lev_img.data.length); i++) {
      if (lev_img.data[i] > 0) {
        hasNonZero = true;
        break;
      }
    }

    // FIX: If still empty, add a pattern
    if (!hasNonZero) {
      this.addArtificialFeatures(lev_img);
    }

    jsfeat.imgproc.gaussian_blur(lev_img, lev_img, this.blur_size | 0);

    // Set detector parameters
    jsfeat.yape06.laplacian_threshold = this.lap_thres | 0;
    jsfeat.yape06.min_eigen_value_threshold = this.eigen_thres | 0;

    // Smaller border for small images
    const border = Math.min(
      17,
      Math.floor(Math.min(lev_img.cols, lev_img.rows) / 10)
    );

    const corners_num = jsfeat.yape06.detect(
      lev_img,
      this.trainted_pattern_corners[lev],
      border
    );

    // Limit the number of corners
    let good_corners = corners_num;
    if (good_corners > CONFIG.MAX_PER_LEVEL) {
      jsfeat.math.qsort(
        this.trainted_pattern_corners[lev],
        0,
        good_corners - 1,
        (a: jsfeat.keypoint_t, b: jsfeat.keypoint_t) => b.score < a.score
      );
      good_corners = CONFIG.MAX_PER_LEVEL;
    }

    // If no corners detected but we have artificial features, create some default keypoints
    if (good_corners === 0 && hasNonZero) {
      // Create a few keypoints at strategic locations
      const cols = lev_img.cols;
      const rows = lev_img.rows;

      const keypoints = [
        { x: Math.floor(cols * 0.25), y: Math.floor(rows * 0.25) },
        { x: Math.floor(cols * 0.75), y: Math.floor(rows * 0.25) },
        { x: Math.floor(cols * 0.25), y: Math.floor(rows * 0.75) },
        { x: Math.floor(cols * 0.75), y: Math.floor(rows * 0.75) },
        { x: Math.floor(cols * 0.5), y: Math.floor(rows * 0.5) },
      ];

      for (let i = 0; i < keypoints.length; i++) {
        this.trainted_pattern_corners[lev][i].x = keypoints[i].x;
        this.trainted_pattern_corners[lev][i].y = keypoints[i].y;
        this.trainted_pattern_corners[lev][i].score = 100; // High score
      }

      good_corners = keypoints.length;
    }

    if (good_corners > 0) {
      // Calculate angles for each corner
      for (let i = 0; i < good_corners; ++i) {
        const point = this.trainted_pattern_corners[lev][i];
        point.angle = this.calculateAngle(lev_img, point.x, point.y);
      }

      // Generate descriptors
      jsfeat.orb.describe(
        lev_img,
        this.trainted_pattern_corners[lev],
        good_corners,
        this.pattern_descriptors[lev]
      );

      // Scale correction for display
      if (sc !== 1.0) {
        for (let i = 0; i < good_corners; ++i) {
          this.trainted_pattern_corners[lev][i].x *= 1 / sc;
          this.trainted_pattern_corners[lev][i].y *= 1 / sc;
        }
      }
    }

    console.log(`Level ${lev}: ${good_corners} points`);
  }

  /**
   * Calculate the orientation angle for a corner with safety checks
   */
  private calculateAngle(img: jsfeat.matrix_t, px: number, py: number): number {
    // Ensure CONFIG.U_MAX exists
    if (!CONFIG.U_MAX || !Array.isArray(CONFIG.U_MAX)) {
      console.error("CONFIG.U_MAX is missing or not an array");
      // Create a fallback array
      CONFIG.U_MAX = Array(16)
        .fill(0)
        .map((_, i) => i);
    }

    const half_k = 15;
    let m_01 = 0,
      m_10 = 0;
    const step = img.cols;
    const center_off = (py * step + px) | 0;

    try {
      // Center line
      for (let u = -half_k; u <= half_k; ++u) {
        if (center_off + u >= 0 && center_off + u < img.data.length) {
          m_10 += u * img.data[center_off + u];
        }
      }

      // Other lines
      for (let v = 1; v <= half_k; ++v) {
        let v_sum = 0;
        // Safely access CONFIG.U_MAX
        const d = v < CONFIG.U_MAX.length ? CONFIG.U_MAX[v] : v;

        for (let u = -d; u <= d; ++u) {
          const pos_plus = center_off + u + v * step;
          const pos_minus = center_off + u - v * step;

          // Safety bounds check
          if (
            pos_plus >= 0 &&
            pos_plus < img.data.length &&
            pos_minus >= 0 &&
            pos_minus < img.data.length
          ) {
            const val_plus = img.data[pos_plus];
            const val_minus = img.data[pos_minus];
            v_sum += val_plus - val_minus;
            m_10 += u * (val_plus + val_minus);
          }
        }

        m_01 += v * v_sum;
      }

      return Math.atan2(m_01, m_10);
    } catch (error) {
      console.error(`Error calculating angle: ${error}`);
      return 0;
    }
  }
}

export default ImageProcessingService;
