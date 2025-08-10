import { 
  SceneAnalysis, 
  APIResponse, 
  ImageAnalysis, 
  CompiledImageDescription,
  ImageProcessingOptions,
  HTMLAccessibilityMetadata
} from '../types';
import { logger } from '../utils/logger';

export interface CompiledDescription {
  timestampedText: string;
  cleanText: string;
  metadata: {
    totalScenes: number;
    totalDuration: number;
    averageConfidence: number;
    wordCount: number;
  };
}

export class DescriptionCompilationModule {
  private config: {
    includeTimestamps: boolean;
    mergeThreshold: number; // seconds
    minDescriptionLength: number;
    maxDescriptionLength: number;
  };

  constructor(config?: Partial<typeof DescriptionCompilationModule.prototype.config>) {
    this.config = {
      includeTimestamps: true,
      mergeThreshold: 2.0,
      minDescriptionLength: 10,
      maxDescriptionLength: 500,
      ...config,
    };
  }

  async compileDescriptions(
    analyses: SceneAnalysis[],
    jobId: string
  ): Promise<APIResponse<CompiledDescription>> {
    try {
      logger.info('Starting description compilation', { 
        jobId, 
        analysisCount: analyses.length 
      });

      if (analyses.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_ANALYSES',
            message: 'No scene analyses provided for compilation',
          },
          timestamp: new Date(),
        };
      }

      // Sort analyses by start time
      const sortedAnalyses = [...analyses].sort((a, b) => a.startTime - b.startTime);

      // Merge adjacent scenes with similar content if configured
      const mergedAnalyses = this.mergeAdjacentScenes(sortedAnalyses);

      // Clean and process descriptions
      const processedAnalyses = this.processDescriptions(mergedAnalyses);

      // Generate timestamped text
      const timestampedText = this.generateTimestampedText(processedAnalyses);

      // Generate clean text (no timestamps)
      const cleanText = this.generateCleanText(processedAnalyses);

      // Calculate metadata
      const metadata = this.calculateMetadata(processedAnalyses);

      const compiledDescription: CompiledDescription = {
        timestampedText,
        cleanText,
        metadata,
      };

      logger.info('Description compilation completed', {
        jobId,
        totalScenes: metadata.totalScenes,
        wordCount: metadata.wordCount,
        averageConfidence: metadata.averageConfidence,
      });

      return {
        success: true,
        data: compiledDescription,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Description compilation failed', { error, jobId });

      return {
        success: false,
        error: {
          code: 'COMPILATION_FAILED',
          message: 'Failed to compile scene descriptions',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private mergeAdjacentScenes(analyses: SceneAnalysis[]): SceneAnalysis[] {
    if (analyses.length <= 1 || this.config.mergeThreshold <= 0) {
      return analyses;
    }

    const merged: SceneAnalysis[] = [analyses[0]];

    for (let i = 1; i < analyses.length; i++) {
      const current = analyses[i];
      const previous = merged[merged.length - 1];

      // Check if scenes should be merged
      const timeBetween = current.startTime - previous.endTime;
      const shouldMerge = timeBetween <= this.config.mergeThreshold && 
                         this.areScenesRelated(previous, current);

      if (shouldMerge) {
        // Merge scenes
        const mergedAnalysis: SceneAnalysis = {
          segmentId: `${previous.segmentId}-${current.segmentId}`,
          startTime: previous.startTime,
          endTime: current.endTime,
          description: this.mergeDescriptions(previous.description, current.description),
          confidence: Math.max(previous.confidence, current.confidence),
          visualElements: [...new Set([...previous.visualElements, ...current.visualElements])],
          actions: [...new Set([...previous.actions, ...current.actions])],
          context: this.mergeContexts(previous.context, current.context),
        };

        merged[merged.length - 1] = mergedAnalysis;
        logger.debug('Merged adjacent scenes', { 
          previousId: previous.segmentId,
          currentId: current.segmentId,
          mergedId: mergedAnalysis.segmentId,
          timeBetween
        });
      } else {
        merged.push(current);
      }
    }

    logger.info('Scene merging completed', { 
      originalCount: analyses.length,
      mergedCount: merged.length,
      merged: analyses.length - merged.length
    });

    return merged;
  }

  private areScenesRelated(scene1: SceneAnalysis, scene2: SceneAnalysis): boolean {
    // Check for common visual elements or context
    const commonElements = scene1.visualElements.filter(element => 
      scene2.visualElements.includes(element)
    );

    const commonActions = scene1.actions.filter(action => 
      scene2.actions.includes(action)
    );

    // Consider scenes related if they share visual elements or context
    return commonElements.length > 0 || 
           commonActions.length > 0 || 
           this.contextsAreRelated(scene1.context, scene2.context);
  }

  private contextsAreRelated(context1: string, context2: string): boolean {
    if (!context1 || !context2) return false;

    // Simple similarity check based on common words
    const words1 = context1.toLowerCase().split(/\s+/);
    const words2 = context2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => 
      words2.includes(word) && word.length > 3 // Only meaningful words
    );

    return commonWords.length >= 2;
  }

  private mergeDescriptions(desc1: string, desc2: string): string {
    // Avoid redundancy when merging descriptions
    const sentences1 = desc1.split(/[.!?]+/).filter(s => s.trim());
    const sentences2 = desc2.split(/[.!?]+/).filter(s => s.trim());

    // Combine unique sentences
    const allSentences = [...sentences1, ...sentences2];
    const uniqueSentences = allSentences.filter((sentence, index) => {
      const trimmed = sentence.trim().toLowerCase();
      return allSentences.findIndex(s => s.trim().toLowerCase() === trimmed) === index;
    });

    return uniqueSentences.join('. ').trim() + '.';
  }

  private mergeContexts(context1: string, context2: string): string {
    if (!context1) return context2;
    if (!context2) return context1;
    if (context1 === context2) return context1;
    
    // If contexts are different but related, combine them
    return `${context1}; ${context2}`;
  }

  private processDescriptions(analyses: SceneAnalysis[]): SceneAnalysis[] {
    return analyses.map(analysis => ({
      ...analysis,
      description: this.cleanDescription(analysis.description),
    }));
  }

  private cleanDescription(description: string): string {
    return description
      .trim()
      // Remove redundant AI-generated phrases
      .replace(/\b(the scene shows|we can see|there is|there are|in this scene|this video shows)\b/gi, '')
      .replace(/\b(appears to be|seems to|looks like)\b/gi, '')
      // Clean up spacing and punctuation
      .replace(/\s+/g, ' ')
      .replace(/^\s*[,;]\s*/, '') // Remove leading punctuation
      .replace(/\s*[,;]\s*$/, '') // Remove trailing punctuation
      .trim()
      // Ensure proper capitalization
      .replace(/^./, c => c.toUpperCase())
      // Ensure proper ending punctuation
      .replace(/([^.!?])\s*$/, '$1.');
  }

  private generateTimestampedText(analyses: SceneAnalysis[]): string {
    const segments = analyses.map(analysis => {
      const startTime = this.formatTimestamp(analysis.startTime);
      const endTime = this.formatTimestamp(analysis.endTime);
      return `[${startTime} - ${endTime}] ${analysis.description}`;
    });

    return segments.join('\n\n');
  }

  private generateCleanText(analyses: SceneAnalysis[]): string {
    // Create a flowing narrative without timestamps
    const descriptions = analyses.map(analysis => analysis.description);
    
    // Join with appropriate connectors
    let cleanText = '';
    for (let i = 0; i < descriptions.length; i++) {
      const description = descriptions[i];
      
      if (i === 0) {
        cleanText = description;
      } else {
        // Add appropriate connectors between scenes
        const connector = this.getSceneConnector(i, descriptions.length);
        cleanText += ` ${connector} ${description}`;
      }
    }

    return cleanText;
  }

  private getSceneConnector(index: number, total: number): string {
    const connectors = [
      'Next,', 'Then,', 'Subsequently,', 'Following this,', 
      'Meanwhile,', 'At this point,', 'Continuing,', 'Later,'
    ];

    // Use different connectors to create natural flow
    if (index === Math.floor(total / 2)) {
      return 'Midway through,';
    } else if (index === total - 1) {
      return 'Finally,';
    } else {
      return connectors[index % connectors.length];
    }
  }

  private calculateMetadata(analyses: SceneAnalysis[]): CompiledDescription['metadata'] {
    const totalScenes = analyses.length;
    const totalDuration = analyses.reduce((sum, analysis) => 
      sum + (analysis.endTime - analysis.startTime), 0
    );
    const averageConfidence = analyses.reduce((sum, analysis) => 
      sum + analysis.confidence, 0
    ) / totalScenes;

    // Count words in clean text
    const allDescriptions = analyses.map(a => a.description).join(' ');
    const wordCount = allDescriptions.split(/\s+/).filter(word => word.trim()).length;

    return {
      totalScenes,
      totalDuration: Math.round(totalDuration * 10) / 10, // Round to 1 decimal
      averageConfidence: Math.round(averageConfidence * 10) / 10,
      wordCount,
    };
  }

  private formatTimestamp(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 100);
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }

  // Public method for custom formatting
  formatDescriptionForTTS(compiledDescription: CompiledDescription): string {
    // Format description specifically for text-to-speech
    return compiledDescription.cleanText
      .replace(/\[.*?\]/g, '') // Remove any remaining brackets
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure space after punctuation
      .trim();
  }

  // Image-specific compilation methods
  async compileImageDescription(
    analysis: ImageAnalysis,
    options: ImageProcessingOptions
  ): Promise<APIResponse<CompiledImageDescription>> {
    const startTime = Date.now();

    try {
      logger.info('Starting image description compilation', { 
        jobId: analysis.segmentId,
        imageType: analysis.imageType,
        detailLevel: options.detailLevel
      });

      // Extract alt text from analysis (stored temporarily)
      const altText = (analysis as any).altText || this.generateAltText(analysis);

      // Generate descriptions based on detail level
      let detailedDescription: string;
      let technicalDescription: string | undefined;

      switch (options.detailLevel) {
        case 'basic':
          detailedDescription = this.generateBasicDescription(analysis);
          break;
        case 'technical':
          detailedDescription = this.generateDetailedDescription(analysis);
          technicalDescription = this.generateTechnicalDescription(analysis);
          break;
        case 'comprehensive':
        default:
          detailedDescription = this.generateDetailedDescription(analysis);
      }

      // Generate HTML metadata
      const htmlMetadata = this.generateHTMLMetadata(altText, detailedDescription, analysis);

      // Calculate metadata
      const wordCount = detailedDescription.split(/\s+/).filter(word => word.trim()).length;
      const processingTime = Date.now() - startTime;

      const compiledDescription: CompiledImageDescription = {
        altText: this.cleanDescription(altText),
        detailedDescription: this.cleanDescription(detailedDescription),
        technicalDescription: technicalDescription ? this.cleanDescription(technicalDescription) : undefined,
        htmlMetadata,
        metadata: {
          confidence: analysis.confidence,
          wordCount,
          imageType: analysis.imageType,
          processingTime,
        },
      };

      logger.info('Image description compilation completed', {
        jobId: analysis.segmentId,
        wordCount,
        altTextLength: altText.length,
        processingTime,
      });

      return {
        success: true,
        data: compiledDescription,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Image description compilation failed', { 
        error, 
        jobId: analysis.segmentId 
      });

      return {
        success: false,
        error: {
          code: 'IMAGE_COMPILATION_FAILED',
          message: 'Failed to compile image description',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private generateAltText(analysis: ImageAnalysis): string {
    // Generate concise alt text (under 125 characters)
    const mainElements = analysis.visualElements.slice(0, 3).join(', ');
    let altText = '';

    switch (analysis.imageType) {
      case 'chart':
        altText = `Chart showing ${analysis.context || mainElements}`;
        break;
      case 'diagram':
        altText = `Diagram of ${analysis.context || mainElements}`;
        break;
      case 'text':
        altText = `Text image: ${analysis.context || mainElements}`;
        break;
      case 'illustration':
        altText = `Illustration of ${mainElements}`;
        break;
      case 'photo':
      default:
        altText = mainElements || analysis.context || 'Image';
    }

    // Ensure alt text is under 125 characters
    if (altText.length > 125) {
      altText = altText.substring(0, 122) + '...';
    }

    return altText;
  }

  private generateBasicDescription(analysis: ImageAnalysis): string {
    // Generate a basic description focusing on main elements
    const parts: string[] = [];

    // Start with image type
    parts.push(`This is a ${analysis.imageType}`);

    // Add main visual elements
    if (analysis.visualElements.length > 0) {
      parts.push(`showing ${analysis.visualElements.slice(0, 5).join(', ')}`);
    }

    // Add context
    if (analysis.context) {
      parts.push(`. ${analysis.context}`);
    }

    // Add primary colors
    if (analysis.colors.length > 0) {
      parts.push(`. The dominant colors are ${analysis.colors.slice(0, 3).join(', ')}`);
    }

    return parts.join('');
  }

  private generateDetailedDescription(analysis: ImageAnalysis): string {
    // Generate a comprehensive description
    const sections: string[] = [];

    // Main description
    if (analysis.description) {
      sections.push(analysis.description);
    }

    // Visual elements detail
    if (analysis.visualElements.length > 0) {
      sections.push(`Key visual elements include: ${analysis.visualElements.join(', ')}.`);
    }

    // Actions or movements
    if (analysis.actions.length > 0) {
      sections.push(`Visible actions or movements: ${analysis.actions.join(', ')}.`);
    }

    // Composition details
    if (analysis.composition) {
      sections.push(`Composition: ${analysis.composition}`);
    }

    // Color palette
    if (analysis.colors.length > 0) {
      sections.push(`The color palette consists of ${analysis.colors.join(', ')}.`);
    }

    // Context and purpose
    if (analysis.context) {
      sections.push(`Context: ${analysis.context}`);
    }

    return sections.join(' ');
  }

  private generateTechnicalDescription(analysis: ImageAnalysis): string {
    // Generate a technical analysis for professional use
    const sections: string[] = [];

    sections.push(`Technical Analysis of ${analysis.imageType}:`);

    // Detailed composition analysis
    if (analysis.composition) {
      sections.push(`Composition and Layout: ${analysis.composition}`);
    }

    // Color theory analysis
    if (analysis.colors.length > 0) {
      sections.push(`Color Analysis: The image uses a palette of ${analysis.colors.join(', ')}. `);
      
      // Analyze color relationships
      const hasWarmColors = analysis.colors.some(c => 
        /red|orange|yellow|warm/i.test(c)
      );
      const hasCoolColors = analysis.colors.some(c => 
        /blue|green|purple|cool/i.test(c)
      );
      
      if (hasWarmColors && hasCoolColors) {
        sections.push('The palette combines both warm and cool tones for visual balance.');
      } else if (hasWarmColors) {
        sections.push('The warm color palette creates an inviting, energetic atmosphere.');
      } else if (hasCoolColors) {
        sections.push('The cool color palette creates a calm, professional atmosphere.');
      }
    }

    // Visual hierarchy
    if (analysis.visualElements.length > 0) {
      sections.push(`Visual Hierarchy: Primary elements (${analysis.visualElements.slice(0, 3).join(', ')}) ` +
                   `draw initial attention, supported by secondary elements (${analysis.visualElements.slice(3).join(', ')}).`);
    }

    // Design principles
    sections.push(`Design Elements: The ${analysis.imageType} demonstrates `);
    const principles: string[] = [];
    
    if (analysis.composition.includes('balanced') || analysis.composition.includes('symmetr')) {
      principles.push('balance');
    }
    if (analysis.visualElements.length > 5) {
      principles.push('complexity');
    } else {
      principles.push('simplicity');
    }
    if (analysis.colors.length > 1) {
      principles.push('color harmony');
    }
    
    sections[sections.length - 1] += principles.join(', ') + '.';

    // Technical specifications
    sections.push(`Image Type Classification: ${analysis.imageType}. ` +
                 `Confidence Score: ${analysis.confidence}%.`);

    return sections.join(' ');
  }

  private generateHTMLMetadata(
    altText: string, 
    detailedDescription: string,
    analysis: ImageAnalysis
  ): HTMLAccessibilityMetadata {
    // Generate unique ID for long description
    const longDescId = `longdesc-${analysis.segmentId}`;

    // Create ARIA label
    const ariaLabel = altText;

    // Generate Schema.org structured data
    const schemaMarkup = {
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      'name': altText,
      'description': detailedDescription,
      'contentUrl': '', // Will be filled by the API
      'encodingFormat': 'image/jpeg', // Will be updated based on actual format
      'accessibilityFeature': [
        'alternativeText',
        'longDescription',
        'structuralNavigation'
      ],
      'accessibilityHazard': 'none',
      'accessMode': 'textual',
      'accessModeSufficient': 'textual',
    };

    return {
      altAttribute: altText,
      longDescId,
      ariaLabel,
      schemaMarkup,
    };
  }

  // Format image description for TTS
  formatImageDescriptionForTTS(compiledDescription: CompiledImageDescription): string {
    // Combine alt text and detailed description for natural speech
    const parts: string[] = [];
    
    // Start with a brief introduction
    parts.push(compiledDescription.altText);
    
    // Add detailed description with natural transition
    if (compiledDescription.detailedDescription) {
      parts.push('In more detail:');
      parts.push(compiledDescription.detailedDescription);
    }

    // Add technical description if present
    if (compiledDescription.technicalDescription) {
      parts.push('Technical analysis:');
      parts.push(compiledDescription.technicalDescription);
    }

    return parts.join(' ')
      .replace(/\[.*?\]/g, '') // Remove any brackets
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure space after punctuation
      .trim();
  }
}