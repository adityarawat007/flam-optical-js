import CONFIG from "../lib/config";

/**
 * WebGLRenderer - Handles WebGL rendering of camera feed and video overlays
 */
export class WebGLVideoRenderer {
  // Types for WebGL rendering
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private isWebGLInitialized: boolean = false;
  private overlayProgram: WebGLProgram | null = null;

  private overlayVideoElement: HTMLVideoElement | null = null;
  private overlayTexture: WebGLTexture | null = null;

  private overlayTextureCoordsBuffer: WebGLBuffer | null = null;
  private overlayPositionBuffer: WebGLBuffer | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private textureCoordBuffer: WebGLBuffer | null = null;

  private isOverlayVisible: boolean = false;
  private lastValidPoints: CornerPoint[] | null = null;
  // private overlayOpacity: number = 1.0;
  // private fadeSpeed: number = 0.1;
  // private renderSize: number = 420;
  private canvasElement: HTMLCanvasElement | null = null;
  private mainCanvasElement: HTMLCanvasElement | null = null;
  private debugMode: boolean = true;
  private isDetecting: boolean = true; // Add a state to track detection mode

  private video_url: string;

  private patternShapeCanvas: any;

  // Shader sources
  private vsSource: string = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;
    varying vec2 vTextureCoord;
    void main() {
        gl_Position = aVertexPosition;
        vTextureCoord = aTextureCoord;
    }
  `;

  private fsSource: string = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    void main() {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
  `;

  private overlayVsSource: string = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;
    varying vec2 vTextureCoord;
    void main() {
        gl_Position = aVertexPosition;
        vTextureCoord = aTextureCoord;
    }
  `;

  private overlayFsSource: string = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    void main() {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
  `;

  /**
   * Create a new WebGLRenderer instance
   * @param glCanvasId ID of the WebGL canvas element to use for rendering
   * @param mainCanvasId ID of the main canvas element used for reference
   * @param debugMode Enable detailed debug logging
   */
  constructor(
    glCanvasId: string,
    mainCanvasId: string,
    video_url: string,
    debugMode: boolean = false
  ) {
    this.debugMode = debugMode;
    this.video_url = video_url;
    this.debug("Creating WebGLRenderer instance");

    this.patternShapeCanvas = null;

    try {
      // Get the WebGL canvas
      this.canvasElement = document.getElementById(
        glCanvasId
      ) as HTMLCanvasElement;
      if (!this.canvasElement) {
        throw new Error(
          `WebGL canvas element with ID "${glCanvasId}" not found`
        );
      }

      // Get the main canvas for reference
      this.mainCanvasElement = document.getElementById(
        mainCanvasId
      ) as HTMLCanvasElement;
      if (!this.mainCanvasElement) {
        throw new Error(
          `Main canvas element with ID "${mainCanvasId}" not found`
        );
      }

      // Ensure the canvas is visible
      this.canvasElement.style.display = "block";
      this.canvasElement.style.position = "absolute";
      this.canvasElement.style.top = "0";
      this.canvasElement.style.left = "0";
      this.canvasElement.style.width = "100%";
      this.canvasElement.style.height = "100%";
      this.canvasElement.style.zIndex = "10"; // Place above the main canvas
      this.canvasElement.style.pointerEvents = "none"; // Allow clicks to pass through to elements beneath

      // Match WebGL canvas size to main canvas
      this.resizeGLCanvas();

      // Add resize observer to keep canvases in sync
      const resizeObserver = new ResizeObserver(() => {
        this.resizeGLCanvas();
      });
      resizeObserver.observe(this.mainCanvasElement);

      // this.loadImageDimensions(this.image_url);

      this.debug(`Canvas elements found and configured`);
    } catch (error) {
      this.showError("Constructor error", error);
    }
  }

  /**
   * Resize the WebGL canvas to match the main canvas
   */
  private resizeGLCanvas(): void {
    if (!this.canvasElement || !this.mainCanvasElement) return;

    // const rect = this.mainCanvasElement.getBoundingClientRect();
    this.canvasElement.width = this.mainCanvasElement.width;
    this.canvasElement.height = this.mainCanvasElement.height;
    // this.renderSize = Math.max(
    //   this.canvasElement.width,
    //   this.canvasElement.height
    // );

    this.debug(
      `Resized GL canvas to match main canvas: ${this.canvasElement.width}x${this.canvasElement.height}`
    );

    // If WebGL is already initialized, update the viewport
    if (this.gl) {
      this.gl.viewport(
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );
    }
  }

  /**
   * Initialize WebGL context and resources
   * @returns True if initialization was successful
   */
  public initialize(): boolean {
    this.debug("Initializing WebGL renderer");

    try {
      if (!this.canvasElement) {
        throw new Error("Canvas element not available");
      }

      // Try to get WebGL context
      this.gl = this.canvasElement.getContext("webgl", {
        preserveDrawingBuffer: true,
        alpha: true, // Enable alpha channel for transparency
        premultipliedAlpha: false, // Better for video overlays
      });

      if (!this.gl) {
        throw new Error("WebGL not supported in this browser");
      }

      this.debug("WebGL context created successfully");

      // Initialize main program
      this.initializeMainProgram();

      // Initialize overlay program
      this.initializeOverlayProgram();

      this.isWebGLInitialized = true;
      this.debug("WebGL renderer initialized successfully");
      return true;
    } catch (error) {
      this.showError("Initialization error", error);
      return false;
    }
  }

  /**
   * Set detection state to control video playback
   * @param isDetecting Current detection state
   */
  public setDetectionState(isDetecting: boolean): void {
    this.isDetecting = isDetecting;
    this.debug(`Detection state set to: ${isDetecting}`);

    // Control video playback based on detection state
    this.updateVideoPlayback();
  }

  /**
   * Update video playback based on detection state
   */
  private updateVideoPlayback(): void {
    if (!this.overlayVideoElement) return;

    if (this.isDetecting) {
      // Pause the video during detection
      if (!this.overlayVideoElement.paused) {
        this.debug("Pausing overlay video during detection");
        this.overlayVideoElement.pause();
      }
    } else {
      // Play the video when not detecting
      if (this.overlayVideoElement.paused) {
        this.debug("Playing overlay video (not in detection mode)");
        this.overlayVideoElement.play().catch((error) => {
          this.showError("Failed to play overlay video", error);
        });
      }
    }
  }

  /**
   * Initialize main shader program for camera feed
   */
  private initializeMainProgram(): void {
    if (!this.gl) return;

    this.debug("Initializing main shader program");

    try {
      // Create and compile shaders
      const vertexShader = this.loadShader(
        this.gl.VERTEX_SHADER,
        this.vsSource
      );
      const fragmentShader = this.loadShader(
        this.gl.FRAGMENT_SHADER,
        this.fsSource
      );

      if (!vertexShader || !fragmentShader) {
        throw new Error("Failed to compile main shaders");
      }

      // Create and link program
      this.program = this.gl.createProgram();
      if (!this.program) {
        throw new Error("Unable to create main shader program");
      }

      this.gl.attachShader(this.program, vertexShader);
      this.gl.attachShader(this.program, fragmentShader);
      this.gl.linkProgram(this.program);

      if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
        throw new Error(
          "Main shader program failed to link: " +
            this.gl.getProgramInfoLog(this.program)
        );
      }

      // Set up buffers
      this.setupBuffers();

      // Set up texture
      this.setupTexture();

      // Store attribute and uniform locations
      this.program.vertexPosition = this.gl.getAttribLocation(
        this.program,
        "aVertexPosition"
      );
      this.program.textureCoord = this.gl.getAttribLocation(
        this.program,
        "aTextureCoord"
      );
      this.program.uSampler = this.gl.getUniformLocation(
        this.program,
        "uSampler"
      );

      this.debug("Main program initialized successfully", {
        vertexPosition: this.program.vertexPosition,
        textureCoord: this.program.textureCoord,
        uSampler: this.program.uSampler,
      });
    } catch (error) {
      this.showError("Main program initialization error", error);
      throw error; // Re-throw to stop initialization
    }
  }

  /**
   * Set up vertex and texture coordinate buffers
   */
  private setupBuffers(): void {
    if (!this.gl) return;

    this.debug("Setting up buffers");

    // Set up position buffer
    const positions = [
      -1.0,
      1.0, // Top left
      -1.0,
      -1.0, // Bottom left
      1.0,
      1.0, // Top right
      1.0,
      -1.0, // Bottom right
    ];
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(positions),
      this.gl.STATIC_DRAW
    );

    // Set up texture coordinate buffer
    const textureCoords = [
      0.0,
      0.0, // Top left
      0.0,
      1.0, // Bottom left
      1.0,
      0.0, // Top right
      1.0,
      1.0, // Bottom right
    ];
    this.textureCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureCoordBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(textureCoords),
      this.gl.STATIC_DRAW
    );

    this.debug("Buffers created successfully");
  }

  /**
   * Set up main texture for camera feed
   */
  private setupTexture(): void {
    if (!this.gl) return;

    this.debug("Setting up main texture");

    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

    // Set texture parameters
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );

    this.debug("Main texture created successfully");
  }

  /**
   * Initialize overlay shader program
   */
  private initializeOverlayProgram(): void {
    if (!this.gl) return;

    this.debug("Initializing overlay program");

    try {
      // Create and compile overlay shaders
      const vertexShader = this.loadShader(
        this.gl.VERTEX_SHADER,
        this.overlayVsSource
      );
      const fragmentShader = this.loadShader(
        this.gl.FRAGMENT_SHADER,
        this.overlayFsSource
      );

      if (!vertexShader || !fragmentShader) {
        throw new Error("Failed to compile overlay shaders");
      }

      // Create and link overlay program
      this.overlayProgram = this.gl.createProgram();
      if (!this.overlayProgram) {
        throw new Error("Unable to create overlay shader program");
      }

      this.gl.attachShader(this.overlayProgram, vertexShader);
      this.gl.attachShader(this.overlayProgram, fragmentShader);
      this.gl.linkProgram(this.overlayProgram);

      if (
        !this.gl.getProgramParameter(this.overlayProgram, this.gl.LINK_STATUS)
      ) {
        throw new Error(
          "Overlay shader program failed to link: " +
            this.gl.getProgramInfoLog(this.overlayProgram)
        );
      }

      // Store attribute and uniform locations
      this.overlayProgram.vertexPosition = this.gl.getAttribLocation(
        this.overlayProgram,
        "aVertexPosition"
      );
      this.overlayProgram.textureCoord = this.gl.getAttribLocation(
        this.overlayProgram,
        "aTextureCoord"
      );
      this.overlayProgram.uSampler = this.gl.getUniformLocation(
        this.overlayProgram,
        "uSampler"
      );

      // Create overlay position buffer (will be updated dynamically)
      this.overlayPositionBuffer = this.gl.createBuffer();

      // Create overlay texture coordinates buffer
      const textureCoords = [
        0.0,
        0.0, // Top left
        0.0,
        1.0, // Bottom left
        1.0,
        0.0, // Top right
        1.0,
        1.0, // Bottom right
      ];
      this.overlayTextureCoordsBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.overlayTextureCoordsBuffer);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array(textureCoords),
        this.gl.STATIC_DRAW
      );

      // Enable alpha blending
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

      this.debug("Overlay program initialized successfully", {
        vertexPosition: this.overlayProgram.vertexPosition,
        textureCoord: this.overlayProgram.textureCoord,
        uSampler: this.overlayProgram.uSampler,
      });

      // Initialize overlay video
      this.initOverlayVideo(this.video_url);
    } catch (error) {
      this.showError("Overlay program initialization error", error);
      // Continue with main program even if overlay fails
    }
  }

  /**
   * Load and compile a shader
   * @param type Shader type (vertex or fragment)
   * @param source Shader source code
   * @returns Compiled shader or null if compilation failed
   */
  private loadShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    try {
      const shader = this.gl.createShader(type);
      if (!shader) {
        throw new Error("Failed to create shader");
      }

      // Set shader source and compile
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);

      // Check compilation status
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        const error = this.gl.getShaderInfoLog(shader) || "Unknown error";
        this.gl.deleteShader(shader);
        throw new Error("Shader compilation failed: " + error);
      }

      return shader;
    } catch (error) {
      this.showError("Shader loading error", error);
      return null;
    }
  }

  /**
   * Initialize overlay video
   * @param videoUrl URL of the video to use as overlay
   */
  private initOverlayVideo(videoUrl: string): void {
    if (!this.gl) return;

    this.debug(`Initializing overlay video: ${videoUrl}`);

    try {
      this.overlayVideoElement = document.createElement("video");
      this.overlayVideoElement.crossOrigin = "anonymous";
      this.overlayVideoElement.src = videoUrl;
      this.overlayVideoElement.loop = true;
      this.overlayVideoElement.muted = true;
      this.overlayVideoElement.playsInline = true; // Important for mobile
      this.overlayVideoElement.style.display = "none"; // Hide video element but keep it in DOM

      // Append to document body to ensure it's in the DOM
      document.body.appendChild(this.overlayVideoElement);

      // Add event listeners to debug video loading
      this.overlayVideoElement.addEventListener("loadedmetadata", () => {
        this.debug("Overlay video metadata loaded", {
          width: this.overlayVideoElement?.videoWidth,
          height: this.overlayVideoElement?.videoHeight,
          duration: this.overlayVideoElement?.duration,
        });
      });

      this.overlayVideoElement.addEventListener("loadeddata", () => {
        this.debug("Overlay video data loaded");
      });

      this.overlayVideoElement.addEventListener("canplay", () => {
        this.debug("Overlay video can play");
        // Don't start playing immediately - wait for !isDetecting
        this.updateVideoPlayback();
      });

      this.overlayVideoElement.addEventListener("error", (e) => {
        this.showError("Overlay video error", e);
      });

      // Create overlay texture
      this.overlayTexture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.overlayTexture);
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_S,
        this.gl.CLAMP_TO_EDGE
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_T,
        this.gl.CLAMP_TO_EDGE
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MIN_FILTER,
        this.gl.LINEAR
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MAG_FILTER,
        this.gl.LINEAR
      );

      // Initial video state depends on detection state
      // Only start playback if not detecting
      if (!this.isDetecting) {
        this.overlayVideoElement.play().catch((error) => {
          this.showError("Failed to play overlay video initially", error);
        });
      }
    } catch (error) {
      this.showError("Overlay video initialization error", error);
    }
  }

  /**
   * Renders the pattern shape on a canvas overlay before applying any transformations
   * @param cornerPoints The corner points of the pattern in screen coordinates
   * @param canvasWidth Width of the canvas
   * @param canvasHeight Height of the canvas
   */
  private renderPatternShape(
    cornerPoints: CornerPoint[],
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!this.patternShapeCanvas) {
      // Create a canvas for rendering the pattern shape if it doesn't exist
      this.patternShapeCanvas = document.createElement("canvas");
      this.patternShapeCanvas.width = canvasWidth;
      this.patternShapeCanvas.height = canvasHeight;
      this.patternShapeCanvas.style.position = "absolute";
      this.patternShapeCanvas.style.top = "0";
      this.patternShapeCanvas.style.left = "0";
      this.patternShapeCanvas.style.pointerEvents = "none";

      // Add the canvas to the DOM
      if (this.canvasElement && this.canvasElement.parentElement) {
        this.canvasElement.parentElement.appendChild(this.patternShapeCanvas);
      }
    }

    // Make sure the pattern shape canvas size matches the main canvas
    this.patternShapeCanvas.width = canvasWidth;
    this.patternShapeCanvas.height = canvasHeight;

    const ctx = this.patternShapeCanvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Check if shape is a valid quadrilateral (reusing the isQuadrilateral function)
    // We can assume it is valid since it's being processed by updateOverlayPositions

    // Draw the pattern shape
    ctx.strokeStyle = "rgb(0,255,0)";
    ctx.beginPath();
    ctx.moveTo(cornerPoints[0].x, cornerPoints[0].y);
    ctx.lineTo(cornerPoints[1].x, cornerPoints[1].y);
    ctx.lineTo(cornerPoints[2].x, cornerPoints[2].y);
    ctx.lineTo(cornerPoints[3].x, cornerPoints[3].y);
    ctx.lineTo(cornerPoints[0].x, cornerPoints[0].y);
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  /**
   * Update overlay positions based on corner points
   * @param cornerPoints Array of corner points for positioning overlay
   */
  private updateOverlayPositions(cornerPoints: CornerPoint[]): void {
    if (!this.gl || !this.canvasElement) return;

    // this.originalImageHeight, this.originalImageWidth

    try {
      // Convert corner points to WebGL coordinates (-1 to 1)
      const width = this.canvasElement.width;
      const height = this.canvasElement.height;

      // Render the pattern shape before applying any transformations if enabled
      if (CONFIG.DEBUG.SHOW_BOUNDING_BOX) {
        this.renderPatternShape(cornerPoints, width, height);
      } else if (this.patternShapeCanvas) {
        // If bounding box is disabled but canvas exists, clear it
        const ctx = this.patternShapeCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            this.patternShapeCanvas.width,
            this.patternShapeCanvas.height
          );
        }
      }

      const positions = [
        // cornerPoints[0] = top-left
        (cornerPoints[0].x / width) * 2 - 1.0, // x
        1.0 - (cornerPoints[0].y / height) * 2, // y

        // cornerPoints[3] = bottom-left
        (cornerPoints[3].x / width) * 2 - 1.0, // x
        1.0 - (cornerPoints[3].y / height) * 2, // y

        // cornerPoints[1] = top-right
        (cornerPoints[1].x / width) * 2 - 1.0, // x
        1.0 - (cornerPoints[1].y / height) * 2, // y

        // cornerPoints[2] = bottom-right
        (cornerPoints[2].x / width) * 2 - 1.0, // x
        1.0 - (cornerPoints[2].y / height) * 2, // y
      ];

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.overlayPositionBuffer);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array(positions),
        this.gl.DYNAMIC_DRAW
      );
    } catch (error) {
      this.showError("Error updating overlay positions", error);
    }
  }

  /**
   * Render a frame with overlay
   * @param cornerPoints Corner points for overlay positioning
   */
  public render(cornerPoints: CornerPoint[] | null): void {
    if (!this.isWebGLInitialized || !this.gl || !this.overlayProgram) {
      this.debug("Cannot render: WebGL not initialized");
      return;
    }

    try {
      // Clear the WebGL canvas
      this.gl.viewport(
        0,
        0,
        this.canvasElement?.width || 640,
        this.canvasElement?.height || 480
      );
      this.gl.clearColor(0.0, 0.0, 0.0, 0.0); // Fully transparent
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      // Update overlay visibility and position based on corner points
      if (cornerPoints) {
        this.updateOverlayPositions(cornerPoints);
        this.isOverlayVisible = cornerPoints[0].x !== 0;
        this.lastValidPoints = cornerPoints;
      } else {
        this.isOverlayVisible = false;
        if (this.lastValidPoints) {
          this.updateOverlayPositions([
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ]);
        }
        this.lastValidPoints = null;
      }

      // Render overlay if visible and not in detection mode
      if (this.isOverlayVisible && !this.isDetecting) {
        // Update video playback state based on current detection status
        this.updateVideoPlayback();
        this.renderOverlay();
      } else if (
        this.isDetecting &&
        this.overlayVideoElement &&
        !this.overlayVideoElement.paused
      ) {
        // Make sure video is paused if we're in detection mode
        this.overlayVideoElement.pause();
      }
    } catch (error) {
      this.showError("Render error", error);
    }
  }

  /**
   * Render video overlay
   */
  private renderOverlay(): void {
    if (!this.gl || !this.overlayProgram || !this.overlayVideoElement) return;

    try {
      // Skip rendering if video isn't ready or if we're in detection mode
      if (this.overlayVideoElement.readyState < 2 || this.isDetecting) {
        this.debug(
          "Overlay video not rendered: readyState=",
          this.overlayVideoElement.readyState
        );
        return;
      }

      // Enable blending for overlay
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

      // Use overlay program
      this.gl.useProgram(this.overlayProgram);

      // Bind overlay texture
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.overlayTexture);

      try {
        // Update texture with current video frame
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.RGBA,
          this.gl.RGBA,
          this.gl.UNSIGNED_BYTE,
          this.overlayVideoElement
        );
      } catch (texError) {
        this.showError("Error updating overlay texture", texError);
      }

      this.gl.uniform1i(this.overlayProgram.uSampler, 0);

      // Set up attributes
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.overlayPositionBuffer);
      this.gl.vertexAttribPointer(
        this.overlayProgram.vertexPosition,
        2,
        this.gl.FLOAT,
        false,
        0,
        0
      );
      this.gl.enableVertexAttribArray(this.overlayProgram.vertexPosition);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.overlayTextureCoordsBuffer);
      this.gl.vertexAttribPointer(
        this.overlayProgram.textureCoord,
        2,
        this.gl.FLOAT,
        false,
        0,
        0
      );
      this.gl.enableVertexAttribArray(this.overlayProgram.textureCoord);

      // Draw overlay
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

      // Disable blending
      this.gl.disable(this.gl.BLEND);
    } catch (error) {
      this.showError("Error rendering overlay", error);
    }
  }

  /**
   * Set render size (used for coordinate conversion)
   * @param size Render size in pixels
   */
  // public setRenderSize(size: number): void {
  //   this.renderSize = size;
  //   this.debug(`Render size set to ${size}`);
  // }

  /**
   * Clean up WebGL resources
   */
  public dispose(): void {
    this.debug("Disposing WebGL renderer");

    if (this.gl) {
      // Delete textures
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.overlayTexture) this.gl.deleteTexture(this.overlayTexture);

      // Delete buffers
      if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
      if (this.textureCoordBuffer)
        this.gl.deleteBuffer(this.textureCoordBuffer);
      if (this.overlayPositionBuffer)
        this.gl.deleteBuffer(this.overlayPositionBuffer);
      if (this.overlayTextureCoordsBuffer)
        this.gl.deleteBuffer(this.overlayTextureCoordsBuffer);

      // Delete shader programs
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.overlayProgram) this.gl.deleteProgram(this.overlayProgram);
    }

    // Stop video playback
    if (this.overlayVideoElement) {
      this.overlayVideoElement.pause();
      this.overlayVideoElement.src = "";
      this.overlayVideoElement.load();

      // Remove the video element from DOM
      if (this.overlayVideoElement.parentNode) {
        this.overlayVideoElement.parentNode.removeChild(
          this.overlayVideoElement
        );
      }
    }

    this.isWebGLInitialized = false;
    this.debug("WebGL renderer disposed");
  }

  /**
   * Log debug message if debug mode is enabled
   * @param message Debug message
   * @param data Optional data to log
   */
  private debug(message: string, data?: any): void {
    if (this.debugMode) {
      if (data) {
        console.log(`[WebGLRenderer] ${message}`, data);
      } else {
        console.log(`[WebGLRenderer] ${message}`);
      }
    }
  }

  /**
   * Show error message
   * @param context Error context
   * @param error The error object
   */
  private showError(context: string, error: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WebGLRenderer] ${context}:`, error);

    // Add visible error indicator to the canvas
    if (this.canvasElement) {
      // Create or update error message element
      let errorElement = document.getElementById("webgl-error-message");
      if (!errorElement) {
        errorElement = document.createElement("div");
        errorElement.id = "webgl-error-message";
        errorElement.style.position = "absolute";
        errorElement.style.top = "10px";
        errorElement.style.left = "10px";
        errorElement.style.backgroundColor = "rgba(255, 0, 0, 0.7)";
        errorElement.style.color = "white";
        errorElement.style.padding = "10px";
        errorElement.style.borderRadius = "5px";
        errorElement.style.zIndex = "1000";
        errorElement.style.maxWidth = "80%";
        errorElement.style.wordBreak = "break-word";

        // Add to document
        this.canvasElement.parentElement?.appendChild(errorElement);
      }

      errorElement.textContent = `${context}: ${errorMessage}`;

      // Hide after 5 seconds
      setTimeout(() => {
        if (errorElement && errorElement.parentElement) {
          errorElement.style.display = "none";
        }
      }, 5000);
    }
  }
}

// Type definition for corner points
export interface CornerPoint {
  x: number;
  y: number;
}

// Augment the WebGLProgram type to include our custom properties
declare global {
  interface WebGLProgram {
    vertexPosition: number;
    textureCoord: number;
    uSampler: WebGLUniformLocation | null;
  }
}
