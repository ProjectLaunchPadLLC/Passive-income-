/**
 * Affiliate Management Component
 * 
 * AIOL-compliant component for handling affiliate feed data,
 * processing, and monetization logic.
 */

import { BaseAIoLComponent } from '../core/BaseAIoLComponent';
import type {
  AffiliateFeedData,
  ValidationResult,
  ValidationError,
} from '../types/aiol';

export interface AffiliateProcessInput {
  feeds: unknown[];
  categories: string[];
  minCommission: number;
}

export interface AffiliateProcessOutput {
  processedFeeds: AffiliateFeedData[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
}

export class AffiliateComponent extends BaseAIoLComponent<
  AffiliateProcessInput,
  AffiliateProcessOutput
> {
  private readonly MAX_FEEDS_PER_BATCH = 100;
  private readonly MIN_VALID_FIELDS = 6;

  constructor() {
    super('affiliate-processor', '1.0.0', {
      name: 'Affiliate Feed Processor',
      description: 'Processes and validates affiliate feeds with commission tracking',
      author: 'ProjectLaunchPad',
      tags: ['monetization', 'feeds', 'affiliate'],
    });
  }

  /**
   * Validate affiliate processing input
   */
  validate(input: AffiliateProcessInput): ValidationResult {
    const errors: ValidationError[] = [];

    if (!Array.isArray(input.feeds)) {
      errors.push({
        field: 'feeds',
        message: 'Feeds must be an array',
        code: 'INVALID_TYPE',
        severity: 'error',
      });
    } else if (input.feeds.length > this.MAX_FEEDS_PER_BATCH) {
      errors.push({
        field: 'feeds',
        message: `Maximum ${this.MAX_FEEDS_PER_BATCH} feeds per batch`,
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
      });
    }

    if (!Array.isArray(input.categories) || input.categories.length === 0) {
      errors.push({
        field: 'categories',
        message: 'At least one category is required',
        code: 'MISSING_REQUIRED',
        severity: 'error',
      });
    }

    if (typeof input.minCommission !== 'number' || input.minCommission < 0) {
      errors.push({
        field: 'minCommission',
        message: 'Minimum commission must be a non-negative number',
        code: 'INVALID_VALUE',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Process affiliate feeds
   */
  protected async process(
    input: AffiliateProcessInput
  ): Promise<AffiliateProcessOutput> {
    const processedFeeds: AffiliateFeedData[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const feed of input.feeds) {
      try {
        const validatedFeed = this.validateAndTransformFeed(feed, input);
        if (validatedFeed) {
          processedFeeds.push(validatedFeed);
          validCount++;
        } else {
          invalidCount++;
        }
      } catch (error) {
        this.logger.warn(`Failed to process feed:`, error);
        invalidCount++;
      }
    }

    return {
      processedFeeds,
      totalCount: input.feeds.length,
      validCount,
      invalidCount,
    };
  }

  /**
   * Validate and transform individual feed
   */
  private validateAndTransformFeed(
    feed: unknown,
    input: AffiliateProcessInput
  ): AffiliateFeedData | null {
    if (typeof feed !== 'object' || feed === null) {
      return null;
    }

    const feedObj = feed as Record<string, unknown>;

    // Check required fields
    const requiredFields = ['id', 'title', 'url', 'affiliateLink'];
    if (!requiredFields.every(field => field in feedObj)) {
      return null;
    }

    // Check category
    const category = String(feedObj.category || '');
    if (!input.categories.includes(category)) {
      return null;
    }

    // Check commission
    const commission = Number(feedObj.commission || 0);
    if (commission < input.minCommission) {
      return null;
    }

    // Transform to proper format
    return {
      id: String(feedObj.id),
      title: String(feedObj.title),
      description: String(feedObj.description || ''),
      url: String(feedObj.url),
      imageUrl: feedObj.imageUrl ? String(feedObj.imageUrl) : undefined,
      affiliateLink: String(feedObj.affiliateLink),
      commission,
      category,
      publishedAt: feedObj.publishedAt instanceof Date 
        ? feedObj.publishedAt 
        : new Date(),
      metadata: feedObj.metadata as Record<string, unknown> || {},
    };
  }
}
