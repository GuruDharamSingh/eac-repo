import { NextResponse } from 'next/server';

/**
 * Standardized API response types
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a successful API response
 *
 * @example
 * return apiSuccess({ user: { id: '123', name: 'John' } });
 * // { success: true, data: { user: { id: '123', name: 'John' } } }
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Create an error API response
 *
 * @example
 * return apiError('User not found', 404);
 * // { success: false, error: 'User not found' }
 */
export function apiError(
  message: string,
  status = 500,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ success: false, error: message, ...(code && { code }) }, { status });
}

/**
 * Common error responses
 */
export const ApiErrors = {
  unauthorized: () => apiError('Unauthorized', 401, 'UNAUTHORIZED'),
  forbidden: () => apiError('Forbidden', 403, 'FORBIDDEN'),
  notFound: (resource = 'Resource') => apiError(`${resource} not found`, 404, 'NOT_FOUND'),
  badRequest: (message = 'Bad request') => apiError(message, 400, 'BAD_REQUEST'),
  serverError: (message = 'Internal server error') => apiError(message, 500, 'SERVER_ERROR'),
} as const;
