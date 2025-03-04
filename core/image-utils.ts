import { Point2D } from "../types";

/**
 * Utility class for image processing operations
 */
export class ImageUtils {
  /**
   * Renders a monochrome image to a destination array with color
   * @param src - Source grayscale image data
   * @param dst - Destination RGBA image data
   * @param sw - Source width
   * @param sh - Source height
   * @param dw - Destination width
   */
  static renderMonoImage(
    src: Uint8Array,
    dst: Uint32Array,
    sw: number,
    sh: number,
    dw: number
  ): void {
    const alpha = 0xff << 24;
    for (let i = 0; i < sh; ++i) {
      for (let j = 0; j < sw; ++j) {
        const pix = src[i * sw + j];
        dst[i * dw + j] = alpha | (pix << 16) | (pix << 8) | pix;
      }
    }
  }

  /**
   * Count the number of set bits in a 32-bit integer (population count)
   * Used for Hamming distance calculation in feature matching
   * @param n - The number to count bits in
   * @returns The number of set bits
   */
  static popcnt32(n: number): number {
    n -= (n >> 1) & 0x55555555;
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
  }

  /**
   * Transforms the corners of a rectangle using a homography matrix
   * @param M - 3x3 homography matrix (as flat array)
   * @param w - Width of the rectangle
   * @param h - Height of the rectangle
   * @returns An array of the transformed corner points
   */
  static transformCorners(
    M: Float32Array | number[],
    w: number,
    h: number,
    offset: { x: number; y: number; z: number },
    scale: { x: number; y: number; z: number }
  ): Point2D[] {
    const scaledWidth = w * scale.x;
    const scaledHeight = h * scale.y;
    const offsetX = offset.x * w + ((1 - scale.x) * w) / 2;
    const offsetY = offset.y * h - ((1 - scale.y) * h) / 2;

    const pt: Point2D[] = [
      { x: 0 + offsetX, y: 0 - offsetY }, // top-left
      {
        x: scaledWidth + offsetX,
        y: 0 - offsetY,
      }, // top-right
      {
        x: scaledWidth + offsetX,
        y: scaledHeight - offsetY,
      }, // bottom-right
      {
        x: 0 + offsetX,
        y: scaledHeight - offsetY,
      }, // bottom-left
    ];

    for (let i = 0; i < 4; ++i) {
      const px = M[0] * pt[i].x + M[1] * pt[i].y + M[2];
      const py = M[3] * pt[i].x + M[4] * pt[i].y + M[5];
      const z = M[6] * pt[i].x + M[7] * pt[i].y + M[8];
      pt[i].x = px / z;
      pt[i].y = py / z;
    }

    return pt;
  }

  /**
   * Calculate distance between two points
   * @param p1 - First point
   * @param p2 - Second point
   * @returns The Euclidean distance
   */
  static distance(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if a point is inside a polygon
   * @param point - The point to check
   * @param polygon - Array of points forming the polygon
   * @returns True if the point is inside the polygon
   */
  static isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Calculate the area of a polygon
   * @param points - Array of points forming the polygon
   * @returns The area of the polygon
   */
  static areaOfPolygon(points: Point2D[]): number {
    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    return Math.abs(area / 2);
  }

  /**
   * Calculate the average movement of corners between frames
   * @param currentCorners - Current corner positions
   * @param previousCorners - Previous corner positions
   * @returns The average movement distance
   */
  static calculateAverageCornerMovement(
    currentCorners: Point2D[],
    previousCorners: Point2D[]
  ): number {
    if (
      !previousCorners ||
      !currentCorners ||
      previousCorners.length !== currentCorners.length
    ) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 0; i < currentCorners.length; i++) {
      totalDistance += this.distance(currentCorners[i], previousCorners[i]);
    }

    return totalDistance / currentCorners.length;
  }

  /**
   * Create a grid of points inside a quadrilateral
   * @param shape - Array of points forming the quadrilateral
   * @param gridDistance - Distance between grid points
   * @returns Array of points inside the quadrilateral
   */
  static getInsidePoints(shape: Point2D[], gridDistance: number): Point2D[] {
    const points: Point2D[] = [];
    const minX = Math.min(...shape.map((pt) => pt.x));
    const maxX = Math.max(...shape.map((pt) => pt.x));
    const minY = Math.min(...shape.map((pt) => pt.y));
    const maxY = Math.max(...shape.map((pt) => pt.y));

    for (let x = minX; x <= maxX; x += gridDistance) {
      for (let y = minY; y <= maxY; y += gridDistance) {
        const point = { x, y };
        if (this.isPointInPolygon(point, shape)) {
          points.push(point);
        }
      }
    }

    return points;
  }
}

export default ImageUtils;
