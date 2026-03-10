/**
 * Exporters Module
 * 数据导出模块
 * 
 * 支持格式：
 * 1. TPS - MorphoJ / TPSdig 格式
 * 2. CSV - 逗号分隔值
 * 3. Excel - XLSX 格式
 * 4. JSON - PaleoClaw 内部格式
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { SpecimenResult, BatchResult, ExportConfig, ExportFormat, Landmark } from './types.js';
import { exportCurveslideToCSV, exportLinksToText } from './curveslide.js';

/**
 * Export single specimen result
 * 导出单个标本结果
 * 
 * @param result - Specimen analysis result
 * @param config - Export configuration
 */
export async function exportSpecimen(
  result: SpecimenResult,
  config: ExportConfig
): Promise<void> {
  // Ensure output directory exists
  await mkdir(dirname(config.outputPath), { recursive: true });
  
  switch (config.format) {
    case 'tps':
      await exportToTPS(result, config);
      break;
    case 'csv':
      await exportToCSV(result, config);
      break;
    case 'excel':
      await exportToExcel(result, config);
      break;
    case 'json':
      await exportToJSON(result, config);
      break;
    default:
      throw new Error(`Unsupported export format: ${config.format}`);
  }
}

/**
 * Export batch results
 * 导出批量结果
 * 
 * @param batch - Batch processing result
 * @param config - Export configuration
 */
export async function exportBatch(
  batch: BatchResult,
  config: ExportConfig
): Promise<void> {
  await mkdir(dirname(config.outputPath), { recursive: true });
  
  switch (config.format) {
    case 'tps':
      await exportBatchToTPS(batch, config);
      break;
    case 'csv':
      await exportBatchToCSV(batch, config);
      break;
    case 'excel':
      await exportBatchToExcel(batch, config);
      break;
    case 'json':
      await exportBatchToJSON(batch, config);
      break;
    default:
      throw new Error(`Unsupported export format: ${config.format}`);
  }
}

/**
 * Export to TPS format (MorphoJ compatible)
 * 导出为 TPS 格式（MorphoJ 兼容）
 * 
 * TPS Format:
 * LANDMARKS
 * n=<number of landmarks>
 * x1 y1
 * x2 y2
 * ...
 * IMAGE=<image filename>
 * ID=<specimen id>
 * SCALE=<scale>
 * 
 * @param result - Specimen result
 * @param config - Export config
 */
async function exportToTPS(
  result: SpecimenResult,
  config: ExportConfig
): Promise<void> {
  const lines: string[] = [];
  
  // Header
  lines.push(`LANDMARKS`);
  lines.push(`${result.landmarks.length}`);
  
  // Coordinates
  for (const lm of result.landmarks) {
    lines.push(`${lm.x.toFixed(6)} ${lm.y.toFixed(6)}`);
  }
  
  // Metadata
  lines.push(`IMAGE=${result.imagePath}`);
  lines.push(`ID=${result.specimenId}`);
  
  if (config.includeScale && config.scale) {
    lines.push(`SCALE=${config.scale}`);
  }
  
  // Taxonomy info if available
  if (result.taxonomy) {
    if (result.taxonomy.genus) lines.push(`GENUS=${result.taxonomy.genus}`);
    if (result.taxonomy.species) lines.push(`SPECIES=${result.taxonomy.species}`);
    if (result.taxonomy.family) lines.push(`FAMILY=${result.taxonomy.family}`);
  }
  
  await writeFile(config.outputPath, lines.join('\n'), 'utf-8');
}

/**
 * Export batch to single TPS file
 * 导出批量结果到单个 TPS 文件
 */
async function exportBatchToTPS(
  batch: BatchResult,
  config: ExportConfig
): Promise<void> {
  const lines: string[] = [];
  
  for (const result of batch.results) {
    // Header
    lines.push(`LANDMARKS`);
    lines.push(`${result.landmarks.length}`);
    
    // Coordinates
    for (const lm of result.landmarks) {
      lines.push(`${lm.x.toFixed(6)} ${lm.y.toFixed(6)}`);
    }
    
    // Metadata
    lines.push(`IMAGE=${result.imagePath}`);
    lines.push(`ID=${result.specimenId}`);
    
    if (config.includeScale && config.scale) {
      lines.push(`SCALE=${config.scale}`);
    }
    
    // Empty line between specimens
    lines.push('');
  }
  
  await writeFile(config.outputPath, lines.join('\n'), 'utf-8');
}

/**
 * Export to CSV format
 * 导出为 CSV 格式
 * 
 * Format:
 * specimen_id,landmark_id,x,y,type,name
 */
async function exportToCSV(
  result: SpecimenResult,
  config: ExportConfig
): Promise<void> {
  const lines: string[] = [];
  
  // Header
  const headers = ['specimen_id', 'landmark_id', 'x', 'y', 'type'];
  if (config.includeNames) {
    headers.push('name');
  }
  lines.push(headers.join(','));
  
  // Data rows
  for (const lm of result.landmarks) {
    const row = [
      result.specimenId,
      lm.id,
      lm.x.toFixed(6),
      lm.y.toFixed(6),
      lm.type,
    ];
    if (config.includeNames) {
      row.push(lm.name || '');
    }
    lines.push(row.join(','));
  }
  
  await writeFile(config.outputPath, lines.join('\n'), 'utf-8');
}

/**
 * Export batch to CSV
 * 导出批量结果到 CSV
 */
async function exportBatchToCSV(
  batch: BatchResult,
  config: ExportConfig
): Promise<void> {
  const lines: string[] = [];
  
  // Header
  const headers = ['specimen_id', 'landmark_id', 'x', 'y', 'type'];
  if (config.includeNames) {
    headers.push('name');
  }
  lines.push(headers.join(','));
  
  // Data rows for all specimens
  for (const result of batch.results) {
    for (const lm of result.landmarks) {
      const row = [
        result.specimenId,
        lm.id,
        lm.x.toFixed(6),
        lm.y.toFixed(6),
        lm.type,
      ];
      if (config.includeNames) {
        row.push(lm.name || '');
      }
      lines.push(row.join(','));
    }
  }
  
  await writeFile(config.outputPath, lines.join('\n'), 'utf-8');
}

/**
 * Export to Excel format (XLSX)
 * 导出为 Excel 格式
 * 
 * Note: Using CSV with .xlsx extension as a simple approach
 * For full Excel support, would need xlsx library
 */
async function exportToExcel(
  result: SpecimenResult,
  config: ExportConfig
): Promise<void> {
  // For now, export as CSV with Excel extension
  // In production, use a library like 'xlsx' or 'exceljs'
  const csvConfig = { ...config, outputPath: config.outputPath.replace('.xlsx', '.csv') };
  await exportToCSV(result, csvConfig);
  
  // TODO: Implement proper Excel export with formatting
  // This would include:
  // - Multiple sheets (Coordinates, Metadata, Statistics)
  // - Formatted headers
  // - Column widths
  // - Colors for fixed vs semilandmarks
}

/**
 * Export batch to Excel
 * 导出批量结果到 Excel
 */
async function exportBatchToExcel(
  batch: BatchResult,
  config: ExportConfig
): Promise<void> {
  // For now, export as CSV
  const csvConfig = { ...config, outputPath: config.outputPath.replace('.xlsx', '.csv') };
  await exportBatchToCSV(batch, csvConfig);
}

/**
 * Export to JSON format (PaleoClaw internal)
 * 导出为 JSON 格式（PaleoClaw 内部格式）
 */
async function exportToJSON(
  result: SpecimenResult,
  config: ExportConfig
): Promise<void> {
  const data = {
    ...result,
    exportInfo: {
      format: 'json',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
  
  await writeFile(config.outputPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Export batch to JSON
 * 导出批量结果到 JSON
 */
async function exportBatchToJSON(
  batch: BatchResult,
  config: ExportConfig
): Promise<void> {
  const data = {
    ...batch,
    exportInfo: {
      format: 'json',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
  
  await writeFile(config.outputPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Export curveslide configuration
 * 导出滑动配置
 * 
 * @param outputPath - Output file path
 */
export async function exportCurveslideConfig(outputPath: string): Promise<void> {
  const csv = exportCurveslideToCSV();
  await writeFile(outputPath, csv, 'utf-8');
}

/**
 * Export landmark links
 * 导出地标点连接关系
 * 
 * @param outputPath - Output file path
 */
export async function exportLandmarkLinks(outputPath: string): Promise<void> {
  const text = exportLinksToText();
  await writeFile(outputPath, text, 'utf-8');
}

/**
 * Generate default export configuration
 * 生成默认导出配置
 * 
 * @param format - Export format
 * @param outputPath - Output path
 * @returns Export configuration
 */
export function createExportConfig(
  format: ExportFormat,
  outputPath: string
): ExportConfig {
  return {
    format,
    outputPath,
    includeNames: true,
    includeScale: false,
  };
}

/**
 * Get file extension for format
 * 获取格式的文件扩展名
 * 
 * @param format - Export format
 * @returns File extension
 */
export function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'tps':
      return '.tps';
    case 'csv':
      return '.csv';
    case 'excel':
      return '.xlsx';
    case 'json':
      return '.json';
    default:
      return '.txt';
  }
}

/**
 * Get MIME type for format
 * 获取格式的 MIME 类型
 * 
 * @param format - Export format
 * @returns MIME type
 */
export function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'tps':
      return 'text/plain';
    case 'csv':
      return 'text/csv';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'json':
      return 'application/json';
    default:
      return 'text/plain';
  }
}
