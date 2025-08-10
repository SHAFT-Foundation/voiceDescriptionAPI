/**
 * Test Data Fixtures for Image Processing
 * Provides diverse test data for comprehensive testing coverage
 */

import { Buffer } from 'buffer';

// Mock image file signatures for different formats
export const IMAGE_SIGNATURES = {
  jpeg: Buffer.from([0xFF, 0xD8, 0xFF]),
  png: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  gif: Buffer.from([0x47, 0x49, 0x46, 0x38]),
  webp: Buffer.from([0x52, 0x49, 0x46, 0x46]),
  bmp: Buffer.from([0x42, 0x4D])
};

// Test image metadata samples
export const TEST_IMAGES = {
  photo: {
    filename: 'landscape-photo.jpg',
    contentType: 'image/jpeg',
    size: 2048576, // 2MB
    dimensions: { width: 1920, height: 1080 },
    description: 'A scenic landscape photograph',
    category: 'photography'
  },
  chart: {
    filename: 'sales-chart.png',
    contentType: 'image/png',
    size: 512000, // 500KB
    dimensions: { width: 1200, height: 800 },
    description: 'Bar chart showing quarterly sales data',
    category: 'data-visualization'
  },
  diagram: {
    filename: 'system-architecture.png',
    contentType: 'image/png',
    size: 768000, // 750KB
    dimensions: { width: 1600, height: 1200 },
    description: 'Technical system architecture diagram',
    category: 'technical-diagram'
  },
  screenshot: {
    filename: 'app-screenshot.png',
    contentType: 'image/png',
    size: 1024000, // 1MB
    dimensions: { width: 1440, height: 900 },
    description: 'Application user interface screenshot',
    category: 'ui-screenshot'
  },
  artwork: {
    filename: 'digital-art.webp',
    contentType: 'image/webp',
    size: 1536000, // 1.5MB
    dimensions: { width: 2048, height: 2048 },
    description: 'Abstract digital artwork',
    category: 'artwork'
  },
  infographic: {
    filename: 'climate-infographic.jpg',
    contentType: 'image/jpeg',
    size: 3072000, // 3MB
    dimensions: { width: 1080, height: 1920 },
    description: 'Climate change infographic with data points',
    category: 'infographic'
  }
};

// Generate mock image buffer with correct file signature
export function generateMockImageBuffer(format: keyof typeof IMAGE_SIGNATURES, size: number = 1024): Buffer {
  const signature = IMAGE_SIGNATURES[format];
  const buffer = Buffer.alloc(size);
  
  // Copy file signature to beginning of buffer
  signature.copy(buffer, 0);
  
  // Fill rest with random data
  for (let i = signature.length; i < size; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  
  return buffer;
}

// Mock Bedrock Nova Pro responses for different image types
export const MOCK_BEDROCK_RESPONSES = {
  photo: {
    description: "A breathtaking landscape photograph featuring rolling hills covered in vibrant green grass. The scene captures a golden sunset with warm orange and pink hues painting the sky. In the foreground, wildflowers add splashes of purple and yellow color. The composition follows the rule of thirds with mountains visible in the distance.",
    altText: "Scenic landscape with green hills, wildflowers, and sunset sky",
    confidence: 0.92,
    visualElements: ["hills", "grass", "sunset", "wildflowers", "mountains", "sky"],
    colors: ["green", "orange", "pink", "purple", "yellow", "blue"],
    composition: "rule of thirds",
    mood: "peaceful, serene"
  },
  chart: {
    description: "A bar chart displaying quarterly sales data for the fiscal year 2024. The chart shows four vertical bars representing Q1 through Q4, with values ranging from $1.2M to $2.8M. Q3 shows the highest performance at $2.8M, while Q1 shows the lowest at $1.2M. The chart uses a blue color scheme with gridlines for easy reading.",
    altText: "Bar chart showing quarterly sales: Q1 $1.2M, Q2 $1.8M, Q3 $2.8M, Q4 $2.3M",
    confidence: 0.95,
    visualElements: ["bar chart", "axes", "gridlines", "data labels", "title", "legend"],
    dataPoints: ["Q1: $1.2M", "Q2: $1.8M", "Q3: $2.8M", "Q4: $2.3M"],
    chartType: "vertical bar chart"
  },
  diagram: {
    description: "A technical system architecture diagram illustrating a microservices-based application. The diagram shows multiple service containers including API Gateway, Authentication Service, User Service, and Database layers. Arrows indicate data flow between components. Load balancer at the top distributes traffic. Uses standard UML notation.",
    altText: "System architecture diagram with microservices, API gateway, and database layers",
    confidence: 0.88,
    visualElements: ["boxes", "arrows", "labels", "containers", "database symbols"],
    components: ["API Gateway", "Auth Service", "User Service", "Database", "Load Balancer"],
    diagramType: "architecture diagram"
  },
  screenshot: {
    description: "A screenshot of a modern web application dashboard. The interface features a dark sidebar navigation on the left with menu items. The main content area displays analytics widgets including line graphs, pie charts, and metric cards showing KPIs. The header contains a search bar and user profile dropdown. The design uses a clean, minimalist style with a blue and gray color scheme.",
    altText: "Dashboard screenshot with navigation sidebar, analytics widgets, and metric cards",
    confidence: 0.90,
    visualElements: ["sidebar", "navigation", "graphs", "charts", "cards", "header", "search bar"],
    uiComponents: ["navigation menu", "analytics widgets", "metric cards", "user profile"],
    layoutType: "dashboard layout"
  },
  artwork: {
    description: "An abstract digital artwork featuring dynamic geometric shapes and flowing gradients. The composition uses bold contrasts between warm oranges and cool blues. Overlapping triangular forms create depth and movement. The piece has a modern, contemporary style with elements of constructivism. Digital brush strokes add texture throughout.",
    altText: "Abstract digital art with geometric shapes in orange and blue gradients",
    confidence: 0.85,
    visualElements: ["geometric shapes", "gradients", "triangles", "overlapping forms"],
    artisticStyle: "abstract, contemporary, constructivist",
    colorPalette: ["orange", "blue", "purple", "white", "gray"]
  },
  infographic: {
    description: "A comprehensive climate change infographic presenting global temperature data from 1880 to 2024. The design features a large central thermometer graphic showing a 1.2°C increase. Surrounding elements include CO2 level charts, melting ice cap illustrations, and renewable energy statistics. Icons represent different environmental impacts. Text callouts provide key statistics and facts.",
    altText: "Climate change infographic showing temperature rise, CO2 levels, and environmental impacts",
    confidence: 0.93,
    visualElements: ["thermometer", "charts", "icons", "text blocks", "illustrations", "statistics"],
    dataHighlights: ["1.2°C temperature increase", "420ppm CO2", "30% ice loss", "40% renewable growth"],
    infographicType: "data visualization"
  }
};

// Edge case test scenarios
export const EDGE_CASES = {
  oversizedImage: {
    filename: 'huge-image.jpg',
    size: 52428800, // 50MB - at the limit
    expectedError: null
  },
  tooLargeImage: {
    filename: 'too-large.jpg',
    size: 52428801, // Just over 50MB
    expectedError: 'FILE_TOO_LARGE'
  },
  corruptedImage: {
    filename: 'corrupted.jpg',
    buffer: Buffer.from([0x00, 0x00, 0x00]), // Invalid signature
    expectedError: 'INVALID_FILE_FORMAT'
  },
  emptyImage: {
    filename: 'empty.jpg',
    buffer: Buffer.alloc(0),
    expectedError: 'EMPTY_FILE'
  },
  unsupportedFormat: {
    filename: 'image.tiff',
    contentType: 'image/tiff',
    expectedError: 'UNSUPPORTED_FORMAT'
  },
  specialCharacters: {
    filename: 'image-with-特殊文字-😀.jpg',
    expectedBehavior: 'should handle unicode and emoji in filenames'
  }
};

// Performance test scenarios
export const PERFORMANCE_SCENARIOS = {
  singleSmallImage: {
    count: 1,
    size: 100000, // 100KB
    expectedTime: 5000 // 5 seconds
  },
  singleLargeImage: {
    count: 1,
    size: 10485760, // 10MB
    expectedTime: 15000 // 15 seconds
  },
  batchSmallImages: {
    count: 10,
    size: 100000, // 100KB each
    expectedTime: 30000, // 30 seconds total
    parallel: true
  },
  batchMixedSizes: {
    images: [
      { size: 100000 }, // 100KB
      { size: 1048576 }, // 1MB
      { size: 5242880 }, // 5MB
      { size: 10485760 } // 10MB
    ],
    expectedTime: 45000, // 45 seconds
    parallel: true
  },
  concurrentLimit: {
    count: 15, // More than 10 limit
    size: 100000,
    maxConcurrent: 10,
    expectedBehavior: 'should queue excess jobs'
  }
};

// Accessibility validation test cases
export const ACCESSIBILITY_TESTS = {
  altTextLength: {
    minLength: 10,
    maxLength: 125,
    requirement: 'Alt text should be concise but descriptive'
  },
  descriptionQuality: {
    minConfidence: 0.85,
    requiredElements: ['subject', 'context', 'key visual elements'],
    requirement: 'Descriptions must identify main subject and context'
  },
  wcagCompliance: {
    level: 'AA',
    requirements: [
      'Provide text alternatives for non-text content',
      'Make content adaptable',
      'Provide sufficient contrast information'
    ]
  },
  screenReaderCompatibility: {
    formats: ['plain text', 'HTML with proper markup', 'structured JSON'],
    requirement: 'Output must be compatible with common screen readers'
  }
};

// Mock S3 responses
export const MOCK_S3_RESPONSES = {
  uploadSuccess: {
    ETag: '"mock-etag-123"',
    Location: 's3://test-input-bucket/images/test-image.jpg',
    VersionId: 'mock-version-123'
  },
  headObjectSuccess: {
    ContentLength: 1048576,
    ContentType: 'image/jpeg',
    LastModified: new Date('2024-01-01T00:00:00Z'),
    Metadata: {
      'original-filename': 'test.jpg'
    }
  },
  notFound: {
    name: 'NoSuchKey',
    message: 'The specified key does not exist',
    code: 'NoSuchKey'
  }
};

// Test utilities
export const TestUtils = {
  // Generate a valid S3 URI
  generateS3Uri: (bucket: string = 'test-bucket', key: string = 'test.jpg'): string => {
    return `s3://${bucket}/${key}`;
  },
  
  // Generate a job ID
  generateJobId: (): string => {
    return 'test-job-' + Math.random().toString(36).substring(7);
  },
  
  // Create a delay for async testing
  delay: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Validate image buffer format
  validateImageBuffer: (buffer: Buffer): boolean => {
    for (const [format, signature] of Object.entries(IMAGE_SIGNATURES)) {
      if (buffer.slice(0, signature.length).equals(signature)) {
        return true;
      }
    }
    return false;
  }
};

export default {
  IMAGE_SIGNATURES,
  TEST_IMAGES,
  generateMockImageBuffer,
  MOCK_BEDROCK_RESPONSES,
  EDGE_CASES,
  PERFORMANCE_SCENARIOS,
  ACCESSIBILITY_TESTS,
  MOCK_S3_RESPONSES,
  TestUtils
};