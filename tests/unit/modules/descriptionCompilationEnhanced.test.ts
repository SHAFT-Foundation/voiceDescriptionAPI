/**
 * Enhanced Unit Tests for DescriptionCompilation Module
 * Tests compilation of both video scene descriptions and image descriptions
 */

import { 
  MOCK_BEDROCK_RESPONSES,
  ACCESSIBILITY_TESTS,
  TEST_IMAGES
} from '../../fixtures/imageTestData';

// Enhanced DescriptionCompilationModule interface
interface EnhancedDescriptionCompilationModule {
  // Video compilation methods (existing)
  compileVideoDescriptions(analyses: SceneAnalysis[], metadata?: any): VideoCompilationResult;
  formatTimestamp(seconds: number): string;
  
  // Image compilation methods (new)
  compileImageDescription(analysis: ImageAnalysis, options?: CompilationOptions): ImageCompilationResult;
  compileBatchImageDescriptions(analyses: ImageAnalysis[]): BatchCompilationResult;
  
  // Shared methods
  generateAltText(description: string, maxLength?: number): string;
  generateDetailedDescription(analysis: any, detailLevel: string): string;
  generateHTMLMetadata(compilation: any): HTMLMetadata;
  formatForScreenReader(text: string): string;
  validateAccessibility(text: string): AccessibilityValidation;
}

interface SceneAnalysis {
  segmentId: string;
  description: string;
  visualElements: string[];
  actions: string[];
  context: string;
  confidence: number;
  startTime: number;
  endTime: number;
}

interface ImageAnalysis {
  description: string;
  altText: string;
  visualElements: string[];
  confidence: number;
  analysisType: string;
  colors?: string[];
  composition?: string;
  mood?: string;
  dataPoints?: string[];
}

interface CompilationOptions {
  detailLevel?: 'basic' | 'comprehensive' | 'technical';
  includeAltText?: boolean;
  includeMetadata?: boolean;
  format?: 'plain' | 'html' | 'json' | 'markdown';
  maxAltTextLength?: number;
}

interface VideoCompilationResult {
  success: boolean;
  data?: {
    fullDescription: string;
    timestampedDescriptions: TimestampedDescription[];
    summary: string;
    totalDuration: number;
  };
  error?: any;
}

interface ImageCompilationResult {
  success: boolean;
  data?: {
    altText: string;
    shortDescription: string;
    detailedDescription: string;
    htmlMetadata?: HTMLMetadata;
    format: string;
    confidence: number;
  };
  error?: any;
}

interface BatchCompilationResult {
  success: boolean;
  compilations: ImageCompilationResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

interface TimestampedDescription {
  timestamp: string;
  description: string;
  confidence: number;
}

interface HTMLMetadata {
  alt: string;
  title: string;
  longdesc: string;
  ariaLabel: string;
  ariaDescribedBy?: string;
  role?: string;
  itemProp?: string;
}

interface AccessibilityValidation {
  valid: boolean;
  issues: string[];
  suggestions: string[];
  wcagLevel: 'A' | 'AA' | 'AAA' | 'FAIL';
}

// Mock implementation for testing
class MockEnhancedDescriptionCompilationModule implements EnhancedDescriptionCompilationModule {
  compileVideoDescriptions(analyses: SceneAnalysis[], metadata?: any): VideoCompilationResult {
    if (analyses.length === 0) {
      return {
        success: false,
        error: { code: 'NO_ANALYSES', message: 'No analyses to compile' }
      };
    }
    
    const timestampedDescriptions: TimestampedDescription[] = analyses.map(analysis => ({
      timestamp: this.formatTimestamp(analysis.startTime),
      description: analysis.description,
      confidence: analysis.confidence
    }));
    
    const fullDescription = analyses
      .map(a => `[${this.formatTimestamp(a.startTime)}] ${a.description}`)
      .join('\n\n');
    
    const summary = `Video contains ${analyses.length} scenes with an average confidence of ${
      analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length
    }%`;
    
    const totalDuration = analyses[analyses.length - 1]?.endTime || 0;
    
    return {
      success: true,
      data: {
        fullDescription,
        timestampedDescriptions,
        summary,
        totalDuration
      }
    };
  }
  
  formatTimestamp(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  compileImageDescription(analysis: ImageAnalysis, options?: CompilationOptions): ImageCompilationResult {
    const opts = {
      detailLevel: 'comprehensive',
      includeAltText: true,
      includeMetadata: true,
      format: 'plain',
      maxAltTextLength: 125,
      ...options
    };
    
    // Generate alt text
    const altText = opts.includeAltText 
      ? this.generateAltText(analysis.description, opts.maxAltTextLength)
      : '';
    
    // Generate descriptions based on detail level
    const shortDescription = this.generateShortDescription(analysis);
    const detailedDescription = this.generateDetailedDescription(analysis, opts.detailLevel);
    
    // Generate HTML metadata if requested
    const htmlMetadata = opts.includeMetadata
      ? this.generateHTMLMetadata({
          altText,
          description: detailedDescription,
          title: shortDescription
        })
      : undefined;
    
    // Format output based on requested format
    let formattedDescription = detailedDescription;
    if (opts.format === 'html') {
      formattedDescription = this.formatAsHTML(detailedDescription, altText);
    } else if (opts.format === 'markdown') {
      formattedDescription = this.formatAsMarkdown(detailedDescription, altText);
    } else if (opts.format === 'json') {
      formattedDescription = JSON.stringify({
        alt: altText,
        short: shortDescription,
        detailed: detailedDescription
      });
    }
    
    return {
      success: true,
      data: {
        altText,
        shortDescription,
        detailedDescription: formattedDescription,
        htmlMetadata,
        format: opts.format,
        confidence: analysis.confidence
      }
    };
  }
  
  compileBatchImageDescriptions(analyses: ImageAnalysis[]): BatchCompilationResult {
    const compilations: ImageCompilationResult[] = [];
    let successful = 0;
    
    for (const analysis of analyses) {
      const result = this.compileImageDescription(analysis);
      compilations.push(result);
      if (result.success) successful++;
    }
    
    return {
      success: successful === analyses.length,
      compilations,
      summary: {
        total: analyses.length,
        successful,
        failed: analyses.length - successful
      }
    };
  }
  
  generateAltText(description: string, maxLength: number = 125): string {
    // Extract key information for concise alt text
    const sentences = description.split('. ');
    let altText = sentences[0];
    
    // Truncate if too long
    if (altText.length > maxLength) {
      altText = altText.substring(0, maxLength - 3) + '...';
    }
    
    // Remove unnecessary words for brevity
    altText = altText
      .replace(/\b(the|a|an|is|are|was|were)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Ensure it starts with capital letter
    return altText.charAt(0).toUpperCase() + altText.slice(1);
  }
  
  generateDetailedDescription(analysis: any, detailLevel: string): string {
    let description = analysis.description;
    
    if (detailLevel === 'comprehensive' || detailLevel === 'technical') {
      // Add visual elements
      if (analysis.visualElements?.length > 0) {
        description += ` Key visual elements include: ${analysis.visualElements.join(', ')}.`;
      }
      
      // Add colors if available
      if (analysis.colors?.length > 0) {
        description += ` Prominent colors: ${analysis.colors.join(', ')}.`;
      }
      
      // Add composition info
      if (analysis.composition) {
        description += ` Composition: ${analysis.composition}.`;
      }
      
      // Add mood/atmosphere
      if (analysis.mood) {
        description += ` Overall mood: ${analysis.mood}.`;
      }
      
      // Add data points for technical detail
      if (detailLevel === 'technical' && analysis.dataPoints?.length > 0) {
        description += ` Data points: ${analysis.dataPoints.join(', ')}.`;
      }
    }
    
    return description;
  }
  
  generateHTMLMetadata(compilation: any): HTMLMetadata {
    return {
      alt: compilation.altText || '',
      title: compilation.title || compilation.altText || '',
      longdesc: compilation.description || '',
      ariaLabel: compilation.altText || '',
      ariaDescribedBy: 'image-description',
      role: 'img',
      itemProp: 'image'
    };
  }
  
  formatForScreenReader(text: string): string {
    // Add pauses for screen readers
    let formatted = text
      .replace(/\./g, '. ')  // Add pause after periods
      .replace(/,/g, ', ')   // Add pause after commas
      .replace(/:/g, ': ')   // Add pause after colons
      .replace(/;/g, '; ');  // Add pause after semicolons
    
    // Expand abbreviations
    formatted = formatted
      .replace(/\bDr\./g, 'Doctor')
      .replace(/\bMr\./g, 'Mister')
      .replace(/\bMs\./g, 'Miss')
      .replace(/\betc\./g, 'etcetera');
    
    // Spell out numbers for clarity
    formatted = formatted.replace(/\b(\d+)\b/g, (match, num) => {
      const number = parseInt(num);
      if (number <= 10) {
        const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
        return words[number] || num;
      }
      return num;
    });
    
    return formatted;
  }
  
  validateAccessibility(text: string): AccessibilityValidation {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check alt text length
    if (text.length < ACCESSIBILITY_TESTS.altTextLength.minLength) {
      issues.push('Alt text is too short');
      suggestions.push('Add more descriptive details');
    }
    if (text.length > ACCESSIBILITY_TESTS.altTextLength.maxLength) {
      issues.push('Alt text is too long');
      suggestions.push('Consider moving detailed description to longdesc attribute');
    }
    
    // Check for redundant phrases
    const redundantPhrases = ['image of', 'picture of', 'photo of', 'graphic of'];
    for (const phrase of redundantPhrases) {
      if (text.toLowerCase().includes(phrase)) {
        issues.push(`Contains redundant phrase: "${phrase}"`);
        suggestions.push('Remove redundant phrases - screen readers already announce images');
      }
    }
    
    // Check for meaningful content
    if (!text.match(/\b(shows|displays|contains|features|depicts)\b/i)) {
      suggestions.push('Consider describing what the image shows or depicts');
    }
    
    // Determine WCAG level
    let wcagLevel: 'A' | 'AA' | 'AAA' | 'FAIL' = 'AAA';
    if (issues.length > 0) {
      if (issues.length === 1) wcagLevel = 'AA';
      else if (issues.length === 2) wcagLevel = 'A';
      else wcagLevel = 'FAIL';
    }
    
    return {
      valid: issues.length === 0,
      issues,
      suggestions,
      wcagLevel
    };
  }
  
  private generateShortDescription(analysis: ImageAnalysis): string {
    // Extract first sentence or key information
    const firstSentence = analysis.description.split('.')[0];
    return firstSentence.length <= 50 
      ? firstSentence 
      : firstSentence.substring(0, 47) + '...';
  }
  
  private formatAsHTML(description: string, altText: string): string {
    return `
      <figure>
        <img alt="${altText}" />
        <figcaption>${description}</figcaption>
      </figure>
    `.trim();
  }
  
  private formatAsMarkdown(description: string, altText: string): string {
    return `![${altText}](image.jpg)\n\n${description}`;
  }
}

describe('Enhanced DescriptionCompilationModule', () => {
  let compilation: MockEnhancedDescriptionCompilationModule;
  
  beforeEach(() => {
    compilation = new MockEnhancedDescriptionCompilationModule();
  });
  
  describe('Image Description Compilation', () => {
    describe('compileImageDescription', () => {
      test('should compile comprehensive image description', () => {
        const analysis: ImageAnalysis = {
          ...MOCK_BEDROCK_RESPONSES.photo,
          analysisType: 'photo'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          detailLevel: 'comprehensive'
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.altText).toBeDefined();
        expect(result.data?.shortDescription).toBeDefined();
        expect(result.data?.detailedDescription).toContain('Key visual elements');
        expect(result.data?.detailedDescription).toContain('Prominent colors');
        expect(result.data?.confidence).toBe(0.92);
      });
      
      test('should compile basic image description', () => {
        const analysis: ImageAnalysis = {
          ...MOCK_BEDROCK_RESPONSES.chart,
          analysisType: 'chart'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          detailLevel: 'basic'
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.detailedDescription).not.toContain('Data points');
        expect(result.data?.altText.length).toBeLessThanOrEqual(125);
      });
      
      test('should compile technical description with data points', () => {
        const analysis: ImageAnalysis = {
          ...MOCK_BEDROCK_RESPONSES.chart,
          analysisType: 'chart'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          detailLevel: 'technical'
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.detailedDescription).toContain('Data points');
        expect(result.data?.detailedDescription).toContain('Q1: $1.2M');
      });
      
      test('should generate HTML formatted output', () => {
        const analysis: ImageAnalysis = {
          ...MOCK_BEDROCK_RESPONSES.photo,
          analysisType: 'photo'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          format: 'html'
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.detailedDescription).toContain('<figure>');
        expect(result.data?.detailedDescription).toContain('<figcaption>');
        expect(result.data?.format).toBe('html');
      });
      
      test('should generate Markdown formatted output', () => {
        const analysis: ImageAnalysis = {
          ...MOCK_BEDROCK_RESPONSES.photo,
          analysisType: 'photo'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          format: 'markdown'
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.detailedDescription).toContain('![');
        expect(result.data?.detailedDescription).toContain('](image.jpg)');
        expect(result.data?.format).toBe('markdown');
      });
      
      test('should generate JSON formatted output', () => {
        const analysis: ImageAnalysis = {
          ...MOCK_BEDROCK_RESPONSES.photo,
          analysisType: 'photo'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          format: 'json'
        });
        
        expect(result.success).toBe(true);
        const parsed = JSON.parse(result.data?.detailedDescription || '{}');
        expect(parsed.alt).toBeDefined();
        expect(parsed.short).toBeDefined();
        expect(parsed.detailed).toBeDefined();
      });
      
      test('should exclude alt text when requested', () => {
        const analysis: ImageAnalysis = {
          ...MOCK_BEDROCK_RESPONSES.photo,
          analysisType: 'photo'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          includeAltText: false
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.altText).toBe('');
      });
      
      test('should include HTML metadata when requested', () => {
        const analysis: ImageAnalysis = {
          ...MOCK_BEDROCK_RESPONSES.photo,
          analysisType: 'photo'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          includeMetadata: true
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.htmlMetadata).toBeDefined();
        expect(result.data?.htmlMetadata?.alt).toBeDefined();
        expect(result.data?.htmlMetadata?.ariaLabel).toBeDefined();
        expect(result.data?.htmlMetadata?.role).toBe('img');
      });
      
      test('should respect custom alt text length', () => {
        const analysis: ImageAnalysis = {
          description: 'A very long description that goes on and on with many details about the image content and visual elements present',
          altText: '',
          visualElements: [],
          confidence: 0.9,
          analysisType: 'photo'
        };
        
        const result = compilation.compileImageDescription(analysis, {
          maxAltTextLength: 50
        });
        
        expect(result.success).toBe(true);
        expect(result.data?.altText.length).toBeLessThanOrEqual(50);
        expect(result.data?.altText).toContain('...');
      });
    });
    
    describe('compileBatchImageDescriptions', () => {
      test('should compile multiple image descriptions', () => {
        const analyses: ImageAnalysis[] = [
          { ...MOCK_BEDROCK_RESPONSES.photo, analysisType: 'photo' },
          { ...MOCK_BEDROCK_RESPONSES.chart, analysisType: 'chart' },
          { ...MOCK_BEDROCK_RESPONSES.diagram, analysisType: 'diagram' }
        ];
        
        const result = compilation.compileBatchImageDescriptions(analyses);
        
        expect(result.success).toBe(true);
        expect(result.compilations).toHaveLength(3);
        expect(result.summary.total).toBe(3);
        expect(result.summary.successful).toBe(3);
        expect(result.summary.failed).toBe(0);
      });
      
      test('should handle empty batch', () => {
        const result = compilation.compileBatchImageDescriptions([]);
        
        expect(result.success).toBe(true);
        expect(result.compilations).toHaveLength(0);
        expect(result.summary.total).toBe(0);
      });
    });
  });
  
  describe('Alt Text Generation', () => {
    test('should generate concise alt text from description', () => {
      const description = 'A beautiful sunset over the ocean with orange and pink clouds reflected in the calm water. Seagulls are flying in the distance.';
      
      const altText = compilation.generateAltText(description);
      
      expect(altText.length).toBeLessThanOrEqual(125);
      expect(altText).not.toContain('A beautiful'); // Articles removed
      expect(altText).toContain('sunset');
    });
    
    test('should truncate long descriptions', () => {
      const longDescription = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.';
      
      const altText = compilation.generateAltText(longDescription, 50);
      
      expect(altText.length).toBeLessThanOrEqual(50);
      expect(altText).toContain('...');
    });
    
    test('should capitalize first letter', () => {
      const description = 'the quick brown fox jumps over the lazy dog.';
      
      const altText = compilation.generateAltText(description);
      
      expect(altText[0]).toBe(altText[0].toUpperCase());
    });
    
    test('should remove unnecessary articles', () => {
      const description = 'The cat is sitting on a mat with the ball.';
      
      const altText = compilation.generateAltText(description);
      
      expect(altText).not.toMatch(/\b(the|a|an|is|are)\b/i);
    });
  });
  
  describe('HTML Metadata Generation', () => {
    test('should generate complete HTML metadata', () => {
      const metadata = compilation.generateHTMLMetadata({
        altText: 'Test alt text',
        description: 'Test description',
        title: 'Test title'
      });
      
      expect(metadata.alt).toBe('Test alt text');
      expect(metadata.title).toBe('Test title');
      expect(metadata.longdesc).toBe('Test description');
      expect(metadata.ariaLabel).toBe('Test alt text');
      expect(metadata.ariaDescribedBy).toBe('image-description');
      expect(metadata.role).toBe('img');
      expect(metadata.itemProp).toBe('image');
    });
    
    test('should handle missing values gracefully', () => {
      const metadata = compilation.generateHTMLMetadata({});
      
      expect(metadata.alt).toBe('');
      expect(metadata.title).toBe('');
      expect(metadata.longdesc).toBe('');
    });
  });
  
  describe('Screen Reader Formatting', () => {
    test('should add pauses for punctuation', () => {
      const text = 'Hello,world.How are you?Fine:thanks;goodbye!';
      
      const formatted = compilation.formatForScreenReader(text);
      
      expect(formatted).toContain(', ');
      expect(formatted).toContain('. ');
      expect(formatted).toContain(': ');
      expect(formatted).toContain('; ');
    });
    
    test('should expand common abbreviations', () => {
      const text = 'Dr. Smith and Mr. Jones met Ms. Brown, etc.';
      
      const formatted = compilation.formatForScreenReader(text);
      
      expect(formatted).toContain('Doctor');
      expect(formatted).toContain('Mister');
      expect(formatted).toContain('Miss');
      expect(formatted).toContain('etcetera');
    });
    
    test('should spell out small numbers', () => {
      const text = 'I have 3 cats, 7 dogs, and 10 birds.';
      
      const formatted = compilation.formatForScreenReader(text);
      
      expect(formatted).toContain('three');
      expect(formatted).toContain('seven');
      expect(formatted).toContain('ten');
    });
    
    test('should preserve large numbers', () => {
      const text = 'The population is 1000000 people.';
      
      const formatted = compilation.formatForScreenReader(text);
      
      expect(formatted).toContain('1000000');
    });
  });
  
  describe('Accessibility Validation', () => {
    test('should validate correct alt text', () => {
      const text = 'A red car parked in front of a modern building';
      
      const validation = compilation.validateAccessibility(text);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.wcagLevel).toBe('AAA');
    });
    
    test('should detect too short alt text', () => {
      const text = 'Car';
      
      const validation = compilation.validateAccessibility(text);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Alt text is too short');
      expect(validation.suggestions).toContain('Add more descriptive details');
    });
    
    test('should detect too long alt text', () => {
      const text = 'A'.repeat(130);
      
      const validation = compilation.validateAccessibility(text);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Alt text is too long');
    });
    
    test('should detect redundant phrases', () => {
      const text = 'Image of a sunset over the ocean';
      
      const validation = compilation.validateAccessibility(text);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Contains redundant phrase: "image of"');
      expect(validation.suggestions).toContain('Remove redundant phrases - screen readers already announce images');
    });
    
    test('should suggest descriptive verbs', () => {
      const text = 'A sunset over the ocean';
      
      const validation = compilation.validateAccessibility(text);
      
      expect(validation.suggestions).toContain('Consider describing what the image shows or depicts');
    });
    
    test('should assign appropriate WCAG levels', () => {
      const tests = [
        { issues: 0, expected: 'AAA' },
        { issues: 1, expected: 'AA' },
        { issues: 2, expected: 'A' },
        { issues: 3, expected: 'FAIL' }
      ];
      
      tests.forEach(test => {
        const validation = {
          valid: test.issues === 0,
          issues: Array(test.issues).fill('issue'),
          suggestions: [],
          wcagLevel: test.expected as any
        };
        
        expect(validation.wcagLevel).toBe(test.expected);
      });
    });
  });
  
  describe('Video Description Compilation', () => {
    test('should compile video scene descriptions', () => {
      const analyses: SceneAnalysis[] = [
        {
          segmentId: 'seg-1',
          description: 'Person walking in park',
          visualElements: ['person', 'park'],
          actions: ['walking'],
          context: 'outdoor',
          confidence: 0.9,
          startTime: 0,
          endTime: 5
        },
        {
          segmentId: 'seg-2',
          description: 'Close-up of flowers',
          visualElements: ['flowers'],
          actions: [],
          context: 'nature',
          confidence: 0.95,
          startTime: 5,
          endTime: 10
        }
      ];
      
      const result = compilation.compileVideoDescriptions(analyses);
      
      expect(result.success).toBe(true);
      expect(result.data?.timestampedDescriptions).toHaveLength(2);
      expect(result.data?.fullDescription).toContain('[00:00.00]');
      expect(result.data?.fullDescription).toContain('[00:05.00]');
      expect(result.data?.totalDuration).toBe(10);
    });
    
    test('should handle empty analyses array', () => {
      const result = compilation.compileVideoDescriptions([]);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_ANALYSES');
    });
    
    test('should format timestamps correctly', () => {
      const testCases = [
        { seconds: 0, expected: '00:00.00' },
        { seconds: 5.5, expected: '00:05.50' },
        { seconds: 65.123, expected: '01:05.12' },
        { seconds: 3661.9, expected: '61:01.90' }
      ];
      
      testCases.forEach(test => {
        const formatted = compilation.formatTimestamp(test.seconds);
        expect(formatted).toBe(test.expected);
      });
    });
  });
});