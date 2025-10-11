'use strict';

const MAX_STRUCTURED_DEPTH = 6;

function extractStructuredParagraphs(payload, depth = 0) {
  if (depth > MAX_STRUCTURED_DEPTH || payload == null) {
    return [];
  }

  if (typeof payload === 'string') {
    return [payload];
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return [String(payload)];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => extractStructuredParagraphs(entry, depth + 1));
  }

  if (typeof payload === 'object') {
    const record = payload;
    const collected = [];

    if (Array.isArray(record.sections)) {
      for (const section of record.sections) {
        collected.push(...extractStructuredParagraphs(section, depth + 1));
      }
    }

    if (typeof record.title === 'string') {
      collected.push(record.title);
    }

    if (Array.isArray(record.bullets)) {
      for (const bullet of record.bullets) {
        collected.push(...extractStructuredParagraphs(bullet, depth + 1));
      }
    } else if (typeof record.bullets === 'string') {
      collected.push(record.bullets);
    }

    if (typeof record.cta === 'string') {
      collected.push(record.cta);
    }

    const fallbackKeys = ['content', 'response', 'message', 'text', 'value', 'body', 'description', 'summary'];
    for (const key of fallbackKeys) {
      if (key in record) {
        collected.push(...extractStructuredParagraphs(record[key], depth + 1));
      }
    }

    return collected;
  }

  return [];
}

function structuredPayloadToText(payload) {
  const paragraphs = extractStructuredParagraphs(payload)
    .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry ?? '')))
    .filter((entry) => entry.length > 0);

  if (paragraphs.length === 0) {
    try {
      return JSON.stringify(payload, null, 2);
    } catch (error) {
      return String(payload ?? '');
    }
  }

  return paragraphs.join('\n\n');
}

function flattenStructured(payload) {
  if (payload == null) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload);
  }

  if (Array.isArray(payload) || typeof payload === 'object') {
    try {
      return structuredPayloadToText(payload);
    } catch (error) {
      console.warn('⚠️ [ENHANCED SANITIZER] Failed to flatten structured payload:', error.message);
      try {
        return JSON.stringify(payload);
      } catch (stringifyError) {
        console.warn('⚠️ [ENHANCED SANITIZER] JSON stringify fallback failed:', stringifyError.message);
      }
    }
  }

  return String(payload ?? '');
}

/**
 * Step 4: Enhanced Sanitizer Function
 * Based on specifications from პრობლემის მოგვარება.txt
 *
 * Function Signature: sanitizeResponse(rawResponse: string, userQuery: string): string
 */

/**
 * Enhanced response sanitizer with persona protection and grammar corrections
 * @param {string} rawResponse - Raw AI response to sanitize
 * @param {string} userQuery - Original user query for context
 * @returns {string} - Sanitized and corrected response
 */
function sanitizeResponse(rawResponse, userQuery = '') {
  if (rawResponse == null) {
    return rawResponse;
  }

  let workingResponse;

  if (typeof rawResponse === 'string') {
    workingResponse = rawResponse;
  } else if (Array.isArray(rawResponse) || typeof rawResponse === 'object') {
    workingResponse = flattenStructured(rawResponse);

    if (typeof workingResponse === 'string' && /^[{\[]/.test(workingResponse.trim())) {
      console.log('🧯 [ENHANCED SANITIZER] Flattened structured payload detected');
    }
  } else {
    return rawResponse;
  }

  if (typeof workingResponse !== 'string') {
    return workingResponse;
  }

  let sanitized = workingResponse.trim();
  const originalLength = sanitized.length;

  console.log('🧼 [ENHANCED SANITIZER] Starting sanitization...', {
    responseLength: originalLength,
    hasUserQuery: !!userQuery
  });

  // Step 1: Persona Protection
  // Replace any instance of "მე ვარ აკაკი" with "მე ვარ გურულო"
  const personaReplacements = [
    { from: /მე\s+ვარ\s+აკაკი/gi, to: 'მე ვარ გურულო' },
    { from: /ჩემი\s+სახელი\s+არის\s+აკაკი/gi, to: 'ჩემი სახელი არის გურულო' },
    { from: /ჩემი\s+სახელია\s+აკაკი/gi, to: 'ჩემი სახელია გურულო' },
    { from: /მე\s+აკაკი\s+ვარ/gi, to: 'მე გურულო ვარ' },
    { from: /I\s+am\s+Akaki/gi, to: 'I am Gurulo' },
    { from: /My\s+name\s+is\s+Akaki/gi, to: 'My name is Gurulo' }
  ];

  let personaFixed = 0;
  for (const replacement of personaReplacements) {
    const beforeReplace = sanitized;
    sanitized = sanitized.replace(replacement.from, replacement.to);
    if (beforeReplace !== sanitized) {
      personaFixed++;
    }
  }

  // Step 2: Grammar Corrections
  // Fix common Georgian mistakes
  const grammarCorrections = [
    { from: /რა\s+საკითხი\s+აქვს\s+თქვენ/gi, to: 'რა საკითხი გაქვთ' },
    { from: /რა\s+საკითხი\s+აქვს\s+შენ/gi, to: 'რა საკითხი გაქვს' },
    { from: /როგორ\s+შეიძლება\s+მივაღწიო/gi, to: 'როგორ შემიძლია მივაღწიო' },
    { from: /შეიძლება\s+ვთხოვო/gi, to: 'შემიძლია ვთხოვო' },
    { from: /შეიძლება\s+ვთქვა/gi, to: 'შემიძლია ვთქვა' },
    { from: /გაქვს\s+შეცდომა/gi, to: 'მაქვს შეცდომა' },
    { from: /გაქვს\s+კითხვა/gi, to: 'მაქვს კითხვა' }
  ];

  let grammarFixed = 0;
  for (const correction of grammarCorrections) {
    const beforeCorrect = sanitized;
    sanitized = sanitized.replace(correction.from, correction.to);
    if (beforeCorrect !== sanitized) {
      grammarFixed++;
    }
  }

  // Step 3: Conditional Replit Mention Removal
  // If userQuery does NOT contain "Replit" (case-insensitive), remove all mentions
  const userMentionsReplit = /replit/i.test(userQuery || '');
  let replitMentionsRemoved = 0;

  if (!userMentionsReplit) {
    const replitPatterns = [
      /replit\s+environment/gi,
      /on\s+replit/gi,
      /using\s+replit/gi,
      /replit\s+workspace/gi,
      /replit\s+project/gi,
      /replit-ზე/gi,
      /replit-ში/gi,
      /replit\s+სერვისი/gi,
      /\breplit\b/gi
    ];

    for (const pattern of replitPatterns) {
      const beforeRemove = sanitized;
      sanitized = sanitized.replace(pattern, '');
      if (beforeRemove !== sanitized) {
        replitMentionsRemoved++;
      }
    }

    // Clean up extra spaces left by removals
    sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();
  }

  // Step 4: Length Truncation
  // If response is longer than 800 characters, truncate and append "..."
  let wasTruncated = false;
  if (sanitized.length > 800) {
    sanitized = sanitized.substring(0, 800).trim() + '...';
    wasTruncated = true;
  }

  // Step 5: Normalize paragraphs to keep responses concise and structured
  const sections = sanitized
    .split(/\n{2,}/)
    .map(section => section.trim())
    .filter(section => section.length > 0);

  if (sections.length > 0) {
    const lastSection = sections[sections.length - 1];
    const coreSections = sections.length > 3 ? sections.slice(0, 2) : sections.slice(0, sections.length - 1);
    sanitized = [...coreSections, lastSection]
      .filter(Boolean)
      .join('\n\n');
  }

  // Step 6: Strip ISO timestamps or clock artifacts that may leak diagnostics
  const isoTimestampPattern = /\b\d{4}-\d{2}-\d{2}[tT]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
  const wallClockPattern = /\b\d{2}:\d{2}:\d{2}\b/g;
  if (isoTimestampPattern.test(sanitized) || wallClockPattern.test(sanitized)) {
    sanitized = sanitized.replace(isoTimestampPattern, '').replace(wallClockPattern, '');
  }

  // Step 7: Remove excessive whitespace and align sentence spacing
  sanitized = sanitized
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  console.log('✅ [ENHANCED SANITIZER] Sanitization complete:', {
    originalLength,
    finalLength: sanitized.length,
    personaFixed,
    grammarFixed,
    replitMentionsRemoved,
    wasTruncated,
    userMentionsReplit
  });

  return sanitized;
}

/**
 * Quick validation function to test sanitizer
 * @param {string} testResponse - Test response
 * @param {string} testQuery - Test query
 * @returns {Object} - Test results
 */
function testSanitizer(testResponse, testQuery = '') {
  const result = sanitizeResponse(testResponse, testQuery);
  return {
    input: testResponse,
    output: result,
    query: testQuery,
    changed: testResponse !== result,
    lengthChange: result.length - testResponse.length
  };
}

module.exports = {
  sanitizeResponse,
  testSanitizer,
  flattenStructured
};

