'use strict';

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
  if (!rawResponse || typeof rawResponse !== 'string') {
    return rawResponse;
  }

  console.log('🧼 [ENHANCED SANITIZER] Starting sanitization...', {
    responseLength: rawResponse.length,
    hasUserQuery: !!userQuery
  });

  let sanitized = rawResponse.trim();
  const originalLength = sanitized.length;

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
  testSanitizer
};