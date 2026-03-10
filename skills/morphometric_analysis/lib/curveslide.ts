/**
 * Curveslide Module
 * 曲线滑动模块
 * 
 * 功能：
 * 1. 定义半地标点的滑动规则
 * 2. 应用滑动约束（用于后续 GM 分析）
 * 
 * 基于 DeepMorph 的 ammonoid_curveslide.csv
 */

import type { Point2D, CurveslideConfig } from './types.js';

/**
 * Default curveslide configuration for 64 semilandmarks
 * 64个半地标点的默认滑动配置
 * 
 * Format: before, slide, after
 * - before: 前一个地标点索引
 * - slide: 当前滑动地标点索引
 * - after: 后一个地标点索引
 * 
 * Note: Landmark indices are 1-based (matching DeepMorph)
 * Fixed landmarks: 1-4
 * Semilandmarks: 5-68
 */
export const DEFAULT_CURVESLIDE_CONFIG: CurveslideConfig[] = [
  // Semilandmark 5-16
  { before: 1, slide: 5, after: 6 },
  { before: 5, slide: 6, after: 7 },
  { before: 6, slide: 7, after: 8 },
  { before: 7, slide: 8, after: 9 },
  { before: 8, slide: 9, after: 10 },
  { before: 9, slide: 10, after: 11 },
  { before: 10, slide: 11, after: 12 },
  { before: 11, slide: 12, after: 13 },
  { before: 12, slide: 13, after: 14 },
  { before: 13, slide: 14, after: 15 },
  { before: 14, slide: 15, after: 16 },
  { before: 15, slide: 16, after: 17 },
  
  // Semilandmark 17-32
  { before: 16, slide: 17, after: 18 },
  { before: 17, slide: 18, after: 19 },
  { before: 18, slide: 19, after: 20 },
  { before: 19, slide: 20, after: 21 },
  { before: 20, slide: 21, after: 22 },
  { before: 21, slide: 22, after: 23 },
  { before: 22, slide: 23, after: 24 },
  { before: 23, slide: 24, after: 25 },
  { before: 24, slide: 25, after: 26 },
  { before: 25, slide: 26, after: 27 },
  { before: 26, slide: 27, after: 28 },
  { before: 27, slide: 28, after: 29 },
  { before: 28, slide: 29, after: 30 },
  { before: 29, slide: 30, after: 31 },
  { before: 30, slide: 31, after: 32 },
  
  // Semilandmark 33-48
  { before: 31, slide: 32, after: 33 },
  { before: 32, slide: 33, after: 34 },
  { before: 33, slide: 34, after: 35 },
  { before: 34, slide: 35, after: 36 },
  { before: 35, slide: 36, after: 37 },
  { before: 36, slide: 37, after: 38 },
  { before: 37, slide: 38, after: 39 },
  { before: 38, slide: 39, after: 40 },
  { before: 39, slide: 40, after: 41 },
  { before: 40, slide: 41, after: 42 },
  { before: 41, slide: 42, after: 43 },
  { before: 42, slide: 43, after: 44 },
  { before: 43, slide: 44, after: 45 },
  { before: 44, slide: 45, after: 46 },
  { before: 45, slide: 46, after: 47 },
  { before: 46, slide: 47, after: 48 },
  
  // Semilandmark 49-64
  { before: 47, slide: 48, after: 49 },
  { before: 48, slide: 49, after: 50 },
  { before: 49, slide: 50, after: 51 },
  { before: 50, slide: 51, after: 52 },
  { before: 51, slide: 52, after: 53 },
  { before: 52, slide: 53, after: 54 },
  { before: 53, slide: 54, after: 55 },
  { before: 54, slide: 55, after: 56 },
  { before: 55, slide: 56, after: 57 },
  { before: 56, slide: 57, after: 58 },
  { before: 57, slide: 58, after: 59 },
  { before: 58, slide: 59, after: 60 },
  { before: 59, slide: 60, after: 61 },
  { before: 60, slide: 61, after: 62 },
  { before: 61, slide: 62, after: 63 },
  { before: 62, slide: 63, after: 64 },
  
  // Connect back to fixed landmarks
  { before: 63, slide: 64, after: 1 },
];

/**
 * Load curveslide configuration from file
 * 从文件加载滑动配置
 * 
 * @param filePath - Path to curveslide CSV file
 * @returns Array of curveslide configurations
 */
export function loadCurveslideConfig(filePath: string): CurveslideConfig[] {
  // For now, return default config
  // TODO: Implement CSV parsing if needed
  return DEFAULT_CURVESLIDE_CONFIG;
}

/**
 * Get curveslide configuration for a specific semilandmark
 * 获取特定半地标点的滑动配置
 * 
 * @param landmarkId - Landmark ID (5-68 for semilandmarks)
 * @returns Curveslide configuration or null if not found
 */
export function getCurveslideForLandmark(
  landmarkId: number
): CurveslideConfig | null {
  const config = DEFAULT_CURVESLIDE_CONFIG.find(c => c.slide === landmarkId);
  return config || null;
}

/**
 * Apply curveslide constraint to a semilandmark
 * 应用曲线滑动约束到半地标点
 * 
 * This function adjusts the position of a semilandmark to lie on the
 * curve between its 'before' and 'after' anchor points.
 * 
 * Algorithm:
 * 1. Find the contour segment between 'before' and 'after' points
 * 2. Project the current semilandmark onto this segment
 * 3. Return the projected position
 * 
 * @param landmark - Current semilandmark position
 * @param before - Anchor point before
 * @param after - Anchor point after
 * @param contour - Full contour points
 * @returns Adjusted landmark position
 */
export function applyCurveslide(
  landmark: Point2D,
  before: Point2D,
  after: Point2D,
  contour: Point2D[]
): Point2D {
  // Find contour segment between before and after
  const segment = extractContourSegment(contour, before, after);
  
  if (segment.length === 0) {
    // Fallback: project onto line between before and after
    return projectOntoLine(landmark, before, after);
  }
  
  // Find closest point on segment to current landmark
  return findClosestPointOnSegment(landmark, segment);
}

/**
 * Extract contour segment between two points
 * 提取两个点之间的轮廓段
 */
function extractContourSegment(
  contour: Point2D[],
  start: Point2D,
  end: Point2D
): Point2D[] {
  const startIdx = findClosestPointIndex(contour, start);
  const endIdx = findClosestPointIndex(contour, end);
  
  if (startIdx === -1 || endIdx === -1) {
    return [];
  }
  
  // Extract segment (handle wrap-around)
  const segment: Point2D[] = [];
  let idx = startIdx;
  
  while (idx !== endIdx) {
    segment.push(contour[idx]);
    idx = (idx + 1) % contour.length;
  }
  segment.push(contour[endIdx]);
  
  return segment;
}

/**
 * Project point onto line segment
 * 将点投影到线段上
 */
function projectOntoLine(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D
): Point2D {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len2 = dx * dx + dy * dy;
  
  if (len2 === 0) {
    return lineStart;
  }
  
  // Calculate projection parameter
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / len2
  ));
  
  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
  };
}

/**
 * Find closest point on segment to given point
 * 找到线段上最接近给定点的点
 */
function findClosestPointOnSegment(
  point: Point2D,
  segment: Point2D[]
): Point2D {
  let closest = segment[0];
  let minDist = distance(point, closest);
  
  for (let i = 1; i < segment.length; i++) {
    const dist = distance(point, segment[i]);
    if (dist < minDist) {
      minDist = dist;
      closest = segment[i];
    }
  }
  
  return closest;
}

/**
 * Find index of closest point
 * 找到最接近的点的索引
 */
function findClosestPointIndex(contour: Point2D[], target: Point2D): number {
  let minIdx = -1;
  let minDist = Infinity;
  
  for (let i = 0; i < contour.length; i++) {
    const dist = distance(contour[i], target);
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }
  
  return minIdx;
}

/**
 * Euclidean distance
 * 欧几里得距离
 */
function distance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Export curveslide configuration to CSV format
 * 导出滑动配置为 CSV 格式
 * 
 * @returns CSV string
 */
export function exportCurveslideToCSV(): string {
  const lines = ['before,slide,after'];
  
  for (const config of DEFAULT_CURVESLIDE_CONFIG) {
    lines.push(`${config.before},${config.slide},${config.after}`);
  }
  
  return lines.join('\n');
}

/**
 * Export landmark links to text format
 * 导出地标点连接关系到文本格式
 * 
 * Based on DeepMorph's ammonoid_links.txt format
 * 
 * @returns Text string (tab-separated)
 */
export function exportLinksToText(): string {
  const lines: string[] = [];
  
  // Connect landmarks in sequence (1-2, 2-3, ..., 63-64, 64-1)
  // This matches DeepMorph's ammonoid_links.txt format
  for (let i = 1; i <= 64; i++) {
    const next = i === 64 ? 1 : i + 1;
    lines.push(`${i}\t${next}`);
  }
  
  return lines.join('\n');
}
