/**
 * TypeScript declarations for jsfeat library
 * These are partial definitions to support our application
 */
// @ts-ignore
declare module "jsfeat" {
  export const U8_t: number;
  export const U8C1_t: number;
  export const F32C1_t: number;
  export const C1_t: number;

  export class matrix_t {
    constructor(rows: number, cols: number, type: number);
    cols: number;
    rows: number;
    data: Uint8Array | Int32Array | Float32Array;
    buffer: {
      i32: Int32Array;
      f32: Float32Array;
      u8: Uint8Array;
    };
  }

  export class keypoint_t {
    constructor(
      x: number,
      y: number,
      score: number,
      level: number,
      angle: number
    );
    x: number;
    y: number;
    score: number;
    level: number;
    angle: number;
  }

  export class pyramid_t {
    constructor(levels: number);
    allocate(width: number, height: number, type: number): void;
    build(source: Uint8Array, skip_first_level: boolean): void;
    data: Uint8Array[];
  }

  export class ransac_params_t {
    constructor(size: number, thresh: number, eps: number, prob: number);
    size: number;
    thresh: number;
    eps: number;
    prob: number;
  }

  export namespace imgproc {
    function grayscale(
      src: Uint8ClampedArray,
      width: number,
      height: number,
      dst: Uint8Array
    ): void;
    function gaussian_blur(
      src: Uint8Array,
      dst: Uint8Array,
      kernel_size: number
    ): void;
    function pyrdown(src: matrix_t, dst: matrix_t): void;
    function resample(
      src: matrix_t,
      dst: matrix_t,
      new_width: number,
      new_height: number
    ): void;
  }

  export namespace math {
    function qsort(
      array: any[],
      low: number,
      high: number,
      comparator: (a: any, b: any) => boolean
    ): void;
  }

  export namespace yape06 {
    function detect(
      img: matrix_t,
      points: keypoint_t[],
      border: number
    ): number;
    let laplacian_threshold: number;
    let min_eigen_value_threshold: number;
  }

  export namespace fast_corners {
    function set_threshold(threshold: number): void;
  }

  export namespace orb {
    function describe(
      src: matrix_t,
      corners: keypoint_t[],
      count: number,
      descriptors: matrix_t
    ): void;
  }

  export namespace optical_flow_lk {
    function track(
      prev_pyr: pyramid_t,
      curr_pyr: pyramid_t,
      prev_xy: Float32Array,
      curr_xy: Float32Array,
      count: number,
      win_size: number,
      max_iter: number,
      status: Uint8Array,
      eps: number,
      min_eigen_val: number
    ): void;
  }

  export namespace motion_estimator {
    function ransac(
      params: ransac_params_t,
      kernel: any,
      from: Point2D[],
      to: Point2D[],
      count: number,
      model: matrix_t,
      mask: matrix_t,
      max_iters: number
    ): boolean;
  }

  export namespace matmath {
    function multiply_3x3(A: matrix_t, B: matrix_t, C: matrix_t): void;
    function identity_3x3(M: matrix_t, scale: number): void;
  }

  export namespace motion_model {
    class homography2d {
      constructor();
      run(from: Point2D[], to: Point2D[], model: matrix_t, count: number): void;
    }
  }
}

/**
 * Interface for a point in 2D space
 */
export interface Point2D {
  x: number;
  y: number;
}

export interface ProfilerMetric {
  name: string;
  start_time: number;
  end_time: number;
  delta_time: number;
}

/**
 * Interface for tracked shape corners
 */
export interface TrackedCorners {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

/**
 * Interface for profiler metric
 */
export interface ProfilerMetric {
  name: string;
  start_time: number;
  end_time: number;
  delta_time: number;
}

/**
 * Interface for status updates
 */
export interface StatusUpdate {
  type: "tracking" | "detection" | "error";
  message: string;
  metrics?: ProfilerMetric[];
}

/**
 * Camera service configuration
 */
export interface CameraConfig {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}

/**
 * Camera service events
 */
export type CameraEvent =
  | { type: "initialized" }
  | { type: "error"; error: Error }
  | { type: "frame"; imageData: ImageData };
