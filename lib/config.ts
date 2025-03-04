export const CONFIG = {
  MAX_CANVAS_HEIGHT: 720,
  MAX_CORNERS: 300,
  NUM_TRAIN_LEVELS: 8,
  MAX_PATTERN_SIZE: 512,
  MATCH_THRESHOLD: 48,
  POINT_THRESHOLD: 20,
  GOOD_MATCH_THRESHOLD_OPTICAL: 10,
  GOOD_MATCH_THRESHOLD_TRACKING: 20,
  PRUNE_THRESHOLD: 20,
  BLUR_SIZE: 5,
  LAP_THRESHOLD: 30,
  EIGEN_THRESHOLD: 25,
  MAX_PER_LEVEL: 300,
  SCALE_INC: Math.sqrt(2.0),
  PYRAMID_LEVELS: 5,
  DENSITY_THRESHOLD: 25,
  GRID_DISTANCE: 30,
  MAX_QUAD_ANGLE_ALLOWED: 120,
  // For BRIEF descriptor calculation (32x32 pixels, shouldn't be changed)
  U_MAX: [15, 15, 15, 15, 14, 14, 14, 13, 13, 12, 11, 10, 9, 8, 6, 3],
  MAX_PERSIST_OPTICAL_FRAMES: 6,
  // Video overlay options
  // Debug options
  DEBUG: {
    SHOW_BOUNDING_BOX: false, // Show/hide the bounding box outline
    SHOW_CORNERS: false,
    SHOW_MATCHES: false,
  },
  // IMAGE_URL: "https://storage.googleapis.com/zingcam/original/images/y4x90r1cm4extw0cfzol43nt.jpg"
};

export default CONFIG;
