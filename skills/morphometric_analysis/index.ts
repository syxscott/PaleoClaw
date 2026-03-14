/**
 * Morphometric Analysis Skill
 * 几何形态测量学分析 Skill
 * 
 * 功能：
 * 1. 从化石图像提取 64 个地标点
 * 2. 导出 TPS、CSV、Excel、JSON 格式
 * 3. 生成可视化图像
 * 4. 支持批量处理
 * 5. 与 PaleoClaw 记忆系统集成
 * 
 * 基于 DeepMorph 算法移植
 * DeepMorph 使用 64 个连续的地标点（1-64），每个都有滑动约束
 */

import { existsSync } from 'fs';
import { mkdir, readdir, stat } from 'fs/promises';
import { basename, extname, join, resolve } from 'path';
import type {
  SpecimenResult,
  BatchResult,
  ProcessingOptions,
  ExportFormat,
  ExportConfig,
  VisualizationOptions,
} from './lib/types.js';
import { extractContour, getImageSize, validateImageFormat } from './lib/image-processor.js';
import { detectAllLandmarks } from './lib/landmark-detector.js';
import { exportSpecimen, exportBatch, createExportConfig, getFileExtension } from './lib/exporters.js';
import { generateVisualization, generateComparison, createVisualizationOptions } from './lib/visualizer.js';
import { exportCurveslideConfig, exportLandmarkLinks } from './lib/curveslide.js';

/**
 * Skill configuration
 */
export interface SkillConfig {
  /** Output directory */
  outputDir: string;
  /** Export formats */
  formats: ExportFormat[];
  /** Generate visualizations */
  generateVisualizations: boolean;
  /** Processing options */
  processingOptions: ProcessingOptions;
  /** Visualization options */
  visualizationOptions: VisualizationOptions;
}

/**
 * Default skill configuration
 */
const DEFAULT_CONFIG: SkillConfig = {
  outputDir: 'data/outputs/morphometrics',
  formats: ['tps', 'csv', 'json'],
  generateVisualizations: true,
  processingOptions: {
    threshold: 150,
    padding: 2,
    numLandmarks: 64,
    applyCurveslide: true,
  },
  visualizationOptions: {
    showNumbers: true,
    showConnections: true,
    pointSize: 4,
    landmarkColor: '#FF0000',
    imageOpacity: 0.3,
  },
};

/**
 * Process single specimen
 * 处理单个标本
 * 
 * @param imagePath - Path to specimen image
 * @param specimenId - Specimen identifier
 * @param config - Skill configuration
 * @returns Analysis result
 */
export async function processSpecimen(
  imagePath: string,
  specimenId?: string,
  config: Partial<SkillConfig> = {}
): Promise<SpecimenResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Validate input
  if (!existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  const isValid = await validateImageFormat(imagePath);
  if (!isValid) {
    throw new Error(`Unsupported image format: ${imagePath}`);
  }

  // Generate specimen ID if not provided
  const id = specimenId || generateSpecimenId(imagePath);

  // Get image size
  const imageSize = await getImageSize(imagePath);

  // Extract contour
  const contour = await extractContour(imagePath, cfg.processingOptions);

  if (contour.length === 0) {
    throw new Error(`No contour found in image: ${imagePath}`);
  }

  // Detect landmarks (64 points matching DeepMorph)
  const landmarks = detectAllLandmarks(
    contour,
    cfg.processingOptions.numLandmarks
  );

  // Build result
  const result: SpecimenResult = {
    specimenId: id,
    imagePath: resolve(imagePath),
    imageSize,
    landmarks,
    contour,
    timestamp: new Date().toISOString(),
  };

  return result;
}

/**
 * Process batch of specimens
 * 批量处理标本
 * 
 * @param inputDir - Directory containing images
 * @param config - Skill configuration
 * @returns Batch processing result
 */
export async function processBatch(
  inputDir: string,
  config: Partial<SkillConfig> = {}
): Promise<BatchResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!existsSync(inputDir)) {
    throw new Error(`Directory not found: ${inputDir}`);
  }

  // Find all image files
  const files = await readdir(inputDir);
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.webp'];
  const imageFiles = files.filter(f => 
    imageExtensions.includes(extname(f).toLowerCase())
  );

  if (imageFiles.length === 0) {
    throw new Error(`No image files found in: ${inputDir}`);
  }

  // Process each image
  const results: SpecimenResult[] = [];
  const errors: Array<{ specimenId: string; error: string }> = [];

  for (const file of imageFiles) {
    const imagePath = join(inputDir, file);
    const specimenId = basename(file, extname(file));

    try {
      const result = await processSpecimen(imagePath, specimenId, cfg);
      results.push(result);
    } catch (error) {
      errors.push({
        specimenId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const batchResult: BatchResult = {
    total: imageFiles.length,
    success: results.length,
    failed: errors.length,
    results,
    errors,
    outputDir: cfg.outputDir,
    timestamp: new Date().toISOString(),
  };

  return batchResult;
}

/**
 * Export results
 * 导出结果
 * 
 * @param result - Specimen or batch result
 * @param config - Skill configuration
 */
export async function exportResults(
  result: SpecimenResult | BatchResult,
  config: Partial<SkillConfig> = {}
): Promise<string[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const outputPaths: string[] = [];

  // Ensure output directory exists
  await mkdir(cfg.outputDir, { recursive: true });

  const isBatch = 'total' in result;

  for (const format of cfg.formats) {
    const ext = getFileExtension(format);
    const filename = isBatch 
      ? `batch_results${ext}`
      : `${result.specimenId}${ext}`;
    const outputPath = join(cfg.outputDir, format, filename);
    
    await mkdir(join(cfg.outputDir, format), { recursive: true });
    
    const exportConfig = createExportConfig(format, outputPath);
    
    if (isBatch) {
      await exportBatch(result as BatchResult, exportConfig);
    } else {
      await exportSpecimen(result as SpecimenResult, exportConfig);
    }
    
    outputPaths.push(outputPath);
  }

  // Export curveslide config
  const curveslidePath = join(cfg.outputDir, 'curveslide.csv');
  await exportCurveslideConfig(curveslidePath);
  outputPaths.push(curveslidePath);

  // Export landmark links
  const linksPath = join(cfg.outputDir, 'landmark_links.txt');
  await exportLandmarkLinks(linksPath);
  outputPaths.push(linksPath);

  return outputPaths;
}

/**
 * Generate visualizations
 * 生成可视化
 * 
 * @param result - Specimen result
 * @param config - Skill configuration
 */
export async function generateVisualizations(
  result: SpecimenResult,
  config: Partial<SkillConfig> = {}
): Promise<string[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const outputPaths: string[] = [];

  if (!cfg.generateVisualizations) {
    return outputPaths;
  }

  const visDir = join(cfg.outputDir, 'visualizations');
  await mkdir(visDir, { recursive: true });

  const visOptions = createVisualizationOptions(cfg.visualizationOptions);

  // Generate landmark visualization
  const visPath = join(visDir, `${result.specimenId}_landmarks.png`);
  await generateVisualization(result, visPath, visOptions);
  outputPaths.push(visPath);

  // Generate comparison (original vs landmarks)
  const compPath = join(visDir, `${result.specimenId}_comparison.png`);
  await generateComparison(result.imagePath, result, compPath, visOptions);
  outputPaths.push(compPath);

  return outputPaths;
}

/**
 * Run complete analysis pipeline
 * 运行完整分析流程
 * 
 * @param imagePath - Image path or directory
 * @param config - Skill configuration
 * @returns Analysis results and output paths
 */
export async function runAnalysis(
  imagePath: string,
  config: Partial<SkillConfig> = {}
): Promise<{
  results: SpecimenResult | BatchResult;
  exportPaths: string[];
  visualizationPaths: string[];
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Check if input is directory or file
  const stats = await stat(imagePath);
  const isDirectory = stats.isDirectory();

  let results: SpecimenResult | BatchResult;

  if (isDirectory) {
    results = await processBatch(imagePath, cfg);
  } else {
    results = await processSpecimen(imagePath, undefined, cfg);
  }

  // Export results
  const exportPaths = await exportResults(results, cfg);

  // Generate visualizations
  const visualizationPaths: string[] = [];
  if (cfg.generateVisualizations) {
    if (isBatchResult(results)) {
      // For batch, generate visualizations for each specimen
      for (const specimen of results.results) {
        const paths = await generateVisualizations(specimen, cfg);
        visualizationPaths.push(...paths);
      }
    } else {
      const paths = await generateVisualizations(results, cfg);
      visualizationPaths.push(...paths);
    }
  }

  return {
    results,
    exportPaths,
    visualizationPaths,
  };
}

/**
 * Generate specimen ID from filename
 * 从文件名生成标本 ID
 */
function generateSpecimenId(imagePath: string): string {
  const name = basename(imagePath, extname(imagePath));
  const timestamp = Date.now().toString(36);
  return `${name}_${timestamp}`;
}

/**
 * Type guard for batch result
 * 批量结果类型守卫
 */
function isBatchResult(result: SpecimenResult | BatchResult): result is BatchResult {
  return 'total' in result;
}

/**
 * Get skill info
 * 获取 Skill 信息
 */
export function getSkillInfo(): {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
} {
  return {
    name: 'morphometric_analysis',
    version: '1.0.0',
    description: 'Extract morphometric landmarks from fossil images for geometric morphometrics analysis',
    capabilities: [
      'Extract 64 landmarks along contour (matching DeepMorph)',
      'Export to TPS, CSV, Excel, JSON formats',
      'Generate visualization images',
      'Batch processing support',
      'Compatible with MorphoJ and geomorph',
    ],
  };
}

/**
 * Validate configuration
 * 验证配置
 * 
 * @param config - Configuration to validate
 * @returns Validation result
 */
export function validateConfig(
  config: Partial<SkillConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.formats) {
    const validFormats: ExportFormat[] = ['tps', 'csv', 'excel', 'json'];
    for (const format of config.formats) {
      if (!validFormats.includes(format)) {
        errors.push(`Invalid export format: ${format}`);
      }
    }
  }

  if (config.processingOptions?.threshold !== undefined) {
    if (config.processingOptions.threshold < 0 || config.processingOptions.threshold > 255) {
      errors.push('Threshold must be between 0 and 255');
    }
  }

  if (config.processingOptions?.numLandmarks !== undefined) {
    if (config.processingOptions.numLandmarks < 1) {
      errors.push('Number of landmarks must be at least 1');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export all modules
export * from './lib/types.js';
export * from './lib/image-processor.js';
export * from './lib/landmark-detector.js';
export * from './lib/curveslide.js';
export * from './lib/exporters.js';
export * from './lib/visualizer.js';
