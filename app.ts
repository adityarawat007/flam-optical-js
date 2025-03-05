// @ts-ignore
import * as dat from "dat.gui";
import PointData from "./core/point-data";
import { profiler } from "./core/profiler";
import { WebGLVideoRenderer } from "./core/webgl-renderer";
import CONFIG from "./lib/config";
import { Point2D } from "./types";

import {
  CameraService,
  FeatureDetector,
  ImageProcessingService,
  OpticalFlowTracker,
} from "./index";

// This extends the Window interface to include our custom property
declare global {
  interface Window {
    __datGUIInstance?: dat.GUI;
  }
}

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

  // Performance monitoring
  private gui: dat.GUI;
  private stats: {
    fps: number;
    frameTime: number;
    detectionTime: number;
    trackingTime: number;
    renderTime: number;
    totalTime: number;
    detectionSuccess: boolean;
  };
  private lastFrameTime: number;
  private frameCount: number;
  private fpsUpdateInterval: number;
  private lastFpsUpdate: number;

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

    // Initialize performance monitoring
    this.stats = {
      fps: 0,
      frameTime: 0,
      detectionTime: 0,
      trackingTime: 0,
      renderTime: 0,
      totalTime: 0,
      detectionSuccess: false,
    };
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fpsUpdateInterval = 500; // Update FPS every 500ms
    this.lastFpsUpdate = 0;

    // Initialize profiler metrics
    profiler.add("totalFrame");
    profiler.add("detection");
    profiler.add("tracking");
    profiler.add("rendering");

    // Initialize dat.gui
    this.initializeProfilerUI();
  }

  /**
   * Initialize the dat.gui interface for performance monitoring
   */

  private initializeProfilerUI(): void {
    // Only initialize the GUI if DEBUG.SHOW_STATS is enabled
    if (!CONFIG.DEBUG?.SHOW_STATS) {
      return; // Exit if stats are disabled
    }

    // Check if GUI already exists globally
    if (window.hasOwnProperty("__datGUIInstance")) {
      // Use existing instance
      this.gui = window["__datGUIInstance"];

      // Clear existing folders to avoid duplicates
      while (this.gui.__folders && Object.keys(this.gui.__folders).length > 0) {
        const folderName = Object.keys(this.gui.__folders)[0];
        this.gui.removeFolder(this.gui.__folders[folderName]);
      }
    } else {
      // Create new instance and store it globally
      this.gui = new dat.GUI({ autoPlace: true });
      window["__datGUIInstance"] = this.gui;
    }

    // Create folders for different groups of settings
    const performanceFolder = this.gui.addFolder("Performance");

    // Add monitors for performance stats
    performanceFolder.add(this.stats, "fps").listen();
    performanceFolder.add(this.stats, "frameTime").listen();
    performanceFolder.add(this.stats, "detectionTime").listen();
    performanceFolder.add(this.stats, "trackingTime").listen();
    performanceFolder.add(this.stats, "renderTime").listen();
    performanceFolder.add(this.stats, "totalTime").listen();
    performanceFolder.add(this.stats, "detectionSuccess").listen();

    // Create a folder for app settings
    const settingsFolder = this.gui.addFolder("Settings");

    // Add controls for configurable settings
    settingsFolder.add(CONFIG, "MAX_PATTERN_SIZE", 128, 1024);
    settingsFolder.add(CONFIG, "MAX_PERSIST_OPTICAL_FRAMES", 1, 30).step(1);

    // Create a folder for debug settings
    const debugFolder = this.gui.addFolder("Debug");

    // Add debug toggles
    debugFolder
      .add(CONFIG.DEBUG, "SHOW_BOUNDING_BOX")
      .name("Show Bounding Box");
    debugFolder.add(CONFIG.DEBUG, "SHOW_CORNERS").name("Show Corners");
    debugFolder.add(CONFIG.DEBUG, "SHOW_MATCHES").name("Show Matches");
    debugFolder
      .add(CONFIG.DEBUG, "SHOW_STATS")
      .name("Show Stats")
      .onChange((value: string) => {
        // When this value changes, update the GUI visibility immediately
        if (this.gui) {
          this.gui.domElement.style.display = value ? "block" : "none";
        }
      });

    // Open folders by default
    performanceFolder.open();
    settingsFolder.open();
    debugFolder.open();
  }

  /**
   * Update the performance stats based on profiler metrics
   */
  private updatePerformanceStats(): void {
    // Only update stats if DEBUG.SHOW_STATS is enabled
    if (!CONFIG.DEBUG?.SHOW_STATS) {
      return;
    }

    const currentTime = performance.now();

    // Update frame counter
    this.frameCount++;

    // Calculate FPS every fpsUpdateInterval
    if (currentTime - this.lastFpsUpdate > this.fpsUpdateInterval) {
      this.stats.fps = Math.round(
        (this.frameCount * 1000) / (currentTime - this.lastFpsUpdate)
      );
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }

    // Update timing stats from profiler
    this.stats.detectionTime = profiler.getTime("detection");
    this.stats.trackingTime = profiler.getTime("tracking");
    this.stats.renderTime = profiler.getTime("rendering");
    this.stats.totalTime = profiler.getTime("totalFrame");

    // Calculate time per frame
    if (this.lastFrameTime > 0) {
      this.stats.frameTime = currentTime - this.lastFrameTime;
    }
    this.lastFrameTime = currentTime;

    // Update detection success status
    this.stats.detectionSuccess = !this.isDetecting;
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

      // Start performance monitoring
      this.lastFpsUpdate = performance.now();
      this.frameCount = 0;

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
    // Only start profiling if DEBUG.SHOW_STATS is enabled
    if (CONFIG.DEBUG?.SHOW_STATS) {
      profiler.start("totalFrame");
    }

    this.cameraService.captureFrame();
    const imageData = this.context!.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    this.opticalPersistFrameCount < 10 && this.opticalPersistFrameCount++;
    if (this.isDetecting) {
      // Start detection timing if stats are enabled
      if (CONFIG.DEBUG?.SHOW_STATS) {
        profiler.start("detection");
      }

      // Use feature detection
      const { found, homography, goodScreenPoints, corners } =
        this.detector.processImage(
          imageData,
          this.pointData.getCorners(),
          this.pointData.getDescriptors(),
          this.pointData.getPreview()
        );

      // Stop detection timing if stats are enabled
      if (CONFIG.DEBUG?.SHOW_STATS) {
        profiler.stop("detection");
      }

      if (found) {
        const refImg = document.getElementById(
          "reference-image"
        ) as HTMLImageElement;

        const max_size = CONFIG.MAX_PATTERN_SIZE || 512; // Default if not defined
        const scale = Math.min(
          max_size / refImg.width,
          max_size / refImg.height
        );

        const refWidth = Math.floor(refImg.width * scale);
        const refHeight = Math.floor(refImg.height * scale);

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
      } else if (
        this.opticalPersistFrameCount < CONFIG.MAX_PERSIST_OPTICAL_FRAMES &&
        this.lastOpticalCorners.length > 0
      ) {
        // Start rendering timing if stats are enabled
        if (CONFIG.DEBUG?.SHOW_STATS) {
          profiler.start("rendering");
        }

        this.videoOverlayRenderer.render(this.lastOpticalCorners);

        // Stop rendering timing if stats are enabled
        if (CONFIG.DEBUG?.SHOW_STATS) {
          profiler.stop("rendering");
        }
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

      // Start tracking timing if stats are enabled
      if (CONFIG.DEBUG?.SHOW_STATS) {
        profiler.start("tracking");
      }

      const trackingResult = this.tracker.processFrame(
        imageData,
        drawDampedBox,
        this.lastOpticalCorners,
        this.opticalPersistFrameCount
      );

      // Stop tracking timing if stats are enabled
      if (CONFIG.DEBUG?.SHOW_STATS) {
        profiler.stop("tracking");
      }

      if (!trackingResult) {
        // Start rendering timing if stats are enabled
        if (CONFIG.DEBUG?.SHOW_STATS) {
          profiler.start("rendering");
        }

        this.videoOverlayRenderer.render(this.lastOpticalCorners);

        // Stop rendering timing if stats are enabled
        if (CONFIG.DEBUG?.SHOW_STATS) {
          profiler.stop("rendering");
        }

        this.isDetecting = true;
        this.opticalPersistFrameCount = 0;
        this.interpolationConstant = 0.5;
      } else {
        this.interpolationConstant *= 0.8;

        // Start rendering timing
        profiler.start("rendering");

        this.videoOverlayRenderer.render(trackingResult);
        this.videoOverlayRenderer.setDetectionState(this.isDetecting);

        // Stop rendering timing
        profiler.stop("rendering");

        this.lastOpticalCorners = trackingResult;
      }
    }

    // Stop timing the total frame processing if stats are enabled
    if (CONFIG.DEBUG?.SHOW_STATS) {
      profiler.stop("totalFrame");

      // Update performance stats
      this.updatePerformanceStats();
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

    // Dispose dat.gui
    if (this.gui) {
      this.gui.destroy();
      // Remove the global reference when cleaning up
      if (window.hasOwnProperty("__datGUIInstance")) {
        delete window["__datGUIInstance"];
      }
    }

    this.cameraService.release();
  }
}

export default App;
