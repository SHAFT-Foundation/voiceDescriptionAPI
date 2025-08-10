#!/usr/bin/env node

/**
 * Visual Assets Creation Script
 * Generates placeholder images and sets up folder structure for documentation
 */

const fs = require('fs');
const path = require('path');

// Define the folder structure
const DOCS_IMAGES_PATH = path.join(process.cwd(), 'docs', 'images');

const folderStructure = {
  screenshots: [
    'homepage-hero-desktop.png',
    'homepage-hero-tablet.png',
    'homepage-hero-mobile.png',
    'upload-interface-empty.png',
    'upload-interface-active.png',
    'processing-dashboard-10.png',
    'processing-dashboard-65.png',
    'processing-dashboard-95.png',
    'results-display-video.png',
    'results-display-image.png',
    'api-docs-overview.png',
    'api-docs-try-it-out.png'
  ],
  diagrams: [
    'processing-pipeline.svg',
    'architecture-overview.svg',
    'aws-services-integration.svg',
    'data-flow.svg',
    'user-journey-video.svg',
    'user-journey-image.svg'
  ],
  examples: [
    'before-after-video.png',
    'before-after-image.png',
    'accessibility-comparison.png',
    'sample-video-thumbnail.jpg',
    'sample-image-thumbnail.jpg'
  ],
  icons: [
    'video-processing.svg',
    'image-analysis.svg',
    'batch-processing.svg',
    'audio-synthesis.svg',
    'wcag-compliant.svg',
    'api-integration.svg'
  ],
  demos: [
    'upload-process.gif',
    'processing-animation.gif',
    'results-interaction.gif'
  ],
  badges: [
    'build-passing.svg',
    'coverage-95.svg',
    'version-2.1.0.svg',
    'uptime-99.95.svg'
  ],
  mockups: [
    'desktop-mockup.png',
    'tablet-mockup.png',
    'mobile-mockup.png'
  ],
  charts: [
    'performance-metrics.png',
    'usage-statistics.png',
    'feature-comparison.png'
  ]
};

// SVG templates for placeholder images
const svgTemplates = {
  icon: (name, color = '#667eea') => `
<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
  <rect width="60" height="60" fill="white"/>
  <circle cx="30" cy="30" r="25" fill="none" stroke="${color}" stroke-width="2"/>
  <text x="30" y="35" font-family="Arial" font-size="10" fill="${color}" text-anchor="middle">
    ${name.split('-')[0].toUpperCase()}
  </text>
</svg>`,

  diagram: (name) => `
<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="400" fill="#f7fafc"/>
  <rect x="50" y="50" width="150" height="80" fill="#667eea" rx="8"/>
  <rect x="300" y="50" width="150" height="80" fill="#764ba2" rx="8"/>
  <rect x="550" y="50" width="150" height="80" fill="#49cc90" rx="8"/>
  <line x1="200" y1="90" x2="300" y2="90" stroke="#718096" stroke-width="2" marker-end="url(#arrowhead)"/>
  <line x1="450" y1="90" x2="550" y2="90" stroke="#718096" stroke-width="2" marker-end="url(#arrowhead)"/>
  <text x="400" y="250" font-family="Arial" font-size="16" fill="#718096" text-anchor="middle">
    ${name.replace('.svg', '').replace(/-/g, ' ').toUpperCase()}
  </text>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#718096"/>
    </marker>
  </defs>
</svg>`,

  badge: (text, color = '#49cc90') => `
<svg width="120" height="20" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="20" fill="${color}" rx="3"/>
  <text x="60" y="14" font-family="Arial" font-size="11" fill="white" text-anchor="middle">
    ${text}
  </text>
</svg>`
};

// PNG placeholder (1x1 transparent pixel base64)
const PNG_PLACEHOLDER = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Create folder structure
function createFolderStructure() {
  console.log('📁 Creating folder structure...');
  
  // Create main images directory
  if (!fs.existsSync(DOCS_IMAGES_PATH)) {
    fs.mkdirSync(DOCS_IMAGES_PATH, { recursive: true });
    console.log('✅ Created: docs/images/');
  }

  // Create subdirectories and placeholder files
  Object.entries(folderStructure).forEach(([folder, files]) => {
    const folderPath = path.join(DOCS_IMAGES_PATH, folder);
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`✅ Created: docs/images/${folder}/`);
    }

    // Create placeholder files
    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      
      if (!fs.existsSync(filePath)) {
        if (file.endsWith('.svg')) {
          // Create SVG placeholder
          let content;
          if (folder === 'icons') {
            content = svgTemplates.icon(file);
          } else if (folder === 'diagrams') {
            content = svgTemplates.diagram(file);
          } else if (folder === 'badges') {
            content = svgTemplates.badge(file.replace('.svg', '').replace(/-/g, ' '));
          } else {
            content = svgTemplates.diagram(file);
          }
          fs.writeFileSync(filePath, content.trim());
        } else if (file.endsWith('.png') || file.endsWith('.jpg')) {
          // Create PNG/JPG placeholder
          const buffer = Buffer.from(PNG_PLACEHOLDER, 'base64');
          fs.writeFileSync(filePath, buffer);
        } else if (file.endsWith('.gif')) {
          // Create GIF placeholder (same as PNG for now)
          const buffer = Buffer.from(PNG_PLACEHOLDER, 'base64');
          fs.writeFileSync(filePath, buffer);
        }
        console.log(`  📄 Created placeholder: ${file}`);
      }
    });
  });

  // Create root level files
  const rootFiles = ['logo.svg', 'hero-banner.png', 'social-card.png'];
  rootFiles.forEach(file => {
    const filePath = path.join(DOCS_IMAGES_PATH, file);
    if (!fs.existsSync(filePath)) {
      if (file === 'logo.svg') {
        fs.writeFileSync(filePath, svgTemplates.icon('LOGO', '#667eea').trim());
      } else {
        const buffer = Buffer.from(PNG_PLACEHOLDER, 'base64');
        fs.writeFileSync(filePath, buffer);
      }
      console.log(`✅ Created: docs/images/${file}`);
    }
  });
}

// Create README for images folder
function createImageReadme() {
  const readmePath = path.join(DOCS_IMAGES_PATH, 'README.md');
  const content = `# Documentation Images

This folder contains all visual assets for the Voice Description API documentation.

## Folder Structure

- **screenshots/** - UI screenshots at different breakpoints
- **diagrams/** - Technical architecture and flow diagrams
- **examples/** - Before/after comparison images
- **icons/** - Feature and UI icons
- **demos/** - Animated GIF demonstrations
- **badges/** - Status and metric badges
- **mockups/** - Device mockups
- **charts/** - Data visualizations

## Image Guidelines

### Screenshots
- Desktop: 1920x1080
- Tablet: 768x1024
- Mobile: 375x812

### Icons
- Format: SVG
- Size: 60x60
- Style: Outlined, 2px stroke

### File Optimization
- PNG: Max 200KB
- SVG: Minified with SVGO
- GIF: Max 5MB

## Updating Images

1. Replace placeholder with actual image
2. Optimize file size
3. Update alt text in documentation
4. Test across devices
5. Clear CDN cache if deployed

## Tools

- Screenshots: Chrome DevTools, BrowserStack
- Diagrams: draw.io, Figma
- Optimization: TinyPNG, SVGO, ImageOptim
- GIF Creation: Gifski, ScreenToGif
`;

  fs.writeFileSync(readmePath, content);
  console.log('📝 Created: docs/images/README.md');
}

// Create image optimization script
function createOptimizationScript() {
  const scriptPath = path.join(process.cwd(), 'scripts', 'optimize-images.sh');
  const content = `#!/bin/bash

# Image Optimization Script
# Requires: imageoptim-cli, svgo

echo "🎨 Optimizing images..."

# Optimize PNGs and JPGs
if command -v imageoptim &> /dev/null; then
  imageoptim 'docs/images/**/*.{png,jpg,jpeg}' --no-imageoptim --imagealpha --jpegmini
else
  echo "⚠️  imageoptim-cli not found. Install with: npm install -g imageoptim-cli"
fi

# Optimize SVGs
if command -v svgo &> /dev/null; then
  svgo -r -f docs/images --config='{"plugins":[{"name":"preset-default","params":{"overrides":{"removeViewBox":false}}}]}'
else
  echo "⚠️  svgo not found. Install with: npm install -g svgo"
fi

# Optimize GIFs
if command -v gifsicle &> /dev/null; then
  find docs/images -name "*.gif" -exec gifsicle --batch --optimize=3 {} \\;
else
  echo "⚠️  gifsicle not found. Install with: brew install gifsicle"
fi

echo "✅ Image optimization complete!"
`;

  if (!fs.existsSync(path.dirname(scriptPath))) {
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  }
  
  fs.writeFileSync(scriptPath, content);
  fs.chmodSync(scriptPath, '755');
  console.log('🔧 Created: scripts/optimize-images.sh');
}

// Main execution
function main() {
  console.log('🚀 Voice Description API - Visual Assets Setup\n');
  
  try {
    createFolderStructure();
    createImageReadme();
    createOptimizationScript();
    
    console.log('\n✨ Visual assets structure created successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Replace placeholder images with actual screenshots');
    console.log('  2. Create proper diagrams using draw.io or similar');
    console.log('  3. Run optimization script: ./scripts/optimize-images.sh');
    console.log('  4. Update README.md with image references');
    console.log('  5. Add alt text for all images\n');
  } catch (error) {
    console.error('❌ Error creating visual assets:', error);
    process.exit(1);
  }
}

// Run the script
main();