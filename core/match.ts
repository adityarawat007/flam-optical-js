/**
 * Class representing a feature match between the screen and pattern
 */
export class Match {
  /**
   * The index of the corner in the screen corners array
   */
  public screen_idx: number;

  /**
   * The level in the pattern pyramid where the match was found
   */
  public pattern_lev: number;

  /**
   * The index of the corner in the pattern corners array
   */
  public pattern_idx: number;

  /**
   * The distance between the descriptors (lower is better)
   */
  public distance: number;

  /**
   * Creates a new Match instance
   * @param screen_idx - The index of the corner in the screen corners array
   * @param pattern_lev - The level in the pattern pyramid where the match was found
   * @param pattern_idx - The index of the corner in the pattern corners array
   * @param distance - The distance between the descriptors (lower is better)
   */
  constructor(
    screen_idx: number = 0,
    pattern_lev: number = 0,
    pattern_idx: number = 0,
    distance: number = 0
  ) {
    this.screen_idx = screen_idx;
    this.pattern_lev = pattern_lev;
    this.pattern_idx = pattern_idx;
    this.distance = distance;
  }
}

export default Match;
