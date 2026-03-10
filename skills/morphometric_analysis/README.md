# Morphometric Analysis Skill

A PaleoClaw skill for extracting morphometric landmarks from fossil images for geometric morphometrics analysis.

## Features

- ✅ **64 Landmarks**: All semilandmarks with sliding constraints (matching DeepMorph)
- ✅ **Multiple Formats**: TPS, CSV, Excel, JSON
- ✅ **Batch Processing**: Process entire directories
- ✅ **Visualization**: Generate landmark overlay images
- ✅ **Pure Node.js**: No Python dependencies
- ✅ **MorphoJ Compatible**: Standard TPS format output

## Installation

```bash
# Install dependencies
npm install sharp @napi-rs/canvas

# Or from PaleoClaw root
pnpm install
```

## Usage

### Single Image

```typescript
import { processSpecimen, exportResults, generateVisualizations } from './index.js';

const result = await processSpecimen('path/to/ammonoid.png', 'specimen_001');

// Export to multiple formats
await exportResults(result, {
  outputDir: 'data/outputs',
  formats: ['tps', 'csv', 'json'],
});

// Generate visualization
await generateVisualizations(result);
```

### Batch Processing

```typescript
import { processBatch } from './index.js';

const batch = await processBatch('path/to/specimens/');
console.log(`Processed ${batch.success}/${batch.total} specimens`);
```

### CLI Usage

```bash
# Via PaleoClaw agent
paleoclaw agent --message "Extract landmarks from ammonoid.png"

# Batch processing
paleoclaw agent --message "Batch process all images in specimens/"
```

## Algorithm

Based on [DeepMorph](https://github.com/xkliu/DeepMorph) by Xiaokang Liu (CUG):

1. **Image Preprocessing**: Grayscale conversion, thresholding
2. **Edge Detection**: 4-connected neighborhood contour extraction
3. **Landmarks**: 64 evenly distributed semilandmarks
4. **Curveslide**: Sliding constraints for GM analysis

## Output Structure

```
data/outputs/morphometrics/
├── tps/                    # TPS format (MorphoJ)
├── csv/                    # CSV format
├── json/                   # JSON format
├── visualizations/         # PNG images with landmarks
├── curveslide.csv          # Sliding configuration
└── landmark_links.txt      # Connectivity
```

## Configuration

```typescript
{
  outputDir: 'data/outputs/morphometrics',
  formats: ['tps', 'csv', 'json'],
  generateVisualizations: true,
  processingOptions: {
    threshold: 150,        // Binarization threshold
    padding: 2,            // Edge detection padding
    numLandmarks: 64,      // Number of landmarks (matching DeepMorph)
    applyCurveslide: true,
  },
  visualizationOptions: {
    showNumbers: true,
    showConnections: true,
    pointSize: 4,
    landmarkColor: '#FF0000',
  },
}
```

## Testing

```bash
# Run tests
pnpm test

# Run specific test
pnpm test morphometric
```

## License

MIT - Same as PaleoClaw

## Credits

- **Algorithm**: DeepMorph by Xiaokang Liu (CUG) - 64 landmarks design
- **Implementation**: PaleoClaw Team
- **Geometric Morphometrics**: Based on Bookstein (1991), Rohlf & Marcus (1993)
