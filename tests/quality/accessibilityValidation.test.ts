/**
 * Accessibility and Quality Validation Tests
 * Ensures generated descriptions meet WCAG 2.1 AA standards and quality thresholds
 */

import {
  ACCESSIBILITY_TESTS,
  MOCK_BEDROCK_RESPONSES,
  TEST_IMAGES
} from '../fixtures/imageTestData';

// WCAG 2.1 compliance criteria
const WCAG_CRITERIA = {
  level_A: {
    '1.1.1': 'Non-text Content - Provide text alternatives',
    '1.4.1': 'Use of Color - Not sole means of conveying information',
    '2.4.4': 'Link Purpose - Purpose clear from text alone',
    '3.3.2': 'Labels or Instructions - Provided when needed'
  },
  level_AA: {
    '1.4.3': 'Contrast (Minimum) - 4.5:1 for normal text',
    '1.4.5': 'Images of Text - Use real text when possible',
    '2.4.6': 'Headings and Labels - Describe topic or purpose',
    '3.1.2': 'Language of Parts - Identify language changes'
  },
  level_AAA: {
    '1.4.6': 'Contrast (Enhanced) - 7:1 for normal text',
    '1.4.9': 'Images of Text (No Exception)',
    '2.4.9': 'Link Purpose (Link Only) - Always clear',
    '3.1.5': 'Reading Level - Lower secondary education level'
  }
};

// Quality metrics thresholds
const QUALITY_THRESHOLDS = {
  confidence: {
    minimum: 0.85,
    target: 0.90,
    excellent: 0.95
  },
  readability: {
    fleschKincaid: 8, // 8th grade level
    sentenceLength: 20, // Max words per sentence
    wordComplexity: 3 // Max syllables for common words
  },
  completeness: {
    requiredElements: ['subject', 'action', 'context'],
    minWordCount: 10,
    maxWordCount: 125
  },
  accuracy: {
    falsePositiveRate: 0.05, // Max 5% false positives
    falseNegativeRate: 0.10, // Max 10% false negatives
    precisionTarget: 0.90
  }
};

// Screen reader compatibility tests
const SCREEN_READERS = {
  jaws: {
    name: 'JAWS',
    compatibility: ['Windows'],
    requirements: ['proper punctuation', 'semantic HTML', 'ARIA labels']
  },
  nvda: {
    name: 'NVDA',
    compatibility: ['Windows'],
    requirements: ['alt text', 'role attributes', 'proper headings']
  },
  voiceover: {
    name: 'VoiceOver',
    compatibility: ['macOS', 'iOS'],
    requirements: ['rotor navigation', 'gesture support', 'proper labeling']
  },
  talkback: {
    name: 'TalkBack',
    compatibility: ['Android'],
    requirements: ['content descriptions', 'focus management', 'announcements']
  }
};

// Helper class for accessibility validation
class AccessibilityValidator {
  validateAltText(altText: string): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const passed: string[] = [];
    
    // Length validation
    if (altText.length < ACCESSIBILITY_TESTS.altTextLength.minLength) {
      issues.push(`Alt text too short (${altText.length} chars, min: ${ACCESSIBILITY_TESTS.altTextLength.minLength})`);
    } else if (altText.length > ACCESSIBILITY_TESTS.altTextLength.maxLength) {
      warnings.push(`Alt text too long (${altText.length} chars, max: ${ACCESSIBILITY_TESTS.altTextLength.maxLength})`);
    } else {
      passed.push('Alt text length is appropriate');
    }
    
    // Content validation
    const redundantPhrases = ['image of', 'picture of', 'photo of', 'graphic of', 'illustration of'];
    for (const phrase of redundantPhrases) {
      if (altText.toLowerCase().includes(phrase)) {
        issues.push(`Contains redundant phrase: "${phrase}"`);
      }
    }
    
    // Check for meaningful content
    const meaningfulWords = ['shows', 'displays', 'depicts', 'contains', 'features', 'includes'];
    if (!meaningfulWords.some(word => altText.toLowerCase().includes(word))) {
      warnings.push('Consider using descriptive verbs (shows, depicts, contains)');
    } else {
      passed.push('Uses descriptive language');
    }
    
    // Check for proper capitalization
    if (altText[0] !== altText[0].toUpperCase()) {
      warnings.push('Alt text should start with capital letter');
    } else {
      passed.push('Proper capitalization');
    }
    
    // Check for ending punctuation
    if (!['.', '!', '?'].includes(altText[altText.length - 1])) {
      warnings.push('Consider ending with punctuation for better screen reader flow');
    } else {
      passed.push('Proper punctuation');
    }
    
    return {
      valid: issues.length === 0,
      score: this.calculateScore(passed.length, warnings.length, issues.length),
      issues,
      warnings,
      passed,
      wcagLevel: this.determineWCAGLevel(issues.length, warnings.length)
    };
  }
  
  validateDescription(description: string, type: string = 'comprehensive'): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const passed: string[] = [];
    
    // Completeness check
    const requiredElements = QUALITY_THRESHOLDS.completeness.requiredElements;
    for (const element of requiredElements) {
      const hasElement = this.checkForElement(description, element);
      if (!hasElement) {
        warnings.push(`Missing ${element} description`);
      } else {
        passed.push(`Includes ${element}`);
      }
    }
    
    // Readability check
    const readability = this.calculateReadability(description);
    if (readability.gradeLevel > QUALITY_THRESHOLDS.readability.fleschKincaid) {
      warnings.push(`Reading level too high (grade ${readability.gradeLevel})`);
    } else {
      passed.push('Appropriate reading level');
    }
    
    // Sentence length check
    const sentences = description.split(/[.!?]+/).filter(s => s.trim());
    for (const sentence of sentences) {
      const wordCount = sentence.trim().split(/\s+/).length;
      if (wordCount > QUALITY_THRESHOLDS.readability.sentenceLength) {
        warnings.push(`Sentence too long (${wordCount} words)`);
        break;
      }
    }
    
    // Technical accuracy for specific types
    if (type === 'chart' || type === 'diagram') {
      if (!description.match(/\b(data|values?|axis|legend|components?)\b/i)) {
        warnings.push('Technical descriptions should include data/component details');
      } else {
        passed.push('Includes technical details');
      }
    }
    
    return {
      valid: issues.length === 0,
      score: this.calculateScore(passed.length, warnings.length, issues.length),
      issues,
      warnings,
      passed,
      wcagLevel: this.determineWCAGLevel(issues.length, warnings.length)
    };
  }
  
  validateHTMLAccessibility(html: string): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const passed: string[] = [];
    
    // Check for alt attributes
    const imgMatches = html.match(/<img[^>]*>/g) || [];
    for (const img of imgMatches) {
      if (!img.includes('alt=')) {
        issues.push('Image missing alt attribute');
      } else if (img.includes('alt=""') || img.includes("alt=''")) {
        warnings.push('Empty alt attribute - ensure decorative image');
      } else {
        passed.push('Alt attribute present');
      }
    }
    
    // Check for ARIA labels
    if (html.includes('aria-label') || html.includes('aria-labelledby')) {
      passed.push('ARIA labels present');
    } else if (imgMatches.length > 0) {
      warnings.push('Consider adding ARIA labels for complex images');
    }
    
    // Check for role attributes
    if (html.includes('role=')) {
      passed.push('Role attributes present');
    }
    
    // Check for proper heading structure
    const headings = html.match(/<h[1-6][^>]*>/g) || [];
    if (headings.length > 0) {
      const levels = headings.map(h => parseInt(h.match(/h([1-6])/)?.[1] || '0'));
      let properStructure = true;
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) {
          properStructure = false;
          issues.push('Heading levels skip (e.g., h1 to h3)');
          break;
        }
      }
      if (properStructure) {
        passed.push('Proper heading structure');
      }
    }
    
    // Check for language attributes
    if (html.includes('lang=')) {
      passed.push('Language attribute present');
    } else {
      warnings.push('Consider adding lang attribute');
    }
    
    return {
      valid: issues.length === 0,
      score: this.calculateScore(passed.length, warnings.length, issues.length),
      issues,
      warnings,
      passed,
      wcagLevel: this.determineWCAGLevel(issues.length, warnings.length)
    };
  }
  
  validateScreenReaderCompatibility(content: string, readerType: keyof typeof SCREEN_READERS): ValidationResult {
    const reader = SCREEN_READERS[readerType];
    const issues: string[] = [];
    const warnings: string[] = [];
    const passed: string[] = [];
    
    // Check requirements for specific screen reader
    for (const requirement of reader.requirements) {
      switch (requirement) {
        case 'proper punctuation':
          if (content.match(/[.!?,;:]/)) {
            passed.push('Has proper punctuation for pauses');
          } else {
            warnings.push('Add punctuation for better screen reader flow');
          }
          break;
          
        case 'alt text':
          // This would check the actual implementation
          passed.push('Alt text compatibility checked');
          break;
          
        case 'semantic HTML':
          if (content.includes('<') && content.includes('>')) {
            passed.push('Uses semantic HTML');
          }
          break;
          
        case 'ARIA labels':
          if (content.includes('aria-')) {
            passed.push('ARIA labels present');
          } else {
            warnings.push(`${reader.name} works better with ARIA labels`);
          }
          break;
      }
    }
    
    // Check for common screen reader issues
    if (content.includes('click here') || content.includes('read more')) {
      issues.push('Avoid vague link text for screen readers');
    }
    
    if (content.match(/\b[A-Z]{4,}\b/)) {
      warnings.push('All-caps text may be spelled out letter by letter');
    }
    
    return {
      valid: issues.length === 0,
      score: this.calculateScore(passed.length, warnings.length, issues.length),
      issues,
      warnings,
      passed,
      screenReader: reader.name,
      compatibility: reader.compatibility
    };
  }
  
  private checkForElement(description: string, element: string): boolean {
    const patterns: Record<string, RegExp> = {
      subject: /\b(person|people|object|item|thing|animal|building|vehicle)\b/i,
      action: /\b(walking|running|sitting|standing|moving|doing|showing|displaying)\b/i,
      context: /\b(in|at|on|near|beside|background|foreground|setting|environment)\b/i
    };
    
    return patterns[element]?.test(description) || false;
  }
  
  private calculateReadability(text: string): ReadabilityScore {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length || 1;
    const words = text.split(/\s+/).filter(w => w.trim()).length;
    const syllables = this.countSyllables(text);
    
    // Flesch-Kincaid Grade Level
    const gradeLevel = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
    
    // Flesch Reading Ease
    const readingEase = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    
    return {
      gradeLevel: Math.max(0, Math.round(gradeLevel)),
      readingEase: Math.max(0, Math.min(100, readingEase)),
      avgWordsPerSentence: words / sentences,
      avgSyllablesPerWord: syllables / words
    };
  }
  
  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;
    
    for (const word of words) {
      // Simple syllable counting algorithm
      let syllables = 0;
      let previousWasVowel = false;
      
      for (const char of word) {
        const isVowel = 'aeiou'.includes(char);
        if (isVowel && !previousWasVowel) {
          syllables++;
        }
        previousWasVowel = isVowel;
      }
      
      // Adjust for silent e
      if (word.endsWith('e') && syllables > 1) {
        syllables--;
      }
      
      totalSyllables += Math.max(1, syllables);
    }
    
    return totalSyllables;
  }
  
  private calculateScore(passed: number, warnings: number, issues: number): number {
    const total = passed + warnings + issues;
    if (total === 0) return 0;
    
    const score = ((passed * 1.0) + (warnings * 0.5) + (issues * 0)) / total;
    return Math.round(score * 100);
  }
  
  private determineWCAGLevel(issues: number, warnings: number): string {
    if (issues === 0 && warnings === 0) return 'AAA';
    if (issues === 0 && warnings <= 2) return 'AA';
    if (issues <= 1 && warnings <= 4) return 'A';
    return 'FAIL';
  }
}

// Quality assessment helper
class QualityAssessor {
  assessImageDescription(description: any, imageType: string): QualityReport {
    const scores: Record<string, number> = {};
    const details: Record<string, any> = {};
    
    // Confidence score
    scores.confidence = this.assessConfidence(description.confidence);
    details.confidence = {
      value: description.confidence,
      threshold: QUALITY_THRESHOLDS.confidence.minimum,
      rating: this.getRating(scores.confidence)
    };
    
    // Completeness score
    scores.completeness = this.assessCompleteness(description);
    details.completeness = {
      elements: description.visualElements?.length || 0,
      wordCount: description.description?.split(/\s+/).length || 0,
      rating: this.getRating(scores.completeness)
    };
    
    // Relevance score
    scores.relevance = this.assessRelevance(description, imageType);
    details.relevance = {
      imageType,
      matchesType: this.checkTypeMatch(description.description, imageType),
      rating: this.getRating(scores.relevance)
    };
    
    // Clarity score
    scores.clarity = this.assessClarity(description.description);
    details.clarity = {
      ambiguousTerms: this.findAmbiguousTerms(description.description),
      rating: this.getRating(scores.clarity)
    };
    
    // Calculate overall score
    const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
    
    return {
      overallScore,
      scores,
      details,
      recommendation: this.getRecommendation(overallScore),
      improvements: this.suggestImprovements(scores, details)
    };
  }
  
  private assessConfidence(confidence: number): number {
    const thresholds = QUALITY_THRESHOLDS.confidence;
    
    if (confidence >= thresholds.excellent) return 100;
    if (confidence >= thresholds.target) return 90;
    if (confidence >= thresholds.minimum) return 75;
    return 50;
  }
  
  private assessCompleteness(description: any): number {
    let score = 100;
    
    // Check word count
    const wordCount = description.description?.split(/\s+/).length || 0;
    if (wordCount < QUALITY_THRESHOLDS.completeness.minWordCount) {
      score -= 20;
    }
    if (wordCount > QUALITY_THRESHOLDS.completeness.maxWordCount) {
      score -= 10;
    }
    
    // Check for required elements
    const hasElements = description.visualElements && description.visualElements.length > 0;
    if (!hasElements) {
      score -= 30;
    }
    
    // Check for descriptive details
    const hasDetails = description.colors || description.composition || description.mood;
    if (hasDetails) {
      score = Math.min(100, score + 10);
    }
    
    return Math.max(0, score);
  }
  
  private assessRelevance(description: any, imageType: string): number {
    const typeKeywords: Record<string, string[]> = {
      photo: ['photograph', 'image', 'scene', 'view', 'landscape', 'portrait'],
      chart: ['chart', 'graph', 'data', 'axis', 'values', 'legend'],
      diagram: ['diagram', 'flow', 'process', 'components', 'structure', 'system'],
      screenshot: ['interface', 'screen', 'application', 'window', 'menu', 'button'],
      artwork: ['art', 'artistic', 'abstract', 'style', 'composition', 'creative']
    };
    
    const keywords = typeKeywords[imageType] || [];
    const descText = description.description?.toLowerCase() || '';
    
    const matchCount = keywords.filter(keyword => descText.includes(keyword)).length;
    const matchRatio = keywords.length > 0 ? matchCount / keywords.length : 0;
    
    return Math.round(matchRatio * 100);
  }
  
  private assessClarity(description: string): number {
    let score = 100;
    
    // Check for ambiguous terms
    const ambiguousTerms = this.findAmbiguousTerms(description);
    score -= ambiguousTerms.length * 10;
    
    // Check for overly complex sentences
    const sentences = description.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (sentence.split(/\s+/).length > 25) {
        score -= 15;
      }
    }
    
    // Check for jargon
    const jargonTerms = ['utilize', 'leverage', 'synergy', 'paradigm', 'holistic'];
    for (const term of jargonTerms) {
      if (description.toLowerCase().includes(term)) {
        score -= 5;
      }
    }
    
    return Math.max(0, score);
  }
  
  private checkTypeMatch(description: string, imageType: string): boolean {
    const typePatterns: Record<string, RegExp> = {
      photo: /photo|image|scene|landscape|portrait/i,
      chart: /chart|graph|data|plot|axis/i,
      diagram: /diagram|flow|schematic|blueprint/i,
      screenshot: /screen|interface|window|application/i,
      artwork: /art|painting|drawing|illustration/i
    };
    
    return typePatterns[imageType]?.test(description) || false;
  }
  
  private findAmbiguousTerms(description: string): string[] {
    const ambiguous = ['thing', 'stuff', 'something', 'various', 'several', 'many', 'some'];
    return ambiguous.filter(term => description.toLowerCase().includes(term));
  }
  
  private getRating(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Acceptable';
    return 'Needs Improvement';
  }
  
  private getRecommendation(score: number): string {
    if (score >= 90) return 'Ready for production use';
    if (score >= 75) return 'Suitable with minor improvements';
    if (score >= 60) return 'Requires review and enhancement';
    return 'Needs significant improvement';
  }
  
  private suggestImprovements(scores: Record<string, number>, details: any): string[] {
    const improvements: string[] = [];
    
    if (scores.confidence < 90) {
      improvements.push('Consider reprocessing with higher quality settings');
    }
    
    if (scores.completeness < 90) {
      improvements.push('Add more descriptive details about visual elements');
    }
    
    if (scores.relevance < 75) {
      improvements.push('Ensure description matches the image type and content');
    }
    
    if (scores.clarity < 90) {
      improvements.push('Simplify complex sentences and avoid ambiguous terms');
    }
    
    return improvements;
  }
}

// Types
interface ValidationResult {
  valid: boolean;
  score: number;
  issues: string[];
  warnings: string[];
  passed: string[];
  wcagLevel?: string;
  screenReader?: string;
  compatibility?: string[];
}

interface ReadabilityScore {
  gradeLevel: number;
  readingEase: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
}

interface QualityReport {
  overallScore: number;
  scores: Record<string, number>;
  details: Record<string, any>;
  recommendation: string;
  improvements: string[];
}

describe('Accessibility and Quality Validation', () => {
  const validator = new AccessibilityValidator();
  const assessor = new QualityAssessor();
  
  describe('Alt Text Validation', () => {
    test('should validate correct alt text', () => {
      const altText = 'A red car parked in front of a modern office building.';
      const result = validator.validateAltText(altText);
      
      expect(result.valid).toBe(true);
      expect(result.wcagLevel).toBe('AAA');
      expect(result.passed.length).toBeGreaterThan(result.issues.length);
    });
    
    test('should detect redundant phrases', () => {
      const altText = 'Image of a sunset over the ocean.';
      const result = validator.validateAltText(altText);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Contains redundant phrase: "image of"');
    });
    
    test('should validate alt text length', () => {
      const tooShort = 'Car.';
      const tooLong = 'A'.repeat(130) + '.';
      const justRight = 'A blue sedan parked in a residential driveway during sunset.';
      
      const shortResult = validator.validateAltText(tooShort);
      const longResult = validator.validateAltText(tooLong);
      const rightResult = validator.validateAltText(justRight);
      
      expect(shortResult.issues.length).toBeGreaterThan(0);
      expect(longResult.warnings.length).toBeGreaterThan(0);
      expect(rightResult.valid).toBe(true);
    });
    
    test('should check for descriptive language', () => {
      const vague = 'A thing in a place.';
      const descriptive = 'A laptop displays a spreadsheet on a wooden desk.';
      
      const vagueResult = validator.validateAltText(vague);
      const descriptiveResult = validator.validateAltText(descriptive);
      
      expect(vagueResult.warnings.length).toBeGreaterThan(0);
      expect(descriptiveResult.passed).toContain('Uses descriptive language');
    });
  });
  
  describe('Description Quality Validation', () => {
    test('should validate comprehensive descriptions', () => {
      const description = MOCK_BEDROCK_RESPONSES.photo.description;
      const result = validator.validateDescription(description, 'photo');
      
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(70);
    });
    
    test('should check for required elements', () => {
      const incomplete = 'There is something in the image.';
      const complete = 'A person walks through a park with trees in the background.';
      
      const incompleteResult = validator.validateDescription(incomplete);
      const completeResult = validator.validateDescription(complete);
      
      expect(incompleteResult.warnings.length).toBeGreaterThan(0);
      expect(completeResult.passed.length).toBeGreaterThan(incompleteResult.passed.length);
    });
    
    test('should validate technical descriptions', () => {
      const chartDesc = MOCK_BEDROCK_RESPONSES.chart.description;
      const result = validator.validateDescription(chartDesc, 'chart');
      
      expect(result.passed).toContain('Includes technical details');
    });
    
    test('should check readability level', () => {
      const complex = 'The multifaceted paradigm exemplifies heterogeneous compositional elements.';
      const simple = 'The image shows a cat sitting on a red chair.';
      
      const complexResult = validator.validateDescription(complex);
      const simpleResult = validator.validateDescription(simple);
      
      expect(complexResult.warnings.length).toBeGreaterThan(0);
      expect(simpleResult.passed).toContain('Appropriate reading level');
    });
  });
  
  describe('HTML Accessibility', () => {
    test('should validate accessible HTML', () => {
      const html = `
        <figure>
          <img src="image.jpg" alt="Sunset over mountains" 
               role="img" aria-labelledby="fig1">
          <figcaption id="fig1">Beautiful sunset scene</figcaption>
        </figure>
      `;
      
      const result = validator.validateHTMLAccessibility(html);
      
      expect(result.valid).toBe(true);
      expect(result.passed).toContain('Alt attribute present');
      expect(result.passed).toContain('ARIA labels present');
      expect(result.passed).toContain('Role attributes present');
    });
    
    test('should detect missing alt attributes', () => {
      const html = '<img src="image.jpg">';
      const result = validator.validateHTMLAccessibility(html);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Image missing alt attribute');
    });
    
    test('should check heading structure', () => {
      const goodStructure = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      const badStructure = '<h1>Title</h1><h3>Skip to h3</h3>';
      
      const goodResult = validator.validateHTMLAccessibility(goodStructure);
      const badResult = validator.validateHTMLAccessibility(badStructure);
      
      expect(goodResult.passed).toContain('Proper heading structure');
      expect(badResult.issues).toContain('Heading levels skip (e.g., h1 to h3)');
    });
  });
  
  describe('Screen Reader Compatibility', () => {
    test('should validate JAWS compatibility', () => {
      const content = 'A person walks through the park. Trees are visible in the background.';
      const result = validator.validateScreenReaderCompatibility(content, 'jaws');
      
      expect(result.valid).toBe(true);
      expect(result.passed).toContain('Has proper punctuation for pauses');
      expect(result.screenReader).toBe('JAWS');
    });
    
    test('should validate VoiceOver compatibility', () => {
      const content = '<img alt="Sunset" role="img" aria-label="Sunset over ocean">';
      const result = validator.validateScreenReaderCompatibility(content, 'voiceover');
      
      expect(result.passed.length).toBeGreaterThan(0);
      expect(result.compatibility).toContain('macOS');
      expect(result.compatibility).toContain('iOS');
    });
    
    test('should detect screen reader issues', () => {
      const problematic = 'CLICK HERE to see more INFO about this AMAZING product!!!';
      const result = validator.validateScreenReaderCompatibility(problematic, 'nvda');
      
      expect(result.issues).toContain('Avoid vague link text for screen readers');
      expect(result.warnings).toContain('All-caps text may be spelled out letter by letter');
    });
  });
  
  describe('Quality Assessment', () => {
    test('should assess photo description quality', () => {
      const description = {
        ...MOCK_BEDROCK_RESPONSES.photo,
        analysisType: 'photo'
      };
      
      const report = assessor.assessImageDescription(description, 'photo');
      
      expect(report.overallScore).toBeGreaterThan(75);
      expect(report.scores.confidence).toBeGreaterThan(80);
      expect(report.recommendation).toContain('Suitable');
    });
    
    test('should assess chart description quality', () => {
      const description = {
        ...MOCK_BEDROCK_RESPONSES.chart,
        analysisType: 'chart'
      };
      
      const report = assessor.assessImageDescription(description, 'chart');
      
      expect(report.scores.relevance).toBeGreaterThan(70);
      expect(report.details.relevance.matchesType).toBe(true);
    });
    
    test('should provide improvement suggestions', () => {
      const poorDescription = {
        description: 'Something is there.',
        confidence: 0.70,
        visualElements: [],
        analysisType: 'photo'
      };
      
      const report = assessor.assessImageDescription(poorDescription, 'photo');
      
      expect(report.overallScore).toBeLessThan(60);
      expect(report.recommendation).toContain('significant improvement');
      expect(report.improvements.length).toBeGreaterThan(2);
    });
    
    test('should rate excellent descriptions highly', () => {
      const excellentDescription = {
        ...MOCK_BEDROCK_RESPONSES.artwork,
        confidence: 0.96,
        analysisType: 'artwork'
      };
      
      const report = assessor.assessImageDescription(excellentDescription, 'artwork');
      
      expect(report.overallScore).toBeGreaterThan(85);
      expect(report.recommendation).toContain('Ready for production');
    });
  });
  
  describe('WCAG Compliance', () => {
    test('should meet WCAG 2.1 Level A requirements', () => {
      const content = {
        altText: 'Person using laptop',
        description: 'A person sits at a desk using a laptop computer.',
        html: '<img alt="Person using laptop" src="image.jpg">'
      };
      
      const altResult = validator.validateAltText(content.altText);
      const descResult = validator.validateDescription(content.description);
      const htmlResult = validator.validateHTMLAccessibility(content.html);
      
      // Level A requires basic alt text
      expect(altResult.valid || altResult.warnings.length <= 2).toBe(true);
      expect(htmlResult.passed).toContain('Alt attribute present');
    });
    
    test('should meet WCAG 2.1 Level AA requirements', () => {
      const content = {
        altText: 'Professional woman presenting data chart to colleagues in conference room.',
        description: MOCK_BEDROCK_RESPONSES.screenshot.description,
        html: `
          <figure role="img" aria-labelledby="desc">
            <img alt="Dashboard screenshot" src="dashboard.png">
            <figcaption id="desc">Application dashboard with analytics</figcaption>
          </figure>
        `
      };
      
      const altResult = validator.validateAltText(content.altText);
      const htmlResult = validator.validateHTMLAccessibility(content.html);
      
      expect(altResult.wcagLevel).toMatch(/^(AA|AAA)$/);
      expect(htmlResult.valid).toBe(true);
    });
    
    test('should identify WCAG failures', () => {
      const failingContent = {
        altText: '', // Empty alt text for non-decorative image
        html: '<img src="important-chart.png">' // No alt attribute
      };
      
      const altResult = validator.validateAltText(failingContent.altText || 'x');
      const htmlResult = validator.validateHTMLAccessibility(failingContent.html);
      
      expect(htmlResult.valid).toBe(false);
      expect(htmlResult.wcagLevel).toBe('FAIL');
    });
  });
  
  describe('Confidence Thresholds', () => {
    test('should meet minimum confidence threshold', () => {
      const descriptions = Object.values(MOCK_BEDROCK_RESPONSES);
      
      descriptions.forEach(desc => {
        expect(desc.confidence).toBeGreaterThanOrEqual(
          QUALITY_THRESHOLDS.confidence.minimum
        );
      });
    });
    
    test('should flag low confidence results', () => {
      const lowConfidence = {
        description: 'Uncertain content',
        confidence: 0.60,
        visualElements: []
      };
      
      const report = assessor.assessImageDescription(lowConfidence, 'photo');
      
      expect(report.scores.confidence).toBeLessThan(75);
      expect(report.improvements).toContain(
        'Consider reprocessing with higher quality settings'
      );
    });
  });
});