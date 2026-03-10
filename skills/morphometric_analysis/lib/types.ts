/**
 * Morphometric Analysis Types
 * 几何形态测量学分析类型定义
 */

/**
 * 2D Coordinate point
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Landmark with optional metadata
 */
export interface Landmark extends Point2D {
  id: number;
  type: 'landmark';
  name?: string;
}

/**
 * Analysis result for a single specimen
 */
export interface SpecimenResult {
  /** Specimen identifier */
  specimenId: string;
  /** Input image path */
  imagePath: string;
  /** Image dimensions */
  imageSize: { width: number; height: number };
  /** All landmarks (64 points total) */
  landmarks: Landmark[];
  /** Contour coordinates (raw edge points) */
  contour: Point2D[];
  /** Processing timestamp */
  timestamp: string;
  /** Optional taxonomic information */
  taxonomy?: {
    genus?: string;
    species?: string;
    family?: string;
  };
  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Batch processing result
 */
export interface BatchResult {
  /** Total specimens processed */
  total: number;
  /** Successfully processed */
  success: number;
  /** Failed specimens */
  failed: number;
  /** Individual results */
  results: SpecimenResult[];
  /** Errors */
  errors: Array<{ specimenId: string; error: string }>;
  /** Output directory */
  outputDir: string;
  /** Processing timestamp */
  timestamp: string;
}

/**
 * Export format options
 */
export type ExportFormat = 'tps' | 'csv' | 'excel' | 'json';

/**
 * Export configuration
 */
export interface ExportConfig {
  /** Output format */
  format: ExportFormat;
  /** Output file path */
  outputPath: string;
  /** Include landmark names */
  includeNames?: boolean;
  /** Include scale information */
  includeScale?: boolean;
  /** Image scale (pixels per unit) */
  scale?: number;
  /** Unit name */
  unit?: string;
}

/**
 * Processing options
 */
export interface ProcessingOptions {
  /** Threshold for binarization (0-255) */
  threshold?: number;
  /** Padding size for edge detection */
  padding?: number;
  /** Number of landmarks to generate (default: 64, matching DeepMorph) */
  numLandmarks?: number;
  /** Whether to apply curveslide */
  applyCurveslide?: boolean;
}

/**
 * TPS file format structure
 */
export interface TPSData {
  /** Number of landmarks */
  n: number;
  /** Image file name */
  image: string;
  /** Scale */
  scale?: number;
  /** Coordinates */
  coordinates: Point2D[];
}

/**
 * Curveslide configuration (from ammonoid_curveslide.csv)
 * 
 * DeepMorph uses 64 landmarks (1-64), each with sliding constraints
 * Format: before, slide, after
 * 
 * Note: Landmark indices are 1-based (matching DeepMorph)
 * All 64 points are semilandmarks with sliding constraints
 */
export interface CurveslideConfig {
  /** Before landmark index */
  before: number;
  /** Slide landmark index */
  slide: number;
  /** After landmark index */
  after: number;
}

/**
 * Visualization options
 */
export interface VisualizationOptions {
  /** Show landmark numbers */
  showNumbers?: boolean;
  /** Show connecting lines */
  showConnections?: boolean;
  /** Landmark point size */
  pointSize?: number;
  /** Landmark color */
  landmarkColor?: string;
  /** Background image opacity */
  imageOpacity?: number;
  /** Output image size */
  outputSize?: { width: number; height: number };
}
