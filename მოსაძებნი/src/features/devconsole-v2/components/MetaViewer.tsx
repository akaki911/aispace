// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { LogEntry } from '../../contexts/DevConsoleContext.types';

interface MetaViewerProps {
  log: LogEntry;
  onClose: () => void;
}

interface RequestContext {
  method?: string;
  url?: string;
  endpoint?: string;
  requestBody?: any;
  statusCode?: number;
  headers?: any;
  userId?: string;
  aiModel?: string;
  requestId?: string;
  responseTime?: number;
  correlationId?: string; // Added for correlation ID
}

export const MetaViewer: React.FC<MetaViewerProps> = ({ log, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [correlationCopied, setCorrelationCopied] = useState(false); // State for correlation ID copy

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  // Extract request context from metadata, including correlationId
  const extractRequestContext = (meta: any): RequestContext => {
    if (!meta) return {};

    const context: RequestContext = {};

    // Direct fields
    if (meta.method) context.method = meta.method;
    if (meta.url) context.url = meta.url;
    if (meta.endpoint) context.endpoint = meta.endpoint;
    if (meta.requestBody || meta.body) context.requestBody = meta.requestBody || meta.body;
    if (meta.statusCode || meta.status) context.statusCode = meta.statusCode || meta.status;
    if (meta.headers) context.headers = meta.headers;
    if (meta.userId || meta.user_id) context.userId = meta.userId || meta.user_id;
    if (meta.aiModel || meta.model) context.aiModel = meta.aiModel || meta.model;
    if (meta.requestId || meta.id || meta.req_id) context.requestId = meta.requestId || meta.id || meta.req_id;
    if (meta.responseTime || meta.ms) context.responseTime = meta.responseTime || meta.ms;
    if (meta.correlationId || meta.correlation_id) context.correlationId = meta.correlationId || meta.correlation_id; // Extract correlationId

    // Check nested objects
    if (meta.request) {
      const req = meta.request;
      if (req.method) context.method = req.method;
      if (req.url) context.url = req.url;
      if (req.body) context.requestBody = req.body;
      if (req.headers) context.headers = req.headers;
      if (req.correlationId) context.correlationId = req.correlationId; // Extract correlationId from request
    }

    if (meta.response) {
      const res = meta.response;
      if (res.status || res.statusCode) context.statusCode = res.status || res.statusCode;
      if (res.headers) context.headers = { ...context.headers, ...res.headers };
    }

    return context;
  };

  const requestContext = extractRequestContext(log.meta);
  const hasRequestContext = Object.keys(requestContext).length > 0;
  const displayCorrelationId = log.correlationId || requestContext.correlationId; // Use log's correlationId or extracted one

  const copyMetadata = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log.meta, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy metadata:', err);
    }
  };

  const copyFullEntry = async () => {
    const fullEntry = {
      timestamp: new Date(log.ts || Date.now()).toISOString(),
      source: log.source || 'unknown',
      level: log.level || 'log',
      message: log.message || 'No message',
      ...(log.meta && { meta: log.meta })
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(fullEntry, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy full entry:', error);
    }
  };

  const copyErrorContext = async () => {
    const errorContext = {
      message: log.message,
      level: log.level,
      timestamp: new Date(log.ts || Date.now()).toISOString(),
      requestContext,
      ...(log.meta && { rawMeta: log.meta })
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(errorContext, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy error context:', error);
    }
  };

  // Copy Correlation ID
  const copyCorrelationId = async () => {
    if (displayCorrelationId) {
      try {
        await navigator.clipboard.writeText(displayCorrelationId);
        setCorrelationCopied(true);
        setTimeout(() => setCorrelationCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy correlation ID:', error);
      }
    }
  };

  const copyRequestId = async () => {
    if (requestContext.requestId) {
      try {
        await navigator.clipboard.writeText(requestContext.requestId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy request ID:', error);
      }
    }
  };

  const truncateValue = (value: any, maxLength: number = 200): string => {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  };

  const renderValue = (key: string, value: any) => {
    if (value === undefined || value === null) {
      return <span className="text-gray-400 italic">Not captured</span>;
    }

    // Special handling for request body
    if (key === 'requestBody' && typeof value === 'object') {
      return (
        <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs font-mono">
          <pre className="whitespace-pre-wrap break-words">
            {truncateValue(value, 300)}
          </pre>
        </div>
      );
    }

    // Special handling for correlation ID
    if (key === 'correlationId' && value) {
      return (
        <div className="flex items-center space-x-2">
          <span className="font-mono text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
            {value}
          </span>
          <button
            onClick={copyCorrelationId}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 transition-colors px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/50"
          >
            {correlationCopied ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
      );
    }

    // Default handling
    return <span className="font-mono text-sm">{truncateValue(value)}</span>;
  };

  if (!log.meta || Object.keys(log.meta).length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-85 backdrop-blur-sm"
      style={{
        zIndex: 999999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto'
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-300 dark:border-blue-500 shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          zIndex: 1000000,
          position: 'relative',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          pointerEvents: 'auto'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-gray-700 dark:to-gray-600 border-b border-blue-200 dark:border-gray-500 rounded-t-lg flex-shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm flex items-center">
              📊 Metadata Details
            </span>
            <span className="px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium border border-blue-300 dark:border-blue-700">
              {Object.keys(log.meta).length} field{Object.keys(log.meta).length !== 1 ? 's' : ''}
            </span>
            {hasRequestContext && (
              <span className="px-2 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-full text-xs font-medium border border-green-300 dark:border-green-700">
                🧾 Request Context
              </span>
            )}
            {/* Display Correlation ID in Header */}
            {displayCorrelationId && (
              <div className="flex items-center space-x-2 bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded-md">
                <span className="text-xs font-mono text-purple-800 dark:text-purple-200">
                  CID: {displayCorrelationId.substring(0, 8)}...
                </span>
                <button
                  onClick={copyCorrelationId}
                  className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 transition-colors"
                  title="Copy full correlation ID"
                >
                  {correlationCopied ? '✅' : '📋'}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-200 dark:bg-gray-600 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                className={`px-3 py-1 text-xs transition-all ${
                  viewMode === 'formatted'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                📋 Formatted
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1 text-xs transition-all ${
                  viewMode === 'raw'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                🔧 Raw JSON
              </button>
            </div>

            {/* Copy Buttons */}
            <button
              type="button"
              onClick={copyMetadata}
              className="text-gray-600 hover:text-blue-700 dark:text-gray-300 dark:hover:text-blue-400 transition-all duration-200 p-2 rounded-md hover:bg-blue-200 dark:hover:bg-gray-600 border border-transparent hover:border-blue-300"
              title="Copy metadata only"
            >
              {copied ? '✅' : '📋'}
            </button>
            <button
              type="button"
              onClick={copyFullEntry}
              className="text-gray-600 hover:text-green-700 dark:text-gray-300 dark:hover:text-green-400 transition-all duration-200 p-2 rounded-md hover:bg-green-200 dark:hover:bg-gray-600 border border-transparent hover:border-green-300"
              title="Copy full log entry"
            >
              📄
            </button>
            {hasRequestContext && (
              <button
                type="button"
                onClick={copyErrorContext}
                className="text-gray-600 hover:text-orange-700 dark:text-gray-300 dark:hover:text-orange-400 transition-all duration-200 p-2 rounded-md hover:bg-orange-200 dark:hover:bg-gray-600 border border-transparent hover:border-orange-300"
                title="Copy error context"
              >
                🚨
              </button>
            )}
            {requestContext.requestId && (
              <button
                type="button"
                onClick={copyRequestId}
                className="text-gray-600 hover:text-purple-700 dark:text-gray-300 dark:hover:text-purple-400 transition-all duration-200 p-2 rounded-md hover:bg-purple-200 dark:hover:bg-gray-600 border border-transparent hover:border-purple-300"
                title="Copy request ID only"
              >
                🔑
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 transition-all duration-200 p-2 rounded-md hover:bg-red-100 dark:hover:bg-gray-600 border border-transparent hover:border-red-300 font-bold text-lg leading-none"
              title="Close metadata view (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Log Info Bar */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs">
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 dark:text-gray-400">
              <strong>Timestamp:</strong> {new Date(log.ts || Date.now()).toLocaleString()}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              <strong>Source:</strong> {log.source || 'unknown'}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              <strong>Level:</strong> {log.level || 'log'}
            </span>
          </div>
          {log.message && (
            <div className="mt-1 text-gray-700 dark:text-gray-300">
              <strong>Message:</strong> {log.message}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border-2 border-blue-200 dark:border-blue-700 shadow-inner overflow-auto">

            {/* Correlation ID Section - Always visible if present in formatted view */}
            {displayCorrelationId && viewMode === 'formatted' && (
              <div className="p-4 mb-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center">
                  🔗 Correlation Tracking
                </h3>
                <div className="text-sm">
                  <div>
                    <strong className="text-purple-600 dark:text-purple-400">Correlation ID:</strong><br />
                    {renderValue('correlationId', displayCorrelationId)}
                  </div>
                  <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                    Use this ID to trace the complete request flow across UI → Backend → AI Service
                  </div>
                </div>
              </div>
            )}

            {/* Request Context Section */}
            {hasRequestContext && viewMode === 'formatted' && (
              <div className="p-4 mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                  🧾 Request Details
                  {requestContext.requestId && (
                    <span className="ml-2 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs font-mono">
                      ID: {requestContext.requestId}
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <strong className="text-gray-600 dark:text-gray-400">HTTP Method:</strong><br />
                    {renderValue('method', requestContext.method)}
                  </div>
                  <div>
                    <strong className="text-gray-600 dark:text-gray-400">Status Code:</strong><br />
                    {requestContext.statusCode ? (
                      <span className={`font-mono font-semibold ${
                        requestContext.statusCode >= 400 ? 'text-red-600 dark:text-red-400' :
                        requestContext.statusCode >= 300 ? 'text-orange-600 dark:text-orange-400' :
                        'text-green-600 dark:text-green-400'
                      }`}>
                        {requestContext.statusCode}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Not captured</span>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <strong className="text-gray-600 dark:text-gray-400">URL/Endpoint:</strong><br />
                    {renderValue('url', requestContext.url || requestContext.endpoint)}
                  </div>
                  <div>
                    <strong className="text-gray-600 dark:text-gray-400">User ID:</strong><br />
                    {renderValue('userId', requestContext.userId)}
                  </div>
                  <div>
                    <strong className="text-gray-600 dark:text-gray-400">AI Model:</strong><br />
                    {renderValue('aiModel', requestContext.aiModel)}
                  </div>
                  {requestContext.responseTime && (
                    <div>
                      <strong className="text-gray-600 dark:text-gray-400">Response Time:</strong><br />
                      <span className="font-mono text-sm">{requestContext.responseTime}ms</span>
                    </div>
                  )}
                  {requestContext.requestBody && (
                    <div className="md:col-span-2">
                      <strong className="text-gray-600 dark:text-gray-400">Request Body:</strong><br />
                      {renderValue('requestBody', requestContext.requestBody)}
                    </div>
                  )}
                  {requestContext.headers && (
                    <div className="md:col-span-2">
                      <strong className="text-gray-600 dark:text-gray-400">Headers:</strong><br />
                      {renderValue('headers', requestContext.headers)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Metadata Content */}
            <div className="p-4">
              {viewMode === 'formatted' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    📋 Raw Metadata
                  </h3>
                  <pre
                    className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words"
                    style={{
                      fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", "Ubuntu Mono", monospace',
                      lineHeight: '1.5'
                    }}
                  >
                    {JSON.stringify(log.meta, null, 2)}
                  </pre>
                </div>
              )}

              {viewMode === 'raw' && (
                <pre
                  className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words"
                  style={{
                    fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", "Ubuntu Mono", monospace',
                    lineHeight: '1.5'
                  }}
                >
                  {JSON.stringify({
                    ...log,
                    correlationId: displayCorrelationId // Ensure correlationId is in the raw output
                  }, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};