/**
 * Landmark Detector Module
 * 地标点检测模块
 *
 * 功能：
 * 1. 检测 64 个地标点（沿轮廓均匀分布）
 * 
 * 基于 DeepMorph 的 Python 算法移植
 * DeepMorph 使用 64 个连续的地标点（1-64），每个都有滑动约束
 */

import type { Point2D, Landmark } from './types.js';
import { calculateBoundingBox } from './image-processor.js';

/**
 * Detect 64 landmarks from contour
 * 从轮廓检测 64 个地标点
 * 
 * DeepMorph uses 64 landmarks (1-64), evenly distributed along contour
 * Each landmark has sliding constraints defined in curveslide.csv
 * 
 * @param contour - Array of contour coordinates
 * @param numLandmarks - Number of landmarks to generate (default: 64)
 * @returns Array of landmarks
 */
export function detectLandmarks(
  contour: Point2D[],
  numLandmarks: number = 64
): Landmark[] {
  // Calculate total contour length
  const totalLength = calculateContourLength(contour);
  
  // Place landmarks evenly
  const landmarks: Landmark[] = [];
  const spacing = totalLength / numLandmarks;
  
  let currentDist = 0;
  let nextLandmarkDist = spacing / 2; // Start at half spacing
  
  for (let i = 0; i < contour.length - 1; i++) {
    const p1 = contour[i];
    const p2 = contour[i + 1];
    const segmentLength = distance(p1, p2);
    
    while (currentDist + segmentLength >= nextLandmarkDist && landmarks.length < numLandmarks) {
      const ratio = (nextLandmarkDist - currentDist) / segmentLength;
      const landmark: Landmark = {
        x: p1.x + ratio * (p2.x - p1.x),
        y: p1.y + ratio * (p2.y - p1.y),
        id: landmarks.length + 1, // Start from 1
        type: 'landmark',
        name: `LM${landmarks.length + 1}`,
      };
      landmarks.push(landmark);
      nextLandmarkDist += spacing;
    }
    
    currentDist += segmentLength;
  }
  
  return landmarks;
}

/**
 * Get landmark links for visualization
 * 获取地标点连接关系（用于可视化）
 * 
 * Based on DeepMorph's ammonoid_links.txt:
 * 1-2, 2-3, 3-4, 4-5, ..., 63-64, 64-1
 * 
 * @returns Array of [from, to] index pairs
 */
export function getLandmarkLinks(): Array<[number, number]> {
  const links: Array<[number, number]> = [];
  
  // Connect landmarks in sequence (1-2, 2-3, ..., 63-64, 64-1)
  // This matches DeepMorph's ammonoid_links.txt format
  for (let i = 1; i < 64; i++) {
    links.push([i, i + 1]);
  }
  links.push([64, 1]); // Close the loop
  
  return links;
}

/**
 * Detect all landmarks (matching DeepMorph)
 * 检测所有地标点（匹配 DeepMorph）
 * 
 * DeepMorph uses 64 landmarks (1-64), evenly distributed along contour
 * 
 * @param contour - Array of contour coordinates
 * @param numLandmarks - Number of landmarks (default: 64)
 * @returns Array of landmarks
 */
export function detectAllLandmarks(
  contour: Point2D[],
  numLandmarks: number = 64
): Landmark[] {
  return detectLandmarks(contour, numLandmarks);
}
