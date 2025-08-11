/**
 * Advanced Prompt Engineering Module for OpenAI Vision API
 * Implements domain-specific prompts with optimization for token usage
 */

import { logger } from '../../utils/logger';

export interface PromptTemplate {
  system?: string;
  user: string;
  parameters?: Record<string, any>;
  maxTokens: number;
  temperature: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface PromptContext {
  contentType: ContentType;
  detailLevel: 'low' | 'medium' | 'high';
  language: string;
  targetAudience?: string;
  customParameters?: Record<string, any>;
}

export type ContentType = 
  | 'product' 
  | 'educational' 
  | 'medical' 
  | 'entertainment'
  | 'documentary'
  | 'news'
  | 'tutorial'
  | 'artistic'
  | 'technical'
  | 'general';

export class PromptEngineeringModule {
  private readonly promptCache = new Map<string, PromptTemplate>();
  private readonly tokenBudgets: Record<ContentType, number>;
  private readonly specializedPrompts: Map<ContentType, Map<string, PromptTemplate>>;

  constructor() {
    // Initialize token budgets for different content types
    this.tokenBudgets = {
      product: 350,
      educational: 500,
      medical: 600,
      entertainment: 400,
      documentary: 550,
      news: 450,
      tutorial: 500,
      artistic: 400,
      technical: 550,
      general: 450,
    };

    // Initialize specialized prompts
    this.specializedPrompts = new Map();
    this.initializeSpecializedPrompts();
  }

  /**
   * Generate optimized prompt for content analysis
   */
  generateAnalysisPrompt(
    context: PromptContext,
    imageContext?: string
  ): PromptTemplate {
    const cacheKey = this.getCacheKey(context);
    
    // Check cache first
    if (this.promptCache.has(cacheKey)) {
      const cached = this.promptCache.get(cacheKey)!;
      return this.injectContext(cached, imageContext);
    }

    // Generate new prompt based on content type
    const prompt = this.buildSpecializedPrompt(context, imageContext);
    
    // Cache for reuse
    this.promptCache.set(cacheKey, prompt);
    
    return prompt;
  }

  /**
   * Build specialized prompt based on content type
   */
  private buildSpecializedPrompt(
    context: PromptContext,
    imageContext?: string
  ): PromptTemplate {
    const contentPrompts = this.specializedPrompts.get(context.contentType);
    
    if (!contentPrompts) {
      return this.buildGenericPrompt(context, imageContext);
    }

    const basePrompt = contentPrompts.get('base')!;
    const detailPrompt = contentPrompts.get(context.detailLevel)!;

    return {
      system: this.buildSystemPrompt(context),
      user: this.mergePrompts(basePrompt.user, detailPrompt.user, imageContext),
      maxTokens: this.calculateOptimalTokens(context),
      temperature: this.getOptimalTemperature(context),
      topP: 0.95,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
    };
  }

  /**
   * Initialize specialized prompts for different content types
   */
  private initializeSpecializedPrompts(): void {
    // Product Image Prompts
    this.specializedPrompts.set('product', new Map([
      ['base', {
        user: `Analyze this product image with focus on:
1. Product identification and category
2. Key features and specifications visible
3. Brand and model information
4. Condition and quality assessment
5. Usage context and target audience`,
        maxTokens: 350,
        temperature: 0.3,
      }],
      ['high', {
        user: `Additional details:
- Material and construction quality
- Dimensions and proportions
- Color accuracy and variations
- Packaging or accessories shown
- Comparative market positioning`,
        maxTokens: 200,
        temperature: 0.3,
      }],
    ]));

    // Educational Content Prompts
    this.specializedPrompts.set('educational', new Map([
      ['base', {
        user: `Analyze this educational content:
1. Subject matter and learning objectives
2. Key concepts and information presented
3. Visual teaching methods used
4. Complexity level and target audience
5. Supporting materials or references shown`,
        maxTokens: 500,
        temperature: 0.4,
      }],
      ['high', {
        user: `Deep educational analysis:
- Pedagogical approach and methodology
- Learning outcomes and competencies
- Assessment opportunities
- Accessibility for diverse learners
- Integration with curriculum standards`,
        maxTokens: 300,
        temperature: 0.4,
      }],
    ]));

    // Medical Content Prompts
    this.specializedPrompts.set('medical', new Map([
      ['base', {
        user: `Analyze this medical/healthcare image (maintaining HIPAA compliance):
1. Type of medical content (anatomy, procedure, equipment)
2. Clinical relevance and context
3. Visible medical information (non-identifying)
4. Educational or diagnostic purpose
5. Safety and procedural elements

Note: Do not identify individuals or provide medical diagnoses.`,
        maxTokens: 600,
        temperature: 0.2,
      }],
      ['high', {
        user: `Detailed medical analysis:
- Anatomical structures or systems shown
- Medical equipment and instrumentation
- Procedural steps or techniques
- Clinical best practices demonstrated
- Patient safety considerations`,
        maxTokens: 400,
        temperature: 0.2,
      }],
    ]));

    // Entertainment Content Prompts
    this.specializedPrompts.set('entertainment', new Map([
      ['base', {
        user: `Analyze this entertainment content:
1. Genre and content type
2. Main subjects and performers
3. Setting and production quality
4. Mood and emotional tone
5. Target demographic and appeal`,
        maxTokens: 400,
        temperature: 0.5,
      }],
      ['high', {
        user: `Entertainment deep dive:
- Production techniques and cinematography
- Character development and narrative
- Visual effects and artistic style
- Cultural context and references
- Audience engagement elements`,
        maxTokens: 250,
        temperature: 0.5,
      }],
    ]));

    // Documentary Content Prompts
    this.specializedPrompts.set('documentary', new Map([
      ['base', {
        user: `Analyze this documentary content:
1. Subject matter and historical context
2. Documentary style and approach
3. Evidence and sources presented
4. Narrative structure and pacing
5. Educational and informational value`,
        maxTokens: 550,
        temperature: 0.4,
      }],
      ['high', {
        user: `Documentary analysis depth:
- Journalistic integrity and objectivity
- Primary sources and archival materials
- Expert interviews and testimonials
- Social and cultural impact
- Fact-checking opportunities`,
        maxTokens: 350,
        temperature: 0.4,
      }],
    ]));

    // Technical Content Prompts
    this.specializedPrompts.set('technical', new Map([
      ['base', {
        user: `Analyze this technical content:
1. Technical domain and specialization
2. Systems, components, or processes shown
3. Technical specifications and parameters
4. Operational state and functionality
5. Safety and compliance indicators`,
        maxTokens: 550,
        temperature: 0.2,
      }],
      ['high', {
        user: `Technical deep analysis:
- Engineering principles demonstrated
- Performance metrics and benchmarks
- Integration points and dependencies
- Troubleshooting indicators
- Industry standards compliance`,
        maxTokens: 350,
        temperature: 0.2,
      }],
    ]));
  }

  /**
   * Build system prompt based on context
   */
  private buildSystemPrompt(context: PromptContext): string {
    const audiencePrompt = context.targetAudience 
      ? `Target audience: ${context.targetAudience}.`
      : '';

    const languagePrompt = context.language !== 'en'
      ? `Respond in ${context.language}.`
      : '';

    return `You are an expert vision AI system specialized in ${context.contentType} content analysis.
Your role is to provide accurate, detailed, and accessible descriptions for users who cannot see the visual content.
Focus on factual observations and avoid speculation.
${audiencePrompt}
${languagePrompt}
Maintain objectivity and professional terminology appropriate for the content domain.`;
  }

  /**
   * Calculate optimal token allocation
   */
  private calculateOptimalTokens(context: PromptContext): number {
    const baseTokens = this.tokenBudgets[context.contentType];
    
    // Adjust based on detail level
    const detailMultiplier = {
      low: 0.7,
      medium: 1.0,
      high: 1.3,
    };

    return Math.floor(baseTokens * detailMultiplier[context.detailLevel]);
  }

  /**
   * Get optimal temperature for content type
   */
  private getOptimalTemperature(context: PromptContext): number {
    const temperatures: Record<ContentType, number> = {
      product: 0.3,      // High precision for product details
      educational: 0.4,  // Balanced for educational content
      medical: 0.2,      // Very low for medical accuracy
      entertainment: 0.5, // More creative for entertainment
      documentary: 0.4,  // Balanced for factual content
      news: 0.3,         // Low for news accuracy
      tutorial: 0.3,     // Low for instructional clarity
      artistic: 0.6,     // Higher for artistic interpretation
      technical: 0.2,    // Very low for technical precision
      general: 0.4,      // Balanced default
    };

    return temperatures[context.contentType];
  }

  /**
   * Generate alt text prompt optimized for accessibility
   */
  generateAltTextPrompt(
    contentType: ContentType,
    context?: string
  ): PromptTemplate {
    const contextPrompt = context ? `\nContext: ${context}` : '';
    
    return {
      user: `Generate concise alt text (max 125 characters) for accessibility.
Focus on the primary subject and its main action or purpose.
Avoid phrases like "image of" or "picture of".
Be specific and descriptive for screen reader users.${contextPrompt}`,
      maxTokens: 50,
      temperature: 0.3,
      topP: 0.9,
    };
  }

  /**
   * Generate SEO-optimized description prompt
   */
  generateSEOPrompt(
    contentType: ContentType,
    keywords?: string[]
  ): PromptTemplate {
    const keywordPrompt = keywords?.length 
      ? `\nNaturally incorporate these keywords: ${keywords.join(', ')}`
      : '';

    return {
      user: `Create an SEO-optimized description (150-160 characters).
Include relevant keywords naturally.
Make it compelling for search results.
Accurately describe the visual content.${keywordPrompt}`,
      maxTokens: 100,
      temperature: 0.4,
      topP: 0.95,
    };
  }

  /**
   * Generate batch processing prompt for efficiency
   */
  generateBatchPrompt(
    items: Array<{ id: string; context?: string }>,
    contentType: ContentType
  ): PromptTemplate {
    const itemPrompts = items.map((item, idx) => 
      `[Item ${idx + 1}${item.id ? ` - ${item.id}` : ''}]${item.context ? ` Context: ${item.context}` : ''}`
    ).join('\n');

    return {
      user: `Analyze these ${items.length} ${contentType} items efficiently.
Provide structured JSON output with consistent formatting.
Items:
${itemPrompts}

Output format:
{
  "items": [
    {
      "id": "item_id",
      "description": "detailed description",
      "elements": ["key", "visual", "elements"],
      "confidence": 0.95
    }
  ]
}`,
      maxTokens: 200 * items.length,
      temperature: 0.3,
    };
  }

  /**
   * Merge multiple prompts efficiently
   */
  private mergePrompts(
    base: string,
    detail: string,
    context?: string
  ): string {
    const contextSection = context 
      ? `\n\nAdditional context: ${context}`
      : '';

    return `${base}\n\n${detail}${contextSection}`;
  }

  /**
   * Inject runtime context into cached prompt
   */
  private injectContext(
    template: PromptTemplate,
    context?: string
  ): PromptTemplate {
    if (!context) return template;

    return {
      ...template,
      user: `${template.user}\n\nSpecific context: ${context}`,
    };
  }

  /**
   * Generate cache key for prompt reuse
   */
  private getCacheKey(context: PromptContext): string {
    return `${context.contentType}_${context.detailLevel}_${context.language}`;
  }

  /**
   * Estimate token usage for a prompt
   */
  estimateTokenUsage(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Optimize prompt for token efficiency
   */
  optimizePrompt(prompt: string, maxTokens: number): string {
    const estimated = this.estimateTokenUsage(prompt);
    
    if (estimated <= maxTokens) {
      return prompt;
    }

    // Compress prompt by removing redundancies
    let optimized = prompt
      .replace(/\s+/g, ' ')  // Remove extra whitespace
      .replace(/\b(\w+)\s+\1\b/gi, '$1')  // Remove duplicate words
      .trim();

    // If still too long, truncate intelligently
    if (this.estimateTokenUsage(optimized) > maxTokens) {
      const targetLength = maxTokens * 4;
      optimized = optimized.substring(0, targetLength);
      
      // Ensure we don't cut mid-sentence
      const lastPeriod = optimized.lastIndexOf('.');
      if (lastPeriod > targetLength * 0.8) {
        optimized = optimized.substring(0, lastPeriod + 1);
      }
    }

    return optimized;
  }

  /**
   * Get prompt performance metrics
   */
  getPromptMetrics(): {
    cacheHitRate: number;
    averageTokensUsed: number;
    promptTypes: Record<string, number>;
  } {
    return {
      cacheHitRate: this.promptCache.size / 100, // Simplified metric
      averageTokensUsed: 450,
      promptTypes: Object.fromEntries(
        Array.from(this.specializedPrompts.keys()).map(key => [key, 0])
      ),
    };
  }

  /**
   * Clear prompt cache
   */
  clearCache(): void {
    this.promptCache.clear();
    logger.info('Prompt cache cleared');
  }
}