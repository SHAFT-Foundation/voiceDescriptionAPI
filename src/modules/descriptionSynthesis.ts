import { 
  APIResponse,
  OpenAIChunkAnalysis,
  SynthesizedDescription,
  DescriptionSynthesisOptions
} from '../types';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { retryWithBackoff } from '../utils/retry';

export class DescriptionSynthesisModule {
  private openai: OpenAI | null;
  private useAIEnhancement: boolean;

  constructor() {
    // Initialize OpenAI if available for enhanced synthesis
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORG_ID,
      });
      this.useAIEnhancement = true;
    } else {
      this.openai = null;
      this.useAIEnhancement = false;
    }
  }

  /**
   * Synthesize descriptions from multiple chunk analyses
   */
  async synthesizeDescriptions(
    chunkAnalyses: OpenAIChunkAnalysis[],
    options?: DescriptionSynthesisOptions
  ): Promise<APIResponse<SynthesizedDescription>> {
    try {
      logger.info('Starting description synthesis', {
        totalChunks: chunkAnalyses.length,
        options,
      });

      // Sort chunks by timestamp
      const sortedAnalyses = [...chunkAnalyses].sort(
        (a, b) => a.startTime - b.startTime
      );

      // Generate different formats
      const [
        narrativeDescription,
        timestampedDescription,
        technicalDescription,
        accessibilityDescription
      ] = await Promise.all([
        this.generateNarrativeDescription(sortedAnalyses, options),
        this.generateTimestampedDescription(sortedAnalyses, options),
        this.generateTechnicalDescription(sortedAnalyses, options),
        this.generateAccessibilityDescription(sortedAnalyses, options),
      ]);

      // Extract key moments and highlights
      const keyMoments = this.extractKeyMoments(sortedAnalyses);
      const highlights = this.extractHighlights(sortedAnalyses);

      // Generate chapter markers if video is long enough
      const chapters = this.generateChapters(sortedAnalyses, options);

      // Create metadata
      const metadata = this.generateMetadata(sortedAnalyses);

      const result: SynthesizedDescription = {
        narrative: narrativeDescription,
        timestamped: timestampedDescription,
        technical: technicalDescription,
        accessibility: accessibilityDescription,
        keyMoments,
        highlights,
        chapters,
        metadata: {
          ...metadata,
          synthesisMethod: this.useAIEnhancement ? 'ai-enhanced' : 'rule-based',
          totalDuration: sortedAnalyses[sortedAnalyses.length - 1]?.endTime || 0,
        },
      };

      logger.info('Description synthesis completed', {
        wordCount: metadata.wordCount,
        keyMoments: keyMoments.length,
        chapters: chapters.length,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Description synthesis failed', { error });

      return {
        success: false,
        error: {
          code: 'SYNTHESIS_FAILED',
          message: 'Failed to synthesize descriptions',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Generate narrative description (story-like flow)
   */
  private async generateNarrativeDescription(
    analyses: OpenAIChunkAnalysis[],
    options?: DescriptionSynthesisOptions
  ): Promise<string> {
    if (this.useAIEnhancement && this.openai) {
      // Use AI to create a cohesive narrative
      const chunkDescriptions = analyses
        .map(a => a.description)
        .join('\n\n');

      const prompt = `Create a flowing, narrative description from these video segments:

${chunkDescriptions}

Requirements:
- Create smooth transitions between segments
- Maintain chronological flow
- Use engaging, descriptive language
- Avoid repetition
- Keep it concise but comprehensive
${options?.targetLength ? `- Target length: ${options.targetLength} words` : ''}`;

      try {
        const response = await retryWithBackoff(
          async () => {
            return await this.openai!.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [
                {
                  role: 'user',
                  content: prompt,
                },
              ],
              max_tokens: 1000,
              temperature: 0.7,
            });
          },
          { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, exponentialBase: 2 }
        );

        return response.choices[0]?.message?.content || this.fallbackNarrative(analyses);
      } catch (error) {
        logger.warn('AI narrative generation failed, using fallback', { error });
        return this.fallbackNarrative(analyses);
      }
    }

    return this.fallbackNarrative(analyses);
  }

  /**
   * Fallback narrative generation without AI
   */
  private fallbackNarrative(analyses: OpenAIChunkAnalysis[]): string {
    const segments: string[] = [];
    
    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      const transition = this.getTransitionWord(i, analyses.length);
      
      segments.push(`${transition}${analysis.description}`);
    }

    return segments.join(' ');
  }

  /**
   * Generate timestamped description
   */
  private async generateTimestampedDescription(
    analyses: OpenAIChunkAnalysis[],
    options?: DescriptionSynthesisOptions
  ): Promise<string> {
    const timestampedSegments: string[] = [];

    for (const analysis of analyses) {
      const timestamp = this.formatTimestamp(analysis.startTime);
      const endTimestamp = this.formatTimestamp(analysis.endTime);
      
      // Clean and condense description
      const condensedDescription = this.condenseDescription(
        analysis.description,
        options?.maxSegmentLength || 150
      );

      timestampedSegments.push(
        `[${timestamp} - ${endTimestamp}] ${condensedDescription}`
      );
    }

    return timestampedSegments.join('\n\n');
  }

  /**
   * Generate technical description with detailed analysis
   */
  private async generateTechnicalDescription(
    analyses: OpenAIChunkAnalysis[],
    options?: DescriptionSynthesisOptions
  ): Promise<string> {
    const technicalSegments: string[] = [];

    // Add summary statistics
    technicalSegments.push('## Technical Analysis Summary');
    technicalSegments.push(`Total Segments: ${analyses.length}`);
    technicalSegments.push(`Duration: ${this.formatTimestamp(analyses[analyses.length - 1]?.endTime || 0)}`);
    technicalSegments.push(`Average Confidence: ${this.calculateAverageConfidence(analyses).toFixed(2)}`);
    technicalSegments.push('');

    // Add detailed segment analysis
    technicalSegments.push('## Segment Details');
    
    for (const analysis of analyses) {
      const segmentInfo = [
        `### Segment ${analysis.chunkId}`,
        `Time: ${this.formatTimestamp(analysis.startTime)} - ${this.formatTimestamp(analysis.endTime)}`,
        `Confidence: ${(analysis.confidence * 100).toFixed(1)}%`,
        `Visual Elements: ${analysis.visualElements.join(', ') || 'None identified'}`,
        `Actions: ${analysis.actions.join(', ') || 'None identified'}`,
        `Context: ${analysis.context}`,
        '',
        `Description: ${analysis.description}`,
        '---',
      ];

      technicalSegments.push(...segmentInfo);
    }

    return technicalSegments.join('\n');
  }

  /**
   * Generate accessibility-focused description
   */
  private async generateAccessibilityDescription(
    analyses: OpenAIChunkAnalysis[],
    options?: DescriptionSynthesisOptions
  ): Promise<string> {
    const accessibilitySegments: string[] = [];

    // Add header with context
    accessibilitySegments.push('Audio Description Track');
    accessibilitySegments.push('');

    for (const analysis of analyses) {
      // Focus on essential visual information for accessibility
      const essentialInfo = this.extractEssentialVisualInfo(analysis);
      
      if (essentialInfo) {
        accessibilitySegments.push(
          `${this.formatTimestamp(analysis.startTime)}: ${essentialInfo}`
        );
      }
    }

    // Add any on-screen text or important visual cues
    const textElements = this.extractTextElements(analyses);
    if (textElements.length > 0) {
      accessibilitySegments.push('');
      accessibilitySegments.push('On-screen text and visual cues:');
      textElements.forEach(element => {
        accessibilitySegments.push(`- ${element}`);
      });
    }

    return accessibilitySegments.join('\n');
  }

  /**
   * Extract key moments from the video
   */
  private extractKeyMoments(
    analyses: OpenAIChunkAnalysis[]
  ): Array<{
    timestamp: number;
    description: string;
    importance: 'high' | 'medium' | 'low';
  }> {
    const keyMoments: Array<{
      timestamp: number;
      description: string;
      importance: 'high' | 'medium' | 'low';
    }> = [];

    for (const analysis of analyses) {
      // Identify key moments based on confidence and content
      const importance = this.calculateImportance(analysis);
      
      if (importance !== 'low' || analysis.actions.length > 2) {
        keyMoments.push({
          timestamp: analysis.startTime,
          description: this.condenseDescription(analysis.description, 50),
          importance,
        });
      }
    }

    // Sort by importance then timestamp
    return keyMoments.sort((a, b) => {
      const importanceOrder = { high: 0, medium: 1, low: 2 };
      const importanceDiff = importanceOrder[a.importance] - importanceOrder[b.importance];
      return importanceDiff !== 0 ? importanceDiff : a.timestamp - b.timestamp;
    });
  }

  /**
   * Extract highlights from the video
   */
  private extractHighlights(
    analyses: OpenAIChunkAnalysis[]
  ): string[] {
    const highlights: Set<string> = new Set();

    for (const analysis of analyses) {
      // Extract unique visual elements and actions as highlights
      analysis.visualElements.forEach(element => {
        if (element.length > 3) { // Filter out very short elements
          highlights.add(element);
        }
      });

      // Add significant actions
      analysis.actions.forEach(action => {
        if (action.length > 4) { // Filter out very short actions
          highlights.add(action);
        }
      });
    }

    return Array.from(highlights).slice(0, 10); // Limit to top 10 highlights
  }

  /**
   * Generate chapter markers for long videos
   */
  private generateChapters(
    analyses: OpenAIChunkAnalysis[],
    options?: DescriptionSynthesisOptions
  ): Array<{
    timestamp: number;
    title: string;
    description: string;
  }> {
    const chapters: Array<{
      timestamp: number;
      title: string;
      description: string;
    }> = [];

    const minChapterDuration = options?.minChapterDuration || 30; // seconds
    const totalDuration = analyses[analyses.length - 1]?.endTime || 0;

    if (totalDuration < minChapterDuration * 2) {
      return []; // Video too short for chapters
    }

    // Group analyses into chapters based on content similarity
    let currentChapter: OpenAIChunkAnalysis[] = [];
    let lastContext = '';

    for (const analysis of analyses) {
      if (currentChapter.length === 0) {
        currentChapter.push(analysis);
        lastContext = analysis.context;
      } else {
        // Check if context has changed significantly
        const contextSimilarity = this.calculateContextSimilarity(
          lastContext,
          analysis.context
        );

        if (contextSimilarity < 0.5 || 
            analysis.endTime - currentChapter[0].startTime > minChapterDuration * 2) {
          // Create chapter from current group
          chapters.push(this.createChapter(currentChapter));
          
          // Start new chapter
          currentChapter = [analysis];
          lastContext = analysis.context;
        } else {
          currentChapter.push(analysis);
        }
      }
    }

    // Add final chapter
    if (currentChapter.length > 0) {
      chapters.push(this.createChapter(currentChapter));
    }

    return chapters;
  }

  /**
   * Create a chapter from grouped analyses
   */
  private createChapter(
    analyses: OpenAIChunkAnalysis[]
  ): {
    timestamp: number;
    title: string;
    description: string;
  } {
    const timestamp = analyses[0].startTime;
    
    // Generate title from common elements
    const commonElements = this.findCommonElements(analyses);
    const title = commonElements.length > 0 
      ? commonElements.slice(0, 3).join(' & ')
      : `Scene ${Math.floor(timestamp / 60) + 1}`;

    // Generate description from all analyses
    const description = analyses
      .map(a => a.description)
      .join(' ')
      .substring(0, 200) + '...';

    return { timestamp, title, description };
  }

  /**
   * Generate metadata for the synthesized description
   */
  private generateMetadata(
    analyses: OpenAIChunkAnalysis[]
  ): {
    wordCount: number;
    sentenceCount: number;
    averageConfidence: number;
    totalTokensUsed: number;
    uniqueVisualElements: number;
    uniqueActions: number;
  } {
    const allText = analyses.map(a => a.description).join(' ');
    const wordCount = allText.split(/\s+/).length;
    const sentenceCount = allText.split(/[.!?]+/).length - 1;
    
    const allVisualElements = new Set<string>();
    const allActions = new Set<string>();
    let totalConfidence = 0;
    let totalTokens = 0;

    for (const analysis of analyses) {
      analysis.visualElements.forEach(e => allVisualElements.add(e));
      analysis.actions.forEach(a => allActions.add(a));
      totalConfidence += analysis.confidence;
      totalTokens += analysis.tokensUsed;
    }

    return {
      wordCount,
      sentenceCount,
      averageConfidence: analyses.length > 0 ? totalConfidence / analyses.length : 0,
      totalTokensUsed: totalTokens,
      uniqueVisualElements: allVisualElements.size,
      uniqueActions: allActions.size,
    };
  }

  // Helper methods

  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  private condenseDescription(description: string, maxLength: number): string {
    if (description.length <= maxLength) {
      return description;
    }

    // Try to cut at sentence boundary
    const sentences = description.split(/[.!?]+/);
    let condensed = '';
    
    for (const sentence of sentences) {
      if (condensed.length + sentence.length < maxLength) {
        condensed += sentence + '. ';
      } else {
        break;
      }
    }

    return condensed.trim() || description.substring(0, maxLength) + '...';
  }

  private getTransitionWord(index: number, total: number): string {
    if (index === 0) return 'The video begins with ';
    if (index === total - 1) return 'Finally, ';
    if (index === Math.floor(total / 2)) return 'In the middle, ';
    
    const transitions = ['Next, ', 'Then, ', 'Following this, ', 'Subsequently, ', 'Meanwhile, '];
    return transitions[index % transitions.length];
  }

  private calculateAverageConfidence(analyses: OpenAIChunkAnalysis[]): number {
    if (analyses.length === 0) return 0;
    
    const total = analyses.reduce((sum, a) => sum + a.confidence, 0);
    return total / analyses.length;
  }

  private calculateImportance(
    analysis: OpenAIChunkAnalysis
  ): 'high' | 'medium' | 'low' {
    if (analysis.confidence > 0.9 && analysis.actions.length > 3) return 'high';
    if (analysis.confidence > 0.7 && analysis.actions.length > 1) return 'medium';
    return 'low';
  }

  private extractEssentialVisualInfo(analysis: OpenAIChunkAnalysis): string {
    const essential: string[] = [];
    
    // Add key visual elements
    if (analysis.visualElements.length > 0) {
      essential.push(analysis.visualElements.slice(0, 3).join(', '));
    }

    // Add important actions
    if (analysis.actions.length > 0) {
      essential.push(analysis.actions.slice(0, 2).join(' and '));
    }

    // Add context if significant
    if (analysis.context && analysis.context.length > 20) {
      essential.push(analysis.context);
    }

    return essential.join('. ');
  }

  private extractTextElements(analyses: OpenAIChunkAnalysis[]): string[] {
    const textElements: Set<string> = new Set();

    for (const analysis of analyses) {
      // Look for text mentions in descriptions
      const textMatches = analysis.description.match(
        /(?:text|title|caption|label|sign|banner)(?:\s+(?:reads?|says?|shows?))?\s*[:\s]+["']([^"']+)["']/gi
      );

      if (textMatches) {
        textMatches.forEach(match => textElements.add(match));
      }
    }

    return Array.from(textElements);
  }

  private calculateContextSimilarity(context1: string, context2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(context1.toLowerCase().split(/\s+/));
    const words2 = new Set(context2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private findCommonElements(analyses: OpenAIChunkAnalysis[]): string[] {
    const elementCounts = new Map<string, number>();

    for (const analysis of analyses) {
      [...analysis.visualElements, ...analysis.actions].forEach(element => {
        elementCounts.set(element, (elementCounts.get(element) || 0) + 1);
      });
    }

    // Sort by frequency and return most common
    return Array.from(elementCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([element]) => element)
      .slice(0, 5);
  }
}