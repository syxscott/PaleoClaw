---
name: morphometric_analysis
description: "Extract morphometric landmarks from fossil images for geometric morphometrics analysis. Supports ammonoids, brachiopods, and other fossils with clear outlines. Exports to TPS, CSV, Excel, JSON formats compatible with MorphoJ and R geomorph. Use when: analyzing fossil morphology, preparing data for GM analysis, quantifying shape variation."
homepage: https://github.com/syxscott/PaleoClaw
metadata:
  {
    "paleoclaw":
      {
        "emoji": "📐",
        "requires": { "bins": [], "nodePackages": ["sharp", "@napi-rs/canvas"] },
        "install": [],
      },
  }
---

# Morphometric Analysis Skill

Extract landmarks from fossil images for geometric morphometrics analysis.

## When to Use

✅ **USE this skill when:**

- "Extract landmarks from this ammonoid image"
- "Analyze the shape of these fossil specimens"
- "Prepare morphometric data for MorphoJ"
- "Generate semilandmarks for curve analysis"
- "Export TPS format for geometric morphometrics"
- "Batch process fossil images"
- "Visualize landmark positions on fossils"

## When NOT to Use

❌ **DON'T use this skill when:**

- 3D models → use 3D landmark tools
- Unclear/poor quality images → improve image quality first
- Already have landmarks → use statistical analysis tools
- Non-fossil specimens → use general image analysis

## Supported Fossil Types

- **Ammonoids** (菊石) - Primary target, well-tested
- **Brachiopods** (腕足动物) - Shell outlines
- **Bivalves** (双壳类) - Valve outlines
- **Gastropods** (腹足类) - Shell spirals
- **Trilobites** (三叶虫) - Cephalon/pygidium outlines
- **Any fossil** with clear binary silhouette

## Input Requirements

### Image Format
- **Supported**: PNG, JPG, JPEG, TIFF, WEBP
- **Recommended**: Binary silhouette (black fossil on white background)
- **Resolution**: Minimum 512x512 pixels
- **Color**: Grayscale or binary preferred

### Image Quality
- Clear, sharp outline
- High contrast between fossil and background
- Minimal noise or artifacts
- Complete specimen (not cropped)

## Output Formats

### TPS Format (Recommended for MorphoJ)
```
LANDMARKS
64
x1 y1
x2 y2
...
x64 y64
IMAGE=specimen.png
ID=specimen_001
SCALE=1.0
```

### CSV Format
```csv
specimen_id,landmark_id,x,y,type,name
specimen_001,1,256.5,128.0,landmark,LM1
specimen_001,2,260.3,130.2,landmark,LM2
...
specimen_001,64,255.8,129.5,landmark,LM64
```

### JSON Format (PaleoClaw Internal)
```json
{
  "specimenId": "specimen_001",
  "imagePath": "/path/to/image.png",
  "landmarks": [
    {"id": 1, "x": 256.5, "y": 128.0, "type": "fixed", "name": "top"},
    ...
  ],
  "timestamp": "2026-03-09T10:30:00Z"
}
```

## Landmark Configuration

### Landmarks (64 points total)
- All 64 landmarks are semilandmarks with sliding constraints
- Evenly distributed along contour
- Start from arbitrary point, proceed clockwise
- Sliding constraints defined in curveslide.csv (matching DeepMorph)
- Compatible with MorphoJ and R geomorph

## Commands

### Single Image Analysis

```bash
# Basic analysis
paleoclaw agent --message "Extract landmarks from ammonoid.png"

# With specific output directory
paleoclaw agent --message "Analyze specimen.jpg and save to results/"

# Export specific formats
paleoclaw agent --message "Extract landmarks from fossil.png and export as TPS and CSV"
```

### Batch Processing

```bash
# Process all images in directory
paleoclaw agent --message "Batch process all images in specimens/ folder"

# With custom configuration
paleoclaw agent --message "Analyze all images in data/fossils with 128 semilandmarks"
```

### Visualization

```bash
# Generate landmark visualization
paleoclaw agent --message "Show landmarks on ammonoid.png"

# Generate comparison (before/after)
paleoclaw agent --message "Create comparison visualization for specimen.png"
```

### Export Only

```bash
# Re-export existing results
paleoclaw agent --message "Export previous analysis to Excel format"
```

## Configuration Options

### Processing Options
```typescript
{
  threshold: 150,        // Binarization threshold (0-255)
  padding: 2,            // Edge detection padding
  numLandmarks: 64,      // Number of landmarks (matching DeepMorph)
  applyCurveslide: true  // Apply sliding constraints
}
```

### Export Formats
- `tps` - MorphoJ/TPSdig compatible
- `csv` - Comma-separated values
- `excel` - Excel spreadsheet
- `json` - PaleoClaw internal format

### Visualization Options
```typescript
{
  showNumbers: true,           // Show landmark numbers
  showConnections: true,       // Show connecting lines
  pointSize: 4,                // Landmark point size
  landmarkColor: '#FF0000',    // Landmark color (red)
  imageOpacity: 0.3            // Background image opacity
}
```

## Output Structure

```
data/outputs/morphometrics/
├── tps/
│   └── specimen_001.tps
├── csv/
│   └── specimen_001.csv
├── json/
│   └── specimen_001.json
├── visualizations/
│   ├── specimen_001_landmarks.png
│   └── specimen_001_comparison.png
├── curveslide.csv          # Sliding configuration
└── landmark_links.txt      # Landmark connectivity
```

## Scientific Integrity Rules

⚠️ **CRITICAL**:

- **Image Quality**: Poor quality images will produce inaccurate landmarks
- **Threshold Adjustment**: Default threshold (150) may need tuning for some images
- **Manual Verification**: Always verify landmark positions visually
- **Taxonomic Context**: Landmarks are specific to fossil type
- **Reproducibility**: Save processing parameters with results

### Quality Control Checklist

- [ ] Image has clear, complete outline
- [ ] Fixed landmarks are correctly positioned
- [ ] Semilandmarks follow contour smoothly
- [ ] No duplicate or overlapping points
- [ ] Visualization shows expected pattern

## Integration with Other Skills

### With PBDB Query
```
User: "Analyze this ammonoid and find its occurrences in PBDB"
Agent: 1. Extract landmarks from image
       2. Query PBDB for ammonoid occurrences
       3. Correlate morphology with distribution
```

### With Taxonomy Lookup
```
User: "Extract landmarks and verify the taxonomic classification"
Agent: 1. Extract landmarks
       2. Lookup taxonomic classification
       3. Associate morphology with taxonomy
```

### With Paper Search
```
User: "Find papers using similar morphometric methods"
Agent: 1. Extract landmarks
       2. Search for geometric morphometrics papers
       3. Suggest relevant methodologies
```

## Memory Integration

Results are automatically saved to PaleoClaw memory system:

### Short-term Memory
- Processing timestamp
- Image path and size
- Landmark coordinates
- Export file paths

### Long-term Memory
- Project accumulation
- Morphometric patterns
- Analysis history
- Research trajectory

## Troubleshooting

### No Contour Detected
- Check image contrast
- Adjust threshold value
- Ensure binary silhouette

### Landmarks Misplaced
- Verify image orientation
- Check for image artifacts
- Manual threshold tuning

### Export Errors
- Verify output directory permissions
- Check disk space
- Ensure valid file paths

### Visualization Issues
- Install canvas dependencies: `npm install @napi-rs/canvas`
- Check image format support
- Verify output directory exists

## Dependencies

### Required
- `sharp` - Image processing
- `@napi-rs/canvas` - Visualization (optional)

### Installation
```bash
npm install sharp @napi-rs/canvas
```

## Citation

If you use this skill in your research:

```bibtex
@software{paleoclaw_morphometrics,
  author = {PaleoClaw Contributors},
  title = {PaleoClaw Morphometric Analysis Skill},
  year = {2026},
  url = {https://github.com/syxscott/PaleoClaw}
}
```

**Based on**: DeepMorph by Xiaokang Liu (CUG)

## References

- Bookstein, F.L. 1991. Morphometric tools for landmark data.
- Rohlf, F.J. & Marcus, L.F. 1993. A revolution in morphometrics.
- Zelditch, M.L. et al. 2012. Geometric morphometrics for biologists.

## Version

- **Skill Version**: 1.0.0
- **PaleoClaw Compatibility**: >= 1.2.0
- **Last Updated**: 2026-03-09
