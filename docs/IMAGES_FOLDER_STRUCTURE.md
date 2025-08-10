# Documentation Images Folder Structure
## Complete Visual Asset Organization

### 📁 Folder Structure

```
/docs/images/
├── logo.svg                    # Main logo (SVG format for scalability)
├── hero-banner.png             # 1920x600 hero image for README
├── social-card.png             # 1200x630 Open Graph image
├── favicon.ico                 # Browser favicon
│
├── screenshots/                # UI Screenshots
│   ├── homepage-hero-desktop.png       # 1920x1080
│   ├── homepage-hero-tablet.png        # 768x1024
│   ├── homepage-hero-mobile.png        # 375x812
│   ├── upload-interface-empty.png      # Drag-drop zone empty state
│   ├── upload-interface-active.png     # File selected with options
│   ├── upload-interface-dragging.png   # Dragging state
│   ├── processing-dashboard-10.png     # 10% progress
│   ├── processing-dashboard-65.png     # 65% progress
│   ├── processing-dashboard-95.png     # 95% progress
│   ├── processing-dashboard-error.png  # Error state
│   ├── results-display-video.png      # Video results
│   ├── results-display-image.png      # Image results
│   ├── results-display-batch.png      # Batch results
│   ├── api-docs-overview.png          # Swagger UI overview
│   ├── api-docs-try-it-out.png        # API testing interface
│   ├── job-history-sidebar.png        # Recent jobs panel
│   └── developer-console.png          # Dev tools panel
│
├── diagrams/                   # Technical Diagrams
│   ├── processing-pipeline.svg         # Main processing flow
│   ├── architecture-overview.svg       # System architecture
│   ├── aws-services-integration.svg    # AWS services diagram
│   ├── data-flow.svg                   # Data flow diagram
│   ├── user-journey-video.svg          # Video processing journey
│   ├── user-journey-image.svg          # Image processing journey
│   ├── api-sequence.svg                # API call sequence
│   ├── deployment-architecture.svg     # Deployment diagram
│   └── security-model.svg              # Security architecture
│
├── examples/                   # Before/After Examples
│   ├── before-after-video.png          # Video accessibility comparison
│   ├── before-after-image.png          # Image alt text comparison
│   ├── accessibility-comparison.png    # WCAG compliance demo
│   ├── sample-video-thumbnail.jpg      # Sample video preview
│   ├── sample-image-thumbnail.jpg      # Sample image preview
│   ├── output-text-sample.png          # Text output example
│   ├── output-audio-waveform.png       # Audio waveform visual
│   └── batch-results-grid.png          # Batch processing results
│
├── icons/                      # UI Icons (60x60 SVG)
│   ├── video-processing.svg            # Video feature icon
│   ├── image-analysis.svg              # Image feature icon
│   ├── batch-processing.svg            # Batch feature icon
│   ├── audio-synthesis.svg             # Audio feature icon
│   ├── wcag-compliant.svg              # Accessibility icon
│   ├── api-integration.svg             # API feature icon
│   ├── aws-powered.svg                 # AWS services icon
│   ├── real-time.svg                   # Real-time processing
│   ├── multi-language.svg              # Language support
│   └── secure.svg                      # Security icon
│
├── demos/                      # Animated Demos (GIF)
│   ├── upload-process.gif              # Upload workflow animation
│   ├── processing-animation.gif        # Processing pipeline animation
│   ├── results-interaction.gif         # Results interaction demo
│   ├── api-testing.gif                 # API testing demo
│   └── mobile-experience.gif           # Mobile UI demo
│
├── badges/                     # Custom Status Badges
│   ├── build-passing.svg                # Build status
│   ├── coverage-95.svg                  # Test coverage
│   ├── version-2.1.0.svg                # Version badge
│   ├── uptime-99.95.svg                 # Uptime status
│   └── license-mit.svg                  # License badge
│
├── mockups/                    # UI Mockups
│   ├── desktop-mockup.png               # Desktop app mockup
│   ├── tablet-mockup.png                # Tablet app mockup
│   ├── mobile-mockup.png                # Mobile app mockup
│   └── multi-device.png                 # All devices together
│
└── charts/                     # Data Visualizations
    ├── performance-metrics.png         # Performance charts
    ├── usage-statistics.png            # Usage stats
    ├── feature-comparison.png          # Feature comparison chart
    ├── pricing-tiers.png               # Pricing visualization
    └── growth-chart.png                # Growth metrics
```

---

## 📝 Image Specifications

### Logo and Branding
```yaml
logo.svg:
  dimensions: 512x512
  format: SVG
  colors: 
    - primary: "#667eea"
    - secondary: "#764ba2"
  variants:
    - logo-dark.svg (for dark mode)
    - logo-light.svg (for light mode)
    - logo-mono.svg (monochrome)

hero-banner.png:
  dimensions: 1920x600
  format: PNG
  compression: Optimized (<200KB)
  content:
    - Gradient background
    - Product name
    - Tagline
    - Key statistics

social-card.png:
  dimensions: 1200x630
  format: PNG
  purpose: Open Graph / Twitter Card
  text-safe-area: 1080x510 (centered)
```

### Screenshots Requirements
```yaml
Desktop Screenshots:
  dimensions: 1920x1080
  format: PNG
  browser: Chrome latest
  device-pixel-ratio: 2x
  
Tablet Screenshots:
  dimensions: 768x1024
  format: PNG
  device: iPad Pro
  orientation: Portrait
  
Mobile Screenshots:
  dimensions: 375x812
  format: PNG
  device: iPhone 13
  orientation: Portrait

Common Settings:
  - Clean browser (no extensions visible)
  - Consistent test data
  - Professional content
  - No personal information
  - Optimal lighting/contrast
```

### Diagram Standards
```yaml
Technical Diagrams:
  format: SVG
  style: Flat design
  colors:
    - primary: "#667eea"
    - secondary: "#764ba2"
    - success: "#49cc90"
    - warning: "#fca130"
    - danger: "#f93e3e"
    - neutral: "#718096"
  fonts:
    - primary: "Inter, sans-serif"
    - code: "Fira Code, monospace"
  line-width: 2px
  corner-radius: 8px
```

### Icon Guidelines
```yaml
Feature Icons:
  dimensions: 60x60
  format: SVG
  style: Outlined
  stroke-width: 2px
  padding: 10px
  background: Transparent
  
Color Scheme:
  - Default: "#718096"
  - Hover: "#667eea"
  - Active: "#764ba2"
```

---

## 🎬 Demo GIF Creation

### Recording Settings
```yaml
Animated Demos:
  format: GIF
  fps: 15
  dimensions: 800x600
  duration: 10-30 seconds
  optimization: 
    - Lossy compression
    - Max 5MB file size
    - Loop: Infinite
  
Tools:
  - Recording: OBS Studio / QuickTime
  - Conversion: FFmpeg / Gifski
  - Optimization: Gifsicle / ImageOptim
```

### Demo Scripts
```yaml
upload-process.gif:
  1. Show empty upload interface
  2. Drag video file to drop zone
  3. Show file preview and options
  4. Configure processing settings
  5. Click "Generate Description"
  6. Transition to processing view

processing-animation.gif:
  1. Show processing dashboard at 0%
  2. Animate progress through stages
  3. Show performance metrics updating
  4. Complete at 100%
  5. Transition to results

results-interaction.gif:
  1. Display completed results
  2. Play audio preview
  3. Show text descriptions
  4. Download different formats
  5. Return to upload
```

---

## 🎨 Image Optimization

### Compression Guidelines
```yaml
PNG Images:
  tool: ImageOptim / TinyPNG
  compression: Lossy (90% quality)
  max-size: 200KB for screenshots
  
SVG Files:
  tool: SVGO
  optimization:
    - Remove metadata
    - Minify paths
    - Remove empty groups
    - Merge paths
  
GIF Files:
  tool: Gifsicle
  colors: 256
  optimization: Level 3
  max-size: 5MB
```

### Responsive Images
```html
<!-- Picture element for responsive images -->
<picture>
  <source 
    media="(max-width: 768px)" 
    srcset="./docs/images/screenshots/mobile-ui.png">
  <source 
    media="(max-width: 1024px)" 
    srcset="./docs/images/screenshots/tablet-ui.png">
  <img 
    src="./docs/images/screenshots/desktop-ui.png" 
    alt="Voice Description API Interface"
    loading="lazy">
</picture>
```

---

## 📝 Alt Text Templates

### Screenshot Alt Text
```yaml
Homepage:
  alt: "Voice Description API homepage showing hero section with statistics displaying 285M+ users, 98% accuracy, and under 2-minute processing time"

Upload Interface:
  alt: "File upload interface with drag-and-drop zone, processing options including language selection, detail level, and voice settings"

Processing Dashboard:
  alt: "Real-time processing dashboard showing 65% completion with active AI analysis stage and performance metrics"

Results Display:
  alt: "Results page displaying generated text descriptions with audio player controls and multiple download format options"
```

### Diagram Alt Text
```yaml
Processing Pipeline:
  alt: "Flow diagram showing 6-step processing pipeline: Upload, Scene Detection, AI Analysis, Description Generation, Audio Synthesis, and Delivery"

Architecture:
  alt: "System architecture diagram showing frontend Next.js application connected to Node.js backend integrated with AWS services including S3, Rekognition, Bedrock, and Polly"
```

---

## 📦 Asset Delivery

### CDN Configuration
```yaml
CloudFront Distribution:
  origin: s3://voicedesc-assets
  behaviors:
    - path: /images/*
      cache: 86400 (1 day)
      compress: true
    - path: /icons/*
      cache: 604800 (7 days)
      compress: true
    - path: /demos/*
      cache: 3600 (1 hour)
      compress: false
```

### Lazy Loading
```javascript
// Implement lazy loading for images
const images = document.querySelectorAll('img[data-src]');
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.add('loaded');
      observer.unobserve(img);
    }
  });
});

images.forEach(img => imageObserver.observe(img));
```

---

## ✅ Quality Checklist

### Pre-Upload Checklist
- [ ] All images optimized for web
- [ ] Consistent naming convention
- [ ] Alt text for all images
- [ ] No personal/sensitive data
- [ ] Proper dimensions and format
- [ ] Dark mode variants where needed
- [ ] Mobile-optimized versions
- [ ] Retina/2x versions available
- [ ] File sizes within limits
- [ ] Copyright/licensing cleared

### Testing Checklist
- [ ] Images load correctly on all devices
- [ ] Responsive images switch properly
- [ ] Alt text displays when images fail
- [ ] Lazy loading works correctly
- [ ] CDN delivery is functional
- [ ] No broken image links
- [ ] Acceptable load times (<3s)
- [ ] Proper caching headers

---

## 📈 Performance Targets

```yaml
Metrics:
  total-page-weight: <2MB
  largest-image: <200KB
  first-contentful-paint: <1.5s
  cumulative-layout-shift: <0.1
  time-to-interactive: <3s
  
Optimization:
  - Use WebP for modern browsers
  - Implement progressive JPEGs
  - Enable Brotli compression
  - Use responsive images
  - Implement lazy loading
  - Optimize critical path
```

---

## 🔄 Update Process

### Version Control
```bash
# Naming convention for updates
v2.1.0/screenshot-name.png
v2.2.0/screenshot-name.png

# Archive old versions
/docs/images/archive/v2.0.0/
```

### Documentation Updates
1. Update screenshots for new features
2. Regenerate diagrams if architecture changes
3. Update alt text descriptions
4. Test all image links
5. Update CDN cache
6. Verify responsive variants

---

This comprehensive folder structure ensures all visual assets are properly organized, optimized, and accessible for the Voice Description API documentation.