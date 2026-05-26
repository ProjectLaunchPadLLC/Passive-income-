/**
 * Base AIOL Component Abstract Class
 * 
 * Provides foundation for all modular components with:
 * - Lifecycle management
 * - Built-in validation
 * - Error handling
 * - Logging capabilities
 */

import type { AIoLComponent, ComponentMetadata, ValidationResult, ValidationError, OperationResult, OperationError } from '../types/aiol';

export abstract class BaseAIoLComponent<TInput, TOutput> implements AIoLComponent<TInput, TOutput> {
  readonly id: string;
  readonly version: string;
  readonly metadata: ComponentMetadata;

  protected logger: Console;

  constructor(id: string, version: string, metadata: Omit<ComponentMetadata, 'createdAt' | 'updatedAt'>) {
    this.id = id;
    this.version = version;
    this.metadata = {
      ...metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.logger = console;
  }

  /**
   * Execute the component with input validation and error handling
   */
  async execute(input: TInput): Promise<TOutput> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`[${this.id}] Starting execution`);
      
      const validation = this.validate(input);
      if (!validation.isValid) {
        throw this.createValidationError(validation.errors);
      }

      const result = await this.process(input);
      
      this.logger.debug(`[${this.id}] Execution completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      this.logger.error(`[${this.id}] Execution failed:`, error);
      throw error;
    }
  }

  /**
   * Validate input data
   * @abstract Must be implemented by subclasses
   */
  abstract validate(input: TInput): ValidationResult;

  /**
   * Process input and return output
   * @abstract Must be implemented by subclasses
   */
  protected abstract process(input: TInput): Promise<TOutput>;

  /**
   * Helper to create validation errors
   */
  protected createValidationError(errors: ValidationError[]): Error {
    const message = errors.map(e => `${e.field}: ${e.message}`).join('; ');
    const error = new Error(`Validation failed: ${message}`);
    (error as any).validationErrors = errors;
    return error;
  }

  /**
   * Create a successful operation result
   */
  protected createSuccessResult(data: TOutput): OperationResult<TOutput> {
    return {
      success: true,
      data,
      metadata: {
        executionTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Create a failed operation result
   */
  protected createErrorResult(code: string, message: string, retryable: boolean = false): OperationResult<null> {
    return {
      success: false,
      error: {
        code,
        message,
        retryable,
      },
      metadata: {
        executionTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Update component metadata
   */
  protected updateMetadata(updates: Partial<ComponentMetadata>): void {
    Object.assign(this.metadata, {
      ...updates,
      updatedAt: new Date(),
    });
  }
}
