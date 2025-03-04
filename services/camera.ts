/**
 * Service for camera initialization and frame capture
 */
export class CameraService {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private stream: MediaStream | null = null;
  private listeners: Array<(event: any) => void> = [];
  public frameRequestId: number | null = null;
  private isCapturing: boolean = false;

  /**
   * Creates a new CameraService instance
   * @param videoElementId - ID of the video element to use
   * @param canvasElementId - ID of a temporary canvas for image processing
   */
  constructor(videoElementId: string, canvasElementId?: string) {
    this.video = document.getElementById(videoElementId) as HTMLVideoElement;

    if (!this.video) {
      throw new Error(`Video element with ID "${videoElementId}" not found`);
    }

    // Create a temporary canvas if not provided
    if (canvasElementId) {
      this.canvas = document.getElementById(
        canvasElementId
      ) as HTMLCanvasElement;

      if (!this.canvas) {
        throw new Error(
          `Canvas element with ID "${canvasElementId}" not found`
        );
      }
    } else {
      this.canvas = document.createElement("canvas");
      // Set canvas size to window dimensions
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    this.context = this.canvas.getContext("2d");

    if (!this.context) {
      throw new Error("Could not get canvas context");
    }

    // Add resize event listener to update canvas dimensions
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  /**
   * Handle window resize event
   */
  private handleResize(): void {
    // Update canvas dimensions on resize
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Notify listeners about resize
    this.notifyListeners({
      type: "resize",
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  /**
   * Initialize the camera
   * @param config - Camera configuration options
   * @returns A promise that resolves when the camera is initialized
   */
  public async initialize(config?: any): Promise<void> {
    try {
      // First check if we have the right permissions
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          if (result.state === "denied") {
            throw new Error(
              "Camera permission denied. Please allow camera access in your browser settings."
            );
          }
        } catch (permError) {
          console.warn("Could not query permissions:", permError);
          // Continue anyway as some browsers don't support this API
        }
      }

      // Start with basic constraints that are more likely to work
      let constraints: MediaStreamConstraints = {
        video: {
          facingMode: config?.facingMode || "environment",
        },
        audio: false,
      };

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstError) {
        console.warn(
          "Failed with initial constraints, trying fallback:",
          firstError
        );

        // Fallback to even more basic constraints
        constraints = {
          video: true,
          audio: false,
        };

        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      // Once we have a working stream, apply it to the video element
      this.video.srcObject = this.stream;

      // Set video attributes to help with mobile playback
      this.video.setAttribute("playsinline", "true");
      this.video.setAttribute("autoplay", "true");
      this.video.muted = true;

      // Wait for video to be ready with a timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          const playHandler = () => {
            // Successfully started playing
            this.video.removeEventListener("playing", playHandler);
            resolve();
          };
          this.video.addEventListener("playing", playHandler);
          this.video
            .play()
            .catch((e) => console.error("Error playing video:", e));
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("Video playback timeout")), 10000);
        }),
      ]);

      // After successful initialization, get actual stream settings
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        const capabilities = videoTrack.getCapabilities
          ? videoTrack.getCapabilities()
          : {};
        console.log("Camera settings:", settings);
        console.log("Camera capabilities:", capabilities);

        // Log the intrinsic video element size once loaded
        const handleVideoMetadata = () => {
          console.log("Video intrinsic dimensions:", {
            videoWidth: this.video.videoWidth,
            videoHeight: this.video.videoHeight,
            aspect: this.video.videoWidth / this.video.videoHeight,
          });

          // Update canvas size to match actual video size if available
          this.notifyListeners({
            type: "videoSize",
            width: this.video.videoWidth,
            height: this.video.videoHeight,
            aspect: this.video.videoWidth / this.video.videoHeight,
          });

          this.video.removeEventListener("loadedmetadata", handleVideoMetadata);
        };

        this.video.addEventListener("loadedmetadata", handleVideoMetadata);
      }

      this.notifyListeners({ type: "initialized" });
    } catch (error) {
      console.error("Camera initialization error:", error);
      this.notifyListeners({
        type: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Release camera resources
   */
  public release(): void {
    // Stop capturing frames
    this.stopCapturing();

    // Remove resize event listener
    window.removeEventListener("resize", this.handleResize.bind(this));

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.video.srcObject) {
      this.video.srcObject = null;
    }
  }

  /**
   * Add an event listener
   * @param listener - Callback function for camera events
   * @returns A function that removes the listener
   */
  public addListener(listener: (event: any) => void): () => void {
    this.listeners.push(listener);

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Start continuous frame capture
   */
  public startCapturing(): void {
    if (this.isCapturing) return;

    this.isCapturing = true;
    this.captureFrame();
  }

  /**
   * Stop continuous frame capture
   */
  public stopCapturing(): void {
    this.isCapturing = false;

    if (this.frameRequestId !== null) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }
  }

  /**
   * Capture a single frame from the camera
   */
  public captureFrame(): void {
    // Ensure video is ready and playing
    if (
      this.video.readyState === this.video.HAVE_ENOUGH_DATA &&
      !this.video.paused
    ) {
      try {
        // Ensure canvas dimensions match current window size before drawing
        if (
          this.canvas.width !== window.innerWidth ||
          this.canvas.height !== window.innerHeight
        ) {
          this.canvas.width = window.innerWidth;
          this.canvas.height = window.innerHeight;
        }

        // Calculate aspect ratio and position to avoid stretching
        const videoAspect = this.video.videoWidth / this.video.videoHeight;
        const canvasAspect = this.canvas.width / this.canvas.height;

        let drawWidth,
          drawHeight,
          offsetX = 0,
          offsetY = 0;

        // Clear the canvas first
        this.context!.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (videoAspect > canvasAspect) {
          // Video is wider than canvas - fit to width
          drawWidth = this.canvas.width;
          drawHeight = this.canvas.width / videoAspect;
          offsetY = (this.canvas.height - drawHeight) / 2;
        } else {
          // Video is taller than canvas - fit to height
          drawHeight = this.canvas.height;
          drawWidth = this.canvas.height * videoAspect;
          offsetX = (this.canvas.width - drawWidth) / 2;
        }

        // Draw the video frame preserving aspect ratio
        this.context!.drawImage(
          this.video,
          offsetX,
          offsetY,
          drawWidth,
          drawHeight
        );

        const imageData = this.context!.getImageData(
          0,
          0,
          this.canvas.width,
          this.canvas.height
        );

        this.notifyListeners({
          type: "frame",
          imageData,
          drawDimensions: {
            x: offsetX,
            y: offsetY,
            width: drawWidth,
            height: drawHeight,
            videoAspect,
            canvasAspect,
          },
        });
      } catch (e) {
        console.error("Error capturing frame:", e);
        this.notifyListeners({
          type: "error",
          error: e instanceof Error ? e : new Error(String(e)),
        });
      }
    } else {
      // Notify that we're waiting for video data
      this.notifyListeners({
        type: "waiting",
        readyState: this.video.readyState,
        paused: this.video.paused,
      });
    }

    // Continue capturing frames if still capturing
    if (this.isCapturing) {
      this.frameRequestId = requestAnimationFrame(() => this.captureFrame());
    }
  }

  /**
   * Notify all listeners of an event
   * @param event - The event to notify about
   */
  private notifyListeners(event: any): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error("Error in listener:", e);
      }
    }
  }
}

export default CameraService;
