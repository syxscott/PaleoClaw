/**
 * Image Processor Module
 * 图像处理核心模块 - 纯 Node.js 实现
 * 
 * 功能：
 * 1. 图像二值化
 * 2. 边缘检测（轮廓提取）
 * 3. 坐标点提取
 * 
 * 基于 DeepMorph 的 Python 算法移植
 */

import sharp from 'sharp';
import type { Point2D, ProcessingOptions } from './types.js';

/**
 * Default processing options (matching DeepMorph)
 */
const DEFAULT_OPTIONS: Required<ProcessingOptions> = {
  threshold: 150,
  padding: 2,
  numLandmarks: 64,
  applyCurveslide: true,
};

/**
 * Process image and extract contour coordinates
 * 处理图像并提取轮廓坐标
 * 
 * @param imagePath - Path to input image
 * @param options - Processing options
 * @returns Array of contour coordinates
 */
export async function extractContour(
  imagePath: string,
  options: ProcessingOptions = {}
): Promise<Point2D[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // 1. Load image and convert to grayscale
  const { data, info } = await sharp(imagePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const { width, height } = info;
  const pixels = new Uint8Array(data);
  
  // 2. Binarization (thresholding)
  const binary = binarize(pixels, width, height, opts.threshold);
  
  // 3. Add padding (to match DeepMorph's np.pad)
  const padded = addPadding(binary, width, height, opts.padding, 255);
  const paddedWidth = width + 2 * opts.padding;
  const paddedHeight = height + 2 * opts.padding;
  
  // 4. Edge detection (find contour pixels)
  const edgePixels = detectEdges(padded, paddedWidth, paddedHeight);
  
  // 5. Remove duplicates and convert to coordinates
  const uniquePoints = removeDuplicatePoints(edgePixels);
  
  // 6. Remove padding offset
  const contour = uniquePoints.map(p => ({
    x: p.x - opts.padding,
    y: p.y - opts.padding,
  }));
  
  return contour;
}

/**
 * Binarize image pixels
 * 二值化处理
 * 
 * @param pixels - Grayscale pixel data
 * @param width - Image width
 * @param height - Image height
 * @param threshold - Threshold value (0-255)
 * @returns Binary array (0 or 255)
 */
function binarize(
  pixels: Uint8Array,
  width: number,
  height: number,
  threshold: number
): Uint8Array {
  const binary = new Uint8Array(width * height);
  
  for (let i = 0; i < pixels.length; i++) {
    binary[i] = pixels[i] >= threshold ? 255 : 0;
  }
  
  return binary;
}

/**
 * Add padding to binary image
 * 为二值图像添加边缘填充
 * 
 * @param binary - Binary pixel data
 * @param width - Original width
 * @param height - Original height
 * @param pad - Padding size
 * @param padValue - Padding value (255 for white)
 * @returns Padded binary array
 */
function addPadding(
  binary: Uint8Array,
  width: number,
  height: number,
  pad: number,
  padValue: number
): Uint8Array {
  const newWidth = width + 2 * pad;
  const newHeight = height + 2 * pad;
  const padded = new Uint8Array(newWidth * newHeight);
  
  // Fill with padding value
  padded.fill(padValue);
  
  // Copy original image to center
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * width + x;
      const dstIdx = (y + pad) * newWidth + (x + pad);
      padded[dstIdx] = binary[srcIdx];
    }
  }
  
  return padded;
}

/**
 * Detect edges using 4-connected neighborhood
 * 使用4连通邻域检测边缘
 * 
 * Algorithm (matching DeepMorph):
 * - Check each pixel's right and bottom neighbors
 * - If different values, it's an edge pixel
 * 
 * @param binary - Padded binary array
 * @param width - Padded width
 * @param height - Padded height
 * @returns Array of edge pixel coordinates
 */
function detectEdges(
  binary: Uint8Array,
  width: number,
  height: number
): Point2D[] {
  const edges: Point2D[] = [];
  
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = y * width + x;
      const current = binary[idx];
      
      // Check right neighbor
      const right = binary[idx + 1];
      if (current !== right) {
        // Edge pixel is the black one (0)
        if (current === 0) {
          edges.push({ x, y });
        } else {
          edges.push({ x: x + 1, y });
        }
      }
      
      // Check bottom neighbor
      const bottom = binary[(y + 1) * width + x];
      if (current !== bottom) {
        // Edge pixel is the black one (0)
        if (current === 0) {
          edges.push({ x, y });
        } else {
          edges.push({ x, y: y + 1 });
        }
      }
    }
  }
  
  return edges;
}

/**
 * Remove duplicate points
 * 移除重复点
 * 
 * @param points - Array of points
 * @returns Array of unique points
 */
function removeDuplicatePoints(points: Point2D[]): Point2D[] {
  const seen = new Set<string>();
  const unique: Point2D[] = [];
  
  for (const p of points) {
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }
  
  return unique;
}

/**
 * Get image dimensions
 * 获取图像尺寸
 * 
 * @param imagePath - Path to image
 * @returns Image width and height
 */
export async function getImageSize(
  imagePath: string
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imagePath).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Validate image format
 * 验证图像格式
 * 
 * @param imagePath - Path to image
 * @returns Whether format is supported
 */
export async function validateImageFormat(imagePath: string): Promise<boolean> {
  try {
    const metadata = await sharp(imagePath).metadata();
    const supportedFormats = ['png', 'jpg', 'jpeg', 'tiff', 'webp'];
    return supportedFormats.includes(metadata.format || '');
  } catch {
    return false;
  }
}

/**
 * Preprocess image for better contour extraction
 * 预处理图像以获得更好的轮廓提取效果
 * 
 * @param imagePath - Input image path
 * @param outputPath - Output preprocessed image path
 * @param options - Processing options
 */
export async function preprocessImage(
  imagePath: string,
  outputPath: string,
  options: ProcessingOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  await sharp(imagePath)
    .grayscale()
    .threshold(opts.threshold)
    .toFile(outputPath);
}

/**
 * Calculate bounding box of contour
 * 计算轮廓的边界框
 * 
 * @param contour - Array of contour points
 * @returns Bounding box {minX, minY, maxX, maxY}
 */
export function calculateBoundingBox(contour: Point2D[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  const xs = contour.map(p => p.x);
  const ys = contour.map(p => p.y);
  
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}
