/**
 * Kernel Orchestrator
 * 
 * Central coordination hub for AIOL components.
 * Manages component lifecycle, inter-component communication,
 * and ensures ethical operation through audit logging.
 */

import type { AIoLComponent, OperationResult } from '../types/aiol';

export interface ComponentRegistry {
  [componentId: string]: AIoLComponent<unknown, unknown>;
}

export interface OrchestratorConfig {
  enableAuditLogging: boolean;
  enableMetricsCollection: boolean;
  maxConcurrentOperations: number;
}

export interface ExecutionAuditLog {
  componentId: string;
  timestamp: Date;
  input: unknown;
  output: unknown;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface ComponentMetrics {
  componentId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecuted: Date | null;
}

export class KernelOrchestrator {
  private registry: ComponentRegistry = {};
  private auditLog: ExecutionAuditLog[] = [];
  private metrics: Map<string, ComponentMetrics> = new Map();
  private config: OrchestratorConfig;
  private activeOperations = 0;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      enableAuditLogging: true,
      enableMetricsCollection: true,
      maxConcurrentOperations: 10,
      ...config,
    };
  }

  /**
   * Register a component with the Kernel
   */
  registerComponent<TInput, TOutput>(
    component: AIoLComponent<TInput, TOutput>
  ): void {
    if (this.registry[component.id]) {
      console.warn(`Component ${component.id} already registered, overwriting`);
    }

    this.registry[component.id] = component;
    this.initializeMetrics(component.id);
    console.info(`Component registered: ${component.id} v${component.version}`);
  }

  /**
   * Execute a component through the Kernel
   */
  async executeComponent<TInput, TOutput>(
    componentId: string,
    input: TInput
  ): Promise<OperationResult<TOutput>> {
    const component = this.registry[componentId] as
      | AIoLComponent<TInput, TOutput>
      | undefined;

    if (!component) {
      return {
        success: false,
        error: {
          code: 'COMPONENT_NOT_FOUND',
          message: `Component ${componentId} not found in registry`,
          retryable: false,
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date(),
        },
      };
    }

    // Check concurrency limit
    if (this.activeOperations >= this.config.maxConcurrentOperations) {
      return {
        success: false,
        error: {
          code: 'CONCURRENT_LIMIT_EXCEEDED',
          message: `Maximum concurrent operations (${this.config.maxConcurrentOperations}) exceeded`,
          retryable: true,
        },
        metadata: {
          executionTime: 0,
          timestamp: new Date(),
        },
      };
    }

    this.activeOperations++;
    const startTime = Date.now();

    try {
      const output = await component.execute(input);
      const executionTime = Date.now() - startTime;

      if (this.config.enableAuditLogging) {
        this.logExecution(componentId, input, output, executionTime, true);
      }

      if (this.config.enableMetricsCollection) {
        this.recordMetrics(componentId, executionTime, true);
      }

      return {
        success: true,
        data: output,
        metadata: {
          executionTime,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.config.enableAuditLogging) {
        this.logExecution(componentId, input, null, executionTime, false, errorMessage);
      }

      if (this.config.enableMetricsCollection) {
        this.recordMetrics(componentId, executionTime, false);
      }

      return {
        success: false,
        error: {
          code: 'COMPONENT_EXECUTION_ERROR',
          message: errorMessage,
          retryable: true,
        },
        metadata: {
          executionTime,
          timestamp: new Date(),
        },
      };
    } finally {
      this.activeOperations--;
    }
  }

  /**
   * Get all registered components
   */
  getRegisteredComponents(): string[] {
    return Object.keys(this.registry);
  }

  /**
   * Get component metadata
   */
  getComponentMetadata(componentId: string) {
    const component = this.registry[componentId];
    return component?.metadata || null;
  }

  /**
   * Get component metrics
   */
  getComponentMetrics(componentId: string): ComponentMetrics | null {
    return this.metrics.get(componentId) || null;
  }

  /**
   * Get all audit logs with optional filtering
   */
  getAuditLogs(
    componentId?: string,
    limit?: number
  ): ExecutionAuditLog[] {
    let logs = this.auditLog;

    if (componentId) {
      logs = logs.filter(log => log.componentId === componentId);
    }

    if (limit) {
      logs = logs.slice(-limit);
    }

    return logs;
  }

  /**
   * Clear audit logs (use with caution)
   */
  clearAuditLogs(componentId?: string): void {
    if (componentId) {
      this.auditLog = this.auditLog.filter(log => log.componentId !== componentId);
    } else {
      this.auditLog = [];
    }
  }

  /**
   * Initialize metrics for a component
   */
  private initializeMetrics(componentId: string): void {
    this.metrics.set(componentId, {
      componentId,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      lastExecuted: null,
    });
  }

  /**
   * Record execution metrics
   */
  private recordMetrics(
    componentId: string,
    executionTime: number,
    success: boolean
  ): void {
    const metrics = this.metrics.get(componentId);
    if (!metrics) return;

    metrics.totalExecutions++;
    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }

    const oldAverage = metrics.averageExecutionTime;
    metrics.averageExecutionTime =
      (oldAverage * (metrics.totalExecutions - 1) + executionTime) /
      metrics.totalExecutions;

    metrics.lastExecuted = new Date();
  }

  /**
   * Log execution for audit trail
   */
  private logExecution(
    componentId: string,
    input: unknown,
    output: unknown,
    executionTime: number,
    success: boolean,
    error?: string
  ): void {
    this.auditLog.push({
      componentId,
      timestamp: new Date(),
      input,
      output,
      executionTime,
      success,
      error,
    });
  }

  /**
   * Generate system health report
   */
  getHealthReport(): {
    registeredComponents: number;
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    activeOperations: number;
  } {
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let totalExecutionTime = 0;

    for (const metrics of this.metrics.values()) {
      totalExecutions += metrics.totalExecutions;
      successfulExecutions += metrics.successfulExecutions;
      totalExecutionTime += metrics.averageExecutionTime * metrics.totalExecutions;
    }

    return {
      registeredComponents: Object.keys(this.registry).length,
      totalExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      averageExecutionTime: totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
      activeOperations: this.activeOperations,
    };
  }
}
