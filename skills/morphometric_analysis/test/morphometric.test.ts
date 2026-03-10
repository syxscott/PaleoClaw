/**
 * Morphometric Analysis Tests
 * 几何形态测量学分析测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'fs';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import {
  processSpecimen,
  processBatch,
  exportResults,
  generateVisualizations,
  runAnalysis,
  validateConfig,
  getSkillInfo,
} from '../index.js';
import { extractContour } from '../lib/image-processor.js';
import { detectFixedLandmarks, detectAllLandmarks } from '../lib/landmark-detector.js';
import type { Point2D } from '../lib/types.js';

const TEST_DIR = join(__dirname, 'fixtures');
const OUTPUT_DIR = join(__dirname, 'output');

describe('Morphometric Analysis Skill', () => {
  beforeAll(async () => {
    // Create test directories
    await mkdir(TEST_DIR, { recursive: true });
    await mkdir(OUTPUT_DIR, { recursive: true });
  });

  describe('Skill Info', () => {
    it('should return skill information', () => {
      const info = getSkillInfo();
      expect(info.name).toBe('morphometric_analysis');
      expect(info.version).toBe('1.0.0');
      expect(info.capabilities).toHaveLength(6);
    });
  });

  describe('Config Validation', () => {
    it('should validate correct config', () => {
      const result = validateConfig({
        formats: ['tps', 'csv'],
        processingOptions: { threshold: 150 },
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid format', () => {
      const result = validateConfig({
        formats: ['invalid' as any],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid export format: invalid');
    });

    it('should reject invalid threshold', () => {
      const result = validateConfig({
        processingOptions: { threshold: 300 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Threshold must be between 0 and 255');
    });
  });

  describe('Image Processing', () => {
    it('should create a test image and extract contour', async () => {
      // Create a simple test image (white circle on black background)
      const testImagePath = join(TEST_DIR, 'test_circle.png');
      await createTestImage(testImagePath, 'circle');
      
      const contour = await extractContour(testImagePath);
      
      expect(contour.length).toBeGreaterThan(0);
      expect(contour[0]).toHaveProperty('x');
      expect(contour[0]).toHaveProperty('y');
    });

    it('should handle empty image', async () => {
      const testImagePath = join(TEST_DIR, 'test_empty.png');
      await createTestImage(testImagePath, 'empty');
      
      const contour = await extractContour(testImagePath);
      expect(contour.length).toBe(0);
    });
  });

  describe('Landmark Detection', () => {
    it('should detect fixed landmarks from contour', () => {
      // Create a simple rectangular contour
      const contour: Point2D[] = [
        { x: 100, y: 100 }, // top-left
        { x: 200, y: 100 }, // top-right
        { x: 200, y: 200 }, // bottom-right
        { x: 100, y: 200 }, // bottom-left
        { x: 150, y: 100 }, // top-middle
        { x: 200, y: 150 }, // right-middle
        { x: 150, y: 200 }, // bottom-middle
        { x: 100, y: 150 }, // left-middle
      ];
      
      const landmarks = detectFixedLandmarks(contour);
      
      expect(landmarks).toHaveLength(4);
      expect(landmarks[0].type).toBe('fixed');
      expect(landmarks[0].name).toBe('top');
    });

    it('should detect all landmarks', () => {
      // Create a circular contour
      const contour: Point2D[] = [];
      const centerX = 256;
      const centerY = 256;
      const radius = 100;
      
      for (let i = 0; i < 360; i += 5) {
        const rad = (i * Math.PI) / 180;
        contour.push({
          x: centerX + radius * Math.cos(rad),
          y: centerY + radius * Math.sin(rad),
        });
      }
      
      const { landmarks, fixedLandmarks, semilandmarks } = detectAllLandmarks(contour, 64);
      
      expect(fixedLandmarks).toHaveLength(4);
      expect(semilandmarks).toHaveLength(64);
      expect(landmarks).toHaveLength(68);
    });
  });

  describe('Full Pipeline', () => {
    it.skip('should process a single specimen (requires actual image)', async () => {
      // This test requires an actual fossil image
      // Skipped in CI environment
    });

    it.skip('should process batch of specimens (requires actual images)', async () => {
      // This test requires actual fossil images
      // Skipped in CI environment
    });
  });

  describe('Export', () => {
    it.skip('should export to TPS format', async () => {
      // Requires actual processing result
    });

    it.skip('should export to CSV format', async () => {
      // Requires actual processing result
    });
  });
});

/**
 * Create test image
 */
async function createTestImage(
  path: string,
  type: 'circle' | 'empty'
): Promise<void> {
  // This is a placeholder - in real tests, use sharp to create images
  // For now, just create an empty file
  if (type === 'empty') {
    await writeFile(path, Buffer.alloc(0));
  } else {
    // Would use sharp to create actual test image
    await writeFile(path, Buffer.alloc(0));
  }
}
