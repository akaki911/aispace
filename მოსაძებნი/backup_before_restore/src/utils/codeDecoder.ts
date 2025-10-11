/**
 * Utility functions for handling code content
 */

export interface CodeDecodeResult {
  success: boolean;
  content: string;
  language?: string;
  error?: string;
}

/**
 * Decodes code content from various formats
 * Now handles raw content directly since backend returns plain text
 */
export function decodeCodeContent(rawContent: string, fileName?: string): CodeDecodeResult {
  try {
    if (typeof rawContent !== 'string') {
      return {
        success: false,
        content: '',
        error: 'Content must be a string'
      };
    }

    // Content is already raw from backend, no need to decode
    const content = rawContent;

    if (!content.trim()) {
      return {
        success: true,
        content: '',
        language: getLanguageFromFileName(fileName || '')
      };
    }

    return {
      success: true,
      content: content,
      language: getLanguageFromFileName(fileName || '')
    };

  } catch (error) {
    console.error('Failed to decode code content:', error);
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : 'Unknown decoding error'
    };
  }
}

/**
 * Formats code using simple indentation and line breaks
 * Fallback if Prettier fails
 */
export function formatCode(content: string, language: string = ''): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  try {
    // Basic formatting for common languages
    if (language === 'json') {
      try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return content;
      }
    }

    // For other languages, just ensure proper line endings
    return content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')   // Handle old Mac line endings
      .trim();

  } catch (error) {
    console.warn('Failed to format code:', error);
    return content;
  }
}

/**
 * Encodes content back to JSON format if needed
 */
export function encodeCodeContent(content: string): string {
  return content;
}

/**
 * Detects language from file extension
 */
function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';

  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'md': 'markdown',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'dart': 'dart',
    'sh': 'shell',
    'bash': 'shell',
    'sql': 'sql',
    'xml': 'xml',
    'yml': 'yaml',
    'yaml': 'yaml'
  };

  return languageMap[ext] || 'plaintext';
}