import { WebGLVideoRenderer } from "./core/webgl-renderer";
import PointData from "./core/point-data";
import { Point2D } from "./types";

import {
  CONFIG,
  CameraService,
  FeatureDetector,
  ImageProcessingService,
  OpticalFlowTracker,
} from "./index";

/**
 * Main application class
 */
export class App {
  // Services
  private cameraService: any;
  private imageProcessor: any;
  private detector: any;
  private tracker: any;
  private pointData: any;
  private videoOverlayRenderer: WebGLVideoRenderer;

  // DOM Elements
  private canvas: HTMLCanvasElement;
  private glCanvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private referenceImage: HTMLImageElement;

  // App state
  private isInitialized: boolean = false;
  private animationFrameId: number | null = null;

  private isDetecting: boolean;

  private opticalPersistFrameCount: number;
  private lastOpticalCorners: Point2D[];

  private interpolationConstant: number;

  /**
   * Creates a new App instance
   * @param canvasId - ID of the output canvas
   * @param videoId - ID of the video element
   * @param referenceImageId - ID of the reference image element
   * @param query_image_url - Image URL
   * @param video_url - Video URL
   * @param offset - Overlay video offset
   * @param scale - Overlay video scale
   */
  constructor(
    canvasId: string,
    videoId: string,
    referenceImageId: string,
    glCanvasId: string,
    query_image_url: string,
    video_url: string,
    offset: { x: number; y: number; z: number },
    scale: { x: number; y: number; z: number }
  ) {
    // Get DOM elements
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.glCanvas = document.getElementById(glCanvasId) as HTMLCanvasElement;
    this.context = this.canvas.getContext("2d");
    this.referenceImage = document.getElementById(
      referenceImageId
    ) as HTMLImageElement;

    if (!this.canvas || !this.referenceImage) {
      throw new Error("Required DOM elements not found");
    }

    // Initialize services
    this.cameraService = new CameraService(videoId, canvasId);
    this.imageProcessor = new ImageProcessingService(query_image_url);
    this.detector = new FeatureDetector(
      this.canvas,
      this.imageProcessor.trainted_pattern_corners,
      offset,
      scale
    );
    this.tracker = new OpticalFlowTracker(this.canvas, offset, scale);
    this.pointData = new PointData();
    this.videoOverlayRenderer = new WebGLVideoRenderer(
      "glCanvas",
      canvasId,
      video_url
    );
    this.isDetecting = false;
    this.opticalPersistFrameCount = 0;
    this.lastOpticalCorners = [];
    this.interpolationConstant = 0.001;
  }

  /**
   * Initialize the application
   * @returns Promise that resolves when initialized
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize camera
      await this.cameraService.initialize();

      // Set up camera event listener
      this.cameraService.addListener(this.handleCameraEvent.bind(this));
      this.videoOverlayRenderer.initialize();

      // Ensure the GL canvas is visible in the DOM
      const glCanvas = document.getElementById("glCanvas") as HTMLCanvasElement;
      if (glCanvas) {
        glCanvas.style.display = "block";
        glCanvas.style.width = "100%";
        glCanvas.style.height = "auto";
        glCanvas.style.position = "absolute";
        glCanvas.style.top = "0";
        glCanvas.style.left = "0";
        glCanvas.style.zIndex = "5"; // Ensure it's above other elements
      }

      this.isInitialized = true;

      // Start processing
      this.startImageProcessing();
    } catch (error) {
      console.error("Initialization error:", error);
    }
  }

  /**
   * Start the processing loop
   */
  public async startImageProcessing(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.imageProcessor.processImageUrl();
      this.pointData.setPoints(this.imageProcessor.getPointData());
      this.isDetecting = true;
    } catch (err) {
      console.log("error", err);
    }
  }

  /**
   * Handle camera events
   * @param event - Camera event
   */
  private handleCameraEvent(event: any): void {
    if (event.type === "error") {
      return;
    }
  }

  /**
   * Process a video frame
   * @param imageData - Image data to process
   */
  public processFrame(): void {
    this.cameraService.captureFrame();
    const imageData = this.context!.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    this.opticalPersistFrameCount < 10 && this.opticalPersistFrameCount++;
    if (this.isDetecting) {
      // Use feature detection
      const { found, homography, goodScreenPoints, corners } =
        this.detector.processImage(
          imageData,
          this.pointData.getCorners(),
          this.pointData.getDescriptors(),
          this.pointData.getPreview()
        );

      if (found) {
        const refImg = document.getElementById(
          "reference-image"
        ) as HTMLImageElement;
        const refWidth = refImg.naturalWidth;
        const refHeight = refImg.naturalHeight;

        if (this.glCanvas) {
          this.glCanvas.style.display = "block";
        }

        this.tracker.initWithHomography(
          homography!,
          goodScreenPoints,
          refWidth,
          refHeight
        );

        this.isDetecting = false;
        this.lastOpticalCorners = corners;
        // this.statusDisplay.updateTrackingStatus(
        //   true,
        //   this.tracker.getTrackingCount()
        // );
      } else if (
        this.opticalPersistFrameCount < CONFIG.MAX_PERSIST_OPTICAL_FRAMES &&
        this.lastOpticalCorners.length > 0
      ) {
        // this.tracker.renderPatternShape(
        //   this.context,
        //   this.lastOpticalCorners,
        //   imageData
        // );
        this.videoOverlayRenderer.render(this.lastOpticalCorners);
      } else {
        // Hide the overlay when detection fails and max persistence is reached
        if (this.glCanvas) {
          this.glCanvas.style.display = "none";
        }
        // Clear any stored corner points
        this.lastOpticalCorners = [];
      }
    }
    if (!this.isDetecting && this.lastOpticalCorners.length > 0) {
      const drawDampedBox =
        this.opticalPersistFrameCount <= CONFIG.MAX_PERSIST_OPTICAL_FRAMES;
      if (this.opticalPersistFrameCount === CONFIG.MAX_PERSIST_OPTICAL_FRAMES)
        this.interpolationConstant = 0.001;

      const trackingResult = this.tracker.processFrame(
        imageData,
        drawDampedBox,
        this.lastOpticalCorners,
        this.opticalPersistFrameCount
      );

      if (!trackingResult) {
        // this.tracker.renderPatternShape(
        //   this.context,
        //   this.lastOpticalCorners,
        //   imageData
        // );
        this.videoOverlayRenderer.render(this.lastOpticalCorners);
        this.isDetecting = true;
        // this.statusDisplay.updateTrackingStatus(false, 0);
        this.opticalPersistFrameCount = 0;
        this.interpolationConstant = 0.5;
      } else {
        this.interpolationConstant *= 0.8;
        // this.tracker.renderPatternShape(trackingResult, imageData);
        this.videoOverlayRenderer.render(trackingResult);
        this.videoOverlayRenderer.setDetectionState(this.isDetecting);
        this.lastOpticalCorners = trackingResult;

        // this.statusDisplay.updateTrackingStatus(
        //   true,
        //   this.tracker.getTrackingCount()
        // );
      }
    }
    this.animationFrameId = requestAnimationFrame(() => this.processFrame());
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // this.cameraService.stop();
    this.cameraService.release();
    // this.controlPanel.destroy();
  }
}

export default App;
