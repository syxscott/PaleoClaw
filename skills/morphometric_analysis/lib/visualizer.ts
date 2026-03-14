/**
 * Visualizer Module
 * 可视化模块
 * 
 * 功能：
 * 1. 生成带地标点标注的图像
 * 2. 绘制轮廓和连接线
 * 3. 显示地标点编号
 */

import sharp from 'sharp';
import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import { readFile } from 'fs/promises';
import type { Point2D, Landmark, SpecimenResult, VisualizationOptions } from './types.js';
import { getLandmarkLinks } from './landmark-detector.js';

/**
 * Default visualization options
 */
const DEFAULT_OPTIONS: Required<VisualizationOptions> = {
  showNumbers: true,
  showConnections: true,
  pointSize: 4,
  landmarkColor: '#FF0000',   // Red for landmarks
  imageOpacity: 0.3,
  outputSize: { width: 800, height: 800 },
};

/**
 * Generate visualization image with landmarks
 * 生成带地标点的可视化图像
 * 
 * @param result - Specimen analysis result
 * @param outputPath - Output image path
 * @param options - Visualization options
 */
export async function generateVisualization(
  result: SpecimenResult,
  outputPath: string,
  options: VisualizationOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Load original image
  const imageBuffer = await readFile(result.imagePath);
  const originalImage = sharp(imageBuffer);
  const metadata = await originalImage.metadata();
  
  const imgWidth = metadata.width || 512;
  const imgHeight = metadata.height || 512;
  
  // Create canvas
  const canvas = createCanvas(opts.outputSize.width, opts.outputSize.height);
  const ctx = canvas.getContext('2d');
  
  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, opts.outputSize.width, opts.outputSize.height);
  
  // Draw original image with opacity
  const resizedImage = await originalImage
    .resize(opts.outputSize.width, opts.outputSize.height, { fit: 'contain' })
    .toBuffer();
  
  const image = await loadImage(resizedImage);
  ctx.globalAlpha = opts.imageOpacity;
  ctx.drawImage(image, 0, 0);
  ctx.globalAlpha = 1.0;
  
  // Calculate scale factors
  const scaleX = opts.outputSize.width / imgWidth;
  const scaleY = opts.outputSize.height / imgHeight;
  
  // Draw connections
  if (opts.showConnections) {
    drawConnections(ctx, result.landmarks, scaleX, scaleY);
  }
  
  // Draw landmarks
  drawLandmarks(ctx, result.landmarks, opts, scaleX, scaleY);
  
  // Draw labels
  if (opts.showNumbers) {
    drawLabels(ctx, result.landmarks, opts, scaleX, scaleY);
  }
  
  // Draw info box
  drawInfoBox(ctx, result, opts.outputSize.width);
  
  // Save output
  const outputBuffer = await canvas.encode('png');
  await sharp(outputBuffer).toFile(outputPath);
}

/**
 * Draw landmark connections
 * 绘制地标点连接
 */
function drawConnections(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  scaleX: number,
  scaleY: number
): void {
  const links = getLandmarkLinks(landmarks.length);
  
  ctx.strokeStyle = '#00AA00';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  
  for (const [fromIdx, toIdx] of links) {
    const from = landmarks.find(l => l.id === fromIdx);
    const to = landmarks.find(l => l.id === toIdx);
    
    if (from && to) {
      ctx.beginPath();
      ctx.moveTo(from.x * scaleX, from.y * scaleY);
      ctx.lineTo(to.x * scaleX, to.y * scaleY);
      ctx.stroke();
    }
  }
  
  ctx.setLineDash([]);
}

/**
 * Draw landmarks
 * 绘制地标点
 */
function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  options: Required<VisualizationOptions>,
  scaleX: number,
  scaleY: number
): void {
  for (const lm of landmarks) {
    const x = lm.x * scaleX;
    const y = lm.y * scaleY;
    const size = options.pointSize;

    // Set color for landmarks
    ctx.fillStyle = options.landmarkColor;

    // Draw circle
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Draw landmark labels
 * 绘制地标点标签
 */
function drawLabels(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  options: Required<VisualizationOptions>,
  scaleX: number,
  scaleY: number
): void {
  ctx.font = '10px Arial';
  ctx.fillStyle = '#000000';

  for (const lm of landmarks) {
    const x = lm.x * scaleX;
    const y = lm.y * scaleY;

    // Label every landmark
    ctx.fillText(lm.name || `${lm.id}`, x + options.pointSize + 2, y - options.pointSize);
  }
}

/**
 * Draw info box
 * 绘制信息框
 */
function drawInfoBox(
  ctx: CanvasRenderingContext2D,
  result: SpecimenResult,
  canvasWidth: number
): void {
  const boxX = 10;
  const boxY = 10;
  const boxWidth = 200;
  const lineHeight = 16;
  
  // Calculate box height based on content
  let lines = 3; // specimenId, landmarks, contour points
  if (result.taxonomy?.genus) lines++;
  if (result.taxonomy?.species) lines++;

  const boxHeight = lines * lineHeight + 10;

  // Draw background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // Draw border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  // Draw text
  ctx.fillStyle = '#000000';
  ctx.font = '12px Arial';

  let y = boxY + lineHeight;
  ctx.fillText(`ID: ${result.specimenId}`, boxX + 5, y);
  y += lineHeight;

  ctx.fillText(`Landmarks: ${result.landmarks.length}`, boxX + 5, y);
  y += lineHeight;

  ctx.fillText(`Contour points: ${result.contour.length}`, boxX + 5, y);
  y += lineHeight;

  if (result.taxonomy?.genus) {
    ctx.fillText(`Genus: ${result.taxonomy.genus}`, boxX + 5, y);
    y += lineHeight;
  }
  
  if (result.taxonomy?.species) {
    ctx.fillText(`Species: ${result.taxonomy.species}`, boxX + 5, y);
  }
}

/**
 * Load image from buffer
 * 从缓冲区加载图像
 */
async function loadImage(buffer: Buffer): Promise<any> {
  // @napi-rs/canvas uses Image class
  const { Image } = await import('@napi-rs/canvas');
  const img = new Image();
  img.src = buffer;
  return img;
}

/**
 * Generate comparison visualization (before/after)
 * 生成对比可视化（处理前后）
 * 
 * @param originalPath - Original image path
 * @param result - Analysis result
 * @param outputPath - Output path
 * @param options - Visualization options
 */
export async function generateComparison(
  originalPath: string,
  result: SpecimenResult,
  outputPath: string,
  options: VisualizationOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Create side-by-side canvas
  const width = opts.outputSize.width * 2;
  const height = opts.outputSize.height;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  
  // Load original image
  const originalBuffer = await readFile(originalPath);
  const originalImage = await sharp(originalBuffer)
    .resize(opts.outputSize.width, opts.outputSize.height, { fit: 'contain' })
    .toBuffer();
  
  const img = await loadImage(originalImage);
  
  // Draw original (left side)
  ctx.drawImage(img, 0, 0);
  ctx.font = '14px Arial';
  ctx.fillStyle = '#000000';
  ctx.fillText('Original', 10, 20);
  
  // Draw with landmarks (right side)
  ctx.drawImage(img, opts.outputSize.width, 0);
  
  // Calculate scale
  const metadata = await sharp(originalBuffer).metadata();
  const imgWidth = metadata.width || 512;
  const imgHeight = metadata.height || 512;
  const scaleX = opts.outputSize.width / imgWidth;
  const scaleY = opts.outputSize.height / imgHeight;
  
  // Draw landmarks on right side
  ctx.save();
  ctx.translate(opts.outputSize.width, 0);
  
  if (opts.showConnections) {
    drawConnections(ctx, result.landmarks, scaleX, scaleY);
  }
  drawLandmarks(ctx, result.landmarks, opts, scaleX, scaleY);
  if (opts.showNumbers) {
    drawLabels(ctx, result.landmarks, opts, scaleX, scaleY);
  }
  
  ctx.restore();
  
  ctx.fillText('With Landmarks', opts.outputSize.width + 10, 20);
  
  // Save
  const outputBuffer = await canvas.encode('png');
  await sharp(outputBuffer).toFile(outputPath);
}

/**
 * Generate batch summary visualization
 * 生成批量汇总可视化
 * 
 * @param batch - Batch result
 * @param outputPath - Output path
 */
export async function generateBatchSummary(
  batch: { results: SpecimenResult[] },
  outputPath: string
): Promise<void> {
  const cols = 4;
  const rows = Math.ceil(batch.results.length / cols);
  const thumbWidth = 200;
  const thumbHeight = 200;
  
  const canvasWidth = cols * thumbWidth;
  const canvasHeight = rows * thumbHeight + 50; // Extra for header
  
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Header
  ctx.fillStyle = '#000000';
  ctx.font = '16px Arial';
  ctx.fillText(`Batch Analysis: ${batch.results.length} specimens`, 10, 25);
  
  // Draw thumbnails
  for (let i = 0; i < batch.results.length; i++) {
    const result = batch.results[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * thumbWidth;
    const y = row * thumbHeight + 50;
    
    // Draw border
    ctx.strokeStyle = '#CCCCCC';
    ctx.strokeRect(x, y, thumbWidth, thumbHeight);
    
    // Draw specimen ID
    ctx.fillStyle = '#000000';
    ctx.font = '10px Arial';
    ctx.fillText(result.specimenId, x + 5, y + 15);
    
    // Draw landmark count
    ctx.fillText(`${result.landmarks.length} LMs`, x + 5, y + 30);
  }
  
  // Save
  const outputBuffer = await canvas.encode('png');
  await sharp(outputBuffer).toFile(outputPath);
}

/**
 * Export visualization options
 * 导出可视化选项
 */
export function createVisualizationOptions(
  overrides: Partial<VisualizationOptions> = {}
): Required<VisualizationOptions> {
  return { ...DEFAULT_OPTIONS, ...overrides };
}
