import "./style.css";
import App from "./app";

// Function to extract the shortcode from URL search parameters
function getShortcodeFromURL(): string | null {
  // Get the current URL search parameters
  const urlParams = new URLSearchParams(window.location.search);

  // Try to get the shortcode parameter named "o"
  const shortcode = urlParams.get("o");

  return shortcode;
}

// Modified initialization code to use the shortcode
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Get the shortcode from URL
    const shortcode = getShortcodeFromURL();

    const campaignId = shortcode;

    if (!campaignId) {
      throw new Error(`No Short Code`);
    }

    // Construct the API URL with the shortcode
    const res = await fetch(
      `https://zingcam.prod.flamapp.com/campaign-svc/api/v1/campaigns/${campaignId}/experiences`
    );

    // Check if the response is OK
    if (!res.ok) {
      throw new Error(`API returned status ${res.status}: ${res.statusText}`);
    }

    const responseData = await res.json();

    // Validate the response data structure
    if (
      !responseData ||
      !responseData.data ||
      !responseData.data.experiences ||
      responseData.data.experiences.length === 0
    ) {
      throw new Error("No experiences found for this campaign ID");
    }

    const { data } = responseData;
    const experience = data.experiences[0];

    // Validate that the required properties exist
    if (
      !experience.images ||
      !experience.images.compressed ||
      !experience.videos ||
      !experience.videos.compressed
    ) {
      throw new Error("Experience data is missing required media URLs");
    }

    const image_url = experience.images.compressed;
    const video_url = experience.videos.compressed;
    const offset = experience.variant.offset;
    const scale = experience.variant.scale_axis;

    // Create and initialize the application
    const app = new App(
      "output-canvas",
      "camera-input",
      "stats-panel",
      "glCanvas",
      image_url,
      video_url,
      offset,
      scale
    );

    // Initialize the app
    await app.initialize().catch((error: any) => {
      console.error("Application initialization failed:", error);
      showError(`Failed to initialize: ${error.message}`);
    });

    app.processFrame();

    // Clean up on page unload
    window.addEventListener("beforeunload", () => {
      app.cleanup();
    });
  } catch (error: any) {
    // Handle any errors that occurred during the process
    console.error("Error loading campaign:", error);
    showError(`Error: ${error.message || "Failed to load experience"}`);
  }
});

// Helper function to display errors in the UI
function showError(message: string): void {
  const errorElement = document.getElementById("error-message");
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
  } else {
    // If error element doesn't exist, create one
    const errorDiv = document.createElement("div");
    errorDiv.id = "error-message";
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    errorDiv.style.position = "absolute";
    errorDiv.style.top = "50%";
    errorDiv.style.left = "50%";
    errorDiv.style.transform = "translate(-50%, -50%)";
    errorDiv.style.backgroundColor = "rgba(255, 0, 0, 0.8)";
    errorDiv.style.color = "white";
    errorDiv.style.padding = "15px 20px";
    errorDiv.style.borderRadius = "5px";
    errorDiv.style.zIndex = "1000";
    document.body.appendChild(errorDiv);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Create toggle button
  const toggleButton = document.createElement("button");
  toggleButton.className = "mode-toggle";
  toggleButton.innerHTML = "⟳";
  toggleButton.title = "Toggle display mode";
  document.getElementById("canvas-container")!.appendChild(toggleButton);

  // Create debug info
  const debugInfo = document.createElement("div");
  debugInfo.className = "debug-info hidden";
  document.getElementById("canvas-container")!.appendChild(debugInfo);

  // Set initial mode
  const canvasContainer: any = document.getElementById("canvas-container");
  canvasContainer.classList.add("contain-mode");

  // Current mode index
  let currentModeIndex = 0;
  const modes = ["contain-mode", "cover-mode", "fill-mode"];
  const modeNames = ["Contain (Letterbox)", "Cover (Crop)", "Fill (Stretch)"];

  // Toggle between modes
  toggleButton.addEventListener("click", function () {
    // Remove current mode class
    canvasContainer.classList.remove(modes[currentModeIndex]);

    // Move to next mode
    currentModeIndex = (currentModeIndex + 1) % modes.length;

    // Add new mode class
    canvasContainer.classList.add(modes[currentModeIndex]);

    // Update debug info
    updateDebugInfo();

    // Show temporary notification
    showModeNotification(modeNames[currentModeIndex]);
  });

  // Double-tap anywhere to toggle debug info
  let lastTap = 0;
  document.addEventListener("touchend", function (e) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 500 && tapLength > 0) {
      // Double tap detected
      debugInfo.classList.toggle("hidden");
      e.preventDefault();
    }
    lastTap = currentTime;
  });

  // Update debug info
  function updateDebugInfo() {
    const video: any = document.getElementById("camera-input");
    const canvas: any = document.getElementById("output-canvas");

    debugInfo.innerHTML = `
      <div>Mode: ${modeNames[currentModeIndex]}</div>
      <div>Window: ${window.innerWidth}x${window.innerHeight}</div>
      <div>Canvas: ${canvas.width}x${canvas.height}</div>
      <div>Video: ${video.videoWidth}x${video.videoHeight}</div>
      <div>Video Aspect: ${(video.videoWidth / video.videoHeight).toFixed(
        2
      )}</div>
      <div>Canvas Aspect: ${(canvas.width / canvas.height).toFixed(2)}</div>
    `;
  }

  // Show temporary notification of mode change
  function showModeNotification(modeName: string) {
    // Create or get notification element
    let notification = document.getElementById("mode-notification");
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "mode-notification";
      notification.style.position = "absolute";
      notification.style.top = "50%";
      notification.style.left = "50%";
      notification.style.transform = "translate(-50%, -50%)";
      notification.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      notification.style.color = "white";
      notification.style.padding = "10px 20px";
      notification.style.borderRadius = "5px";
      notification.style.zIndex = "1000";
      notification.style.transition = "opacity 0.5s";
      document.getElementById("canvas-container")!.appendChild(notification);
    }

    // Show notification
    notification.textContent = modeName;
    notification.style.opacity = "1";

    // Hide after timeout
    setTimeout(() => {
      notification.style.opacity = "0";
    }, 1500);
  }

  // Update debug info initially
  setTimeout(updateDebugInfo, 1000);
});
