/**
 * AIOL (Artificial Intelligence Operating Logic) Core Type Definitions
 * 
 * Provides type-safe interfaces for modular component design,
 * ensuring data format awareness and Kernel interaction compliance.
 */

/**
 * Base AIOL Component Interface
 * All modular components must implement this interface
 */
export interface AIoLComponent<TInput, TOutput> {
  readonly id: string;
  readonly version: string;
  readonly metadata: ComponentMetadata;
  
  execute(input: TInput): Promise<TOutput>;
  validate(input: TInput): ValidationResult;
}

/**
 * Component Metadata for tracking and auditing
 */
export interface ComponentMetadata {
  name: string;
  description: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

/**
 * Validation result with detailed error information
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Detailed validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

/**
 * Affiliate Feed Data Format
 */
export interface AffiliateFeedData {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly imageUrl?: string;
  readonly affiliateLink: string;
  readonly commission: number;
  readonly category: string;
  readonly publishedAt: Date;
  readonly metadata: Record<string, unknown>;
}

/**
 * Feed Processing Result
 */
export interface FeedProcessingResult {
  readonly totalProcessed: number;
  readonly successful: number;
  readonly failed: number;
  readonly errors: FeedError[];
  readonly processedAt: Date;
}

/**
 * Feed-specific error tracking
 */
export interface FeedError {
  readonly feedId: string;
  readonly error: string;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;
}

/**
 * Cache metadata for tracking cache operations
 */
export interface CacheMetadata {
  readonly key: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly hitCount: number;
}

/**
 * Result wrapper for all operations
 */
export interface OperationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: OperationError;
  readonly metadata: {
    readonly executionTime: number;
    readonly timestamp: Date;
  };
}

/**
 * Structured error format for operations
 */
export interface OperationError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
}
