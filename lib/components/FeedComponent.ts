/**
 * Feed Processing Component
 * 
 * AIOL-compliant component for fetching, parsing, and caching
 * RSS feeds with robust error handling.
 */

import { BaseAIoLComponent } from '../core/BaseAIoLComponent';
import type {
  ValidationResult,
  FeedProcessingResult,
  FeedError,
  CacheMetadata,
  ValidationError,
} from '../types/aiol';

export interface FeedProcessInput {
  feedUrls: string[];
  cacheTTL: number; // Time to live in milliseconds
  parseTimeout: number;
  includeMetadata: boolean;
}

export interface FeedItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: Date;
  categories?: string[];
}

export interface FeedProcessOutput {
  items: FeedItem[];
  result: FeedProcessingResult;
  cachedItems: number;
}

export class FeedComponent extends BaseAIoLComponent<
  FeedProcessInput,
  FeedProcessOutput
> {
  private cache: Map<string, { data: FeedItem[]; metadata: CacheMetadata }> = new Map();
  private readonly MAX_URLS = 50;
  private readonly MIN_TTL = 60000; // 1 minute
  private readonly MAX_TTL = 86400000; // 24 hours

  constructor() {
    super('feed-processor', '1.0.0', {
      name: 'Feed Processing Component',
      description: 'Fetches, parses, and caches RSS/Atom feeds',
      author: 'ProjectLaunchPad',
      tags: ['feeds', 'rss', 'caching', 'data-aggregation'],
    });
  }

  /**
   * Validate feed processing input
   */
  validate(input: FeedProcessInput): ValidationResult {
    const errors: ValidationError[] = [];

    if (!Array.isArray(input.feedUrls) || input.feedUrls.length === 0) {
      errors.push({
        field: 'feedUrls',
        message: 'At least one feed URL is required',
        code: 'MISSING_REQUIRED',
        severity: 'error',
      });
    } else if (input.feedUrls.length > this.MAX_URLS) {
      errors.push({
        field: 'feedUrls',
        message: `Maximum ${this.MAX_URLS} URLs per batch`,
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
      });
    } else {
      const invalidUrls = input.feedUrls.filter(url => !this.isValidUrl(url));
      if (invalidUrls.length > 0) {
        errors.push({
          field: 'feedUrls',
          message: `${invalidUrls.length} invalid URLs found`,
          code: 'INVALID_FORMAT',
          severity: 'error',
        });
      }
    }

    if (typeof input.cacheTTL !== 'number' || input.cacheTTL < this.MIN_TTL || input.cacheTTL > this.MAX_TTL) {
      errors.push({
        field: 'cacheTTL',
        message: `Cache TTL must be between ${this.MIN_TTL}ms and ${this.MAX_TTL}ms`,
        code: 'INVALID_VALUE',
        severity: 'error',
      });
    }

    if (typeof input.parseTimeout !== 'number' || input.parseTimeout < 1000) {
      errors.push({
        field: 'parseTimeout',
        message: 'Parse timeout must be at least 1000ms',
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
   * Process feeds with caching strategy
   */
  protected async process(
    input: FeedProcessInput
  ): Promise<FeedProcessOutput> {
    const errors: FeedError[] = [];
    const allItems: FeedItem[] = [];
    let cachedItems = 0;
    let successful = 0;
    let failed = 0;

    for (const url of input.feedUrls) {
      try {
        const cacheHit = this.getFromCache(url);
        
        if (cacheHit) {
          allItems.push(...cacheHit);
          cachedItems++;
          successful++;
          this.logger.debug(`[${this.id}] Cache hit for ${url}`);
          continue;
        }

        // Simulate feed fetching (replace with actual implementation)
        const items = await this.fetchFeed(url, input.parseTimeout);
        this.setCache(url, items, input.cacheTTL);
        allItems.push(...items);
        successful++;
      } catch (error) {
        failed++;
        errors.push({
          feedId: url,
          error: String(error),
          timestamp: new Date(),
        });
        this.logger.error(`Failed to process feed ${url}:`, error);
      }
    }

    return {
      items: allItems,
      cachedItems,
      result: {
        totalProcessed: input.feedUrls.length,
        successful,
        failed,
        errors,
        processedAt: new Date(),
      },
    };
  }

  /**
   * Fetch and parse a single feed
   */
  private async fetchFeed(url: string, timeout: number): Promise<FeedItem[]> {
    // This is a placeholder - in production, use rss-parser or similar
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Feed fetch timeout after ${timeout}ms`)),
        timeout
      );

      try {
        // Simulate async feed fetching
        clearTimeout(timer);
        resolve([]);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Get items from cache
   */
  private getFromCache(url: string): FeedItem[] | null {
    const cached = this.cache.get(url);
    
    if (!cached) return null;

    if (cached.metadata.expiresAt < new Date()) {
      this.cache.delete(url);
      return null;
    }

    cached.metadata.hitCount++;
    return cached.data;
  }

  /**
   * Store items in cache
   */
  private setCache(url: string, items: FeedItem[], ttl: number): void {
    const expiresAt = new Date(Date.now() + ttl);
    this.cache.set(url, {
      data: items,
      metadata: {
        key: url,
        expiresAt,
        createdAt: new Date(),
        hitCount: 0,
      },
    });
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear expired cache entries
   */
  public cleanupCache(): void {
    const now = new Date();
    for (const [key, value] of this.cache.entries()) {
      if (value.metadata.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitCount: number } {
    let hitCount = 0;
    for (const [, value] of this.cache.entries()) {
      hitCount += value.metadata.hitCount;
    }
    return { size: this.cache.size, hitCount };
  }
}
