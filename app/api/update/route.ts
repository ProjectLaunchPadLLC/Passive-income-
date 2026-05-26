/**
 * API Route: Feed Update Handler
 * 
 * Processes feed updates through AIOL Kernel components
 * with comprehensive error handling and audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { KernelOrchestrator } from '@/lib/core/KernelOrchestrator';
import { AffiliateComponent } from '@/lib/components/AffiliateComponent';
import { FeedComponent } from '@/lib/components/FeedComponent';
import type { OperationResult } from '@/lib/types/aiol';

// Initialize Kernel with components
const kernel = new KernelOrchestrator({
  enableAuditLogging: true,
  enableMetricsCollection: true,
  maxConcurrentOperations: 5,
});

// Register components
const affiliateComponent = new AffiliateComponent();
const feedComponent = new FeedComponent();

kernel.registerComponent(affiliateComponent);
kernel.registerComponent(feedComponent);

/**
 * Request body interface
 */
interface UpdateRequest {
  feedUrls?: string[];
  categories?: string[];
  minCommission?: number;
  cacheTTL?: number;
  parseTimeout?: number;
}

/**
 * Handler for POST requests
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: UpdateRequest = await request.json();

    // Validate request
    if (!body.feedUrls || body.feedUrls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FEED_URLS',
            message: 'At least one feed URL is required',
          },
        },
        { status: 400 }
      );
    }

    // Step 1: Process feeds through FeedComponent
    const feedResult: OperationResult<any> = await kernel.executeComponent(
      'feed-processor',
      {
        feedUrls: body.feedUrls,
        cacheTTL: body.cacheTTL ?? 3600000, // 1 hour default
        parseTimeout: body.parseTimeout ?? 5000, // 5 seconds default
        includeMetadata: true,
      }
    );

    if (!feedResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: feedResult.error,
          phase: 'feed-processing',
        },
        { status: 500 }
      );
    }

    // Step 2: Process through AffiliateComponent
    const affiliateResult: OperationResult<any> = await kernel.executeComponent(
      'affiliate-processor',
      {
        feeds: feedResult.data?.items ?? [],
        categories: body.categories ?? ['general'],
        minCommission: body.minCommission ?? 0,
      }
    );

    if (!affiliateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: affiliateResult.error,
          phase: 'affiliate-processing',
        },
        { status: 500 }
      );
    }

    // Step 3: Compile results
    const response = {
      success: true,
      data: {
        processedFeeds: affiliateResult.data?.processedFeeds ?? [],
        statistics: {
          totalFeedsProcessed: feedResult.data?.result.totalProcessed ?? 0,
          successfulFeeds: feedResult.data?.result.successful ?? 0,
          failedFeeds: feedResult.data?.result.failed ?? 0,
          validAffiliateFeeds: affiliateResult.data?.validCount ?? 0,
          cachedItems: feedResult.data?.cachedItems ?? 0,
        },
        executionMetrics: {
          feedProcessingTime: feedResult.metadata.executionTime,
          affiliateProcessingTime: affiliateResult.metadata.executionTime,
          totalExecutionTime: feedResult.metadata.executionTime + affiliateResult.metadata.executionTime,
        },
      },
      systemHealth: kernel.getHealthReport(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error processing update request:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Handler for GET requests - returns system diagnostics
 */
export async function GET(): Promise<NextResponse> {
  try {
    const health = kernel.getHealthReport();
    const auditLogs = kernel.getAuditLogs(undefined, 10); // Last 10 logs

    return NextResponse.json({
      success: true,
      systemStatus: health,
      registeredComponents: kernel.getRegisteredComponents(),
      recentAuditLogs: auditLogs.map(log => ({
        component: log.componentId,
        timestamp: log.timestamp,
        success: log.success,
        executionTime: log.executionTime,
        error: log.error,
      })),
    });
  } catch (error) {
    console.error('Error retrieving diagnostics:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DIAGNOSTIC_ERROR',
          message: 'Failed to retrieve system diagnostics',
        },
      },
      { status: 500 }
    );
  }
}
