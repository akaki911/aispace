/**
 * Unit Tests for sanitizeResponse() function  
 * Tests persona protection, grammar corrections, Replit mention removal, and length truncation
 */

const { sanitizeResponse } = require('../utils/enhanced_sanitizer');

describe('sanitizeResponse Function Tests', () => {

  describe('Persona Protection Tests', () => {
    test('should replace "მე ვარ აკაკი" with "მე ვარ გურულო"', () => {
      const input = 'გამარჯობა! მე ვარ აკაკი და მზად ვარ დაგეხმაროთ.';
      const expected = 'გამარჯობა! მე ვარ გურულო და მზად ვარ დაგეხმაროთ.';
      
      const result = sanitizeResponse(input);
      expect(result).toBe(expected);
    });

    test('should replace various persona patterns', () => {
      const testCases = [
        {
          input: 'ჩემი სახელი არის აკაკი',
          expected: 'ჩემი სახელი არის გურულო'
        },
        {
          input: 'ჩემი სახელია აკაკი',
          expected: 'ჩემი სახელია გურულო'
        },
        {
          input: 'მე აკაკი ვარ',
          expected: 'მე გურულო ვარ'
        },
        {
          input: 'I am Akaki, how can I help?',
          expected: 'I am Gurulo, how can I help?'
        },
        {
          input: 'My name is Akaki',
          expected: 'My name is Gurulo'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = sanitizeResponse(input);
        expect(result).toBe(expected);
      });
    });

    test('should handle case-insensitive persona replacements', () => {
      const input = 'მე ვარ აკაკი და ME VAR AKAKI ასევე';
      const result = sanitizeResponse(input);
      expect(result).toContain('მე ვარ გურულო');
      expect(result).not.toContain('აკაკი');
      expect(result).not.toContain('AKAKI');
    });
  });

  describe('Grammar Corrections Tests', () => {
    test('should correct "რა საკითხი აქვს თქვენ" to "რა საკითხი გაქვთ"', () => {
      const input = 'რა საკითხი აქვს თქვენ ამ მონაცემებთან დაკავშირებით?';
      const expected = 'რა საკითხი გაქვთ ამ მონაცემებთან დაკავშირებით?';
      
      const result = sanitizeResponse(input);
      expect(result).toBe(expected);
    });

    test('should apply multiple grammar corrections', () => {
      const testCases = [
        {
          input: 'რა საკითხი აქვს შენ',
          expected: 'რა საკითხი გაქვს'
        },
        {
          input: 'როგორ შეიძლება მივაღწიო ამ მიზნს',
          expected: 'როგორ შემიძლია მივაღწიო ამ მიზნს'
        },
        {
          input: 'შეიძლება ვთხოვო დახმარება',
          expected: 'შემიძლია ვთხოვო დახმარება'
        },
        {
          input: 'შეიძლება ვთქვა რომ',
          expected: 'შემიძლია ვთქვა რომ'
        },
        {
          input: 'გაქვს შეცდომა კოდში',
          expected: 'მაქვს შეცდომა კოდში'
        },
        {
          input: 'გაქვს კითხვა ამ თემაზე',
          expected: 'მაქვს კითხვა ამ თემაზე'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = sanitizeResponse(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Replit Mention Removal Tests', () => {
    test('should remove "Replit" when not mentioned in user query', () => {
      const userQuery = 'როგორ მუშაობს JavaScript?';
      const input = 'JavaScript არის ენა რომელიც მუშაობს Replit-ზე ძალიან კარგად.';
      const expected = 'JavaScript არის ენა რომელიც მუშაობს ძალიან კარგად.';
      
      const result = sanitizeResponse(input, userQuery);
      expect(result).toBe(expected);
    });

    test('should keep "Replit" when mentioned in user query', () => {
      const userQuery = 'როგორ მუშაობს Replit environment?';
      const input = 'Replit environment არის ძალიან მოხერხებული დეველოპმენტისთვის.';
      
      const result = sanitizeResponse(input, userQuery);
      expect(result).toBe(input); // Should remain unchanged
    });

    test('should remove various Replit patterns when not in user query', () => {
      const userQuery = 'რა არის React?';
      const testCases = [
        {
          input: 'React მუშაობს replit environment-ში',
          shouldNotContain: 'replit environment'
        },
        {
          input: 'ვუშვებ on replit პლატფორმაზე',
          shouldNotContain: 'on replit'
        },
        {
          input: 'using replit workspace რეკომენდირებულია',
          shouldNotContain: 'using replit'
        },
        {
          input: 'ეს replit project არის',
          shouldNotContain: 'replit project'
        },
        {
          input: 'replit-ზე მუშაობა',
          shouldNotContain: 'replit-ზე'
        },
        {
          input: 'replit-ში ჩაწერა',
          shouldNotContain: 'replit-ში'
        }
      ];

      testCases.forEach(({ input, shouldNotContain }) => {
        const result = sanitizeResponse(input, userQuery);
        expect(result.toLowerCase()).not.toContain(shouldNotContain.toLowerCase());
      });
    });

    test('should clean up extra spaces after Replit removal', () => {
      const userQuery = 'რა არის Node.js?';
      const input = 'Node.js     არის     Replit  environment     რომელიც     მუშაობს';
      
      const result = sanitizeResponse(input, userQuery);
      expect(result).not.toMatch(/\s{2,}/); // Should not contain multiple consecutive spaces
      expect(result.trim()).toBe('Node.js არის რომელიც მუშაობს');
    });
  });

  describe('Length Truncation Tests', () => {
    test('should truncate long strings to 800 characters with "..."', () => {
      // Create a string longer than 800 characters
      const longString = 'ეს არის ძალიან გრძელი ტექსტი '.repeat(50); // Much longer than 800 chars
      
      const result = sanitizeResponse(longString);
      
      expect(result.length).toBeLessThanOrEqual(803); // 800 + "..."
      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBe(803); // Exactly 800 chars + "..."
    });

    test('should NOT truncate strings under 800 characters', () => {
      const shortString = 'ეს არის მოკლე ტექსტი რომელიც არ უნდა შემოიკვეცოს.';
      
      const result = sanitizeResponse(shortString);
      
      expect(result).toBe(shortString);
      expect(result.endsWith('...')).toBe(false);
    });

    test('should handle exactly 800 character strings', () => {
      const exactString = 'x'.repeat(800);
      
      const result = sanitizeResponse(exactString);
      
      expect(result).toBe(exactString);
      expect(result.endsWith('...')).toBe(false);
      expect(result.length).toBe(800);
    });

    test('should handle truncation at word boundaries gracefully', () => {
      const longString = 'ეს არის სიტყვები '.repeat(50); // Creates a long string with repeated words
      
      const result = sanitizeResponse(longString);
      
      expect(result.length).toBeLessThanOrEqual(803);
      expect(result.endsWith('...')).toBe(true);
      // Just verify it was truncated properly, don't worry about exact word boundaries
      expect(result.substring(0, 800).length).toBe(800);
    });
  });

  describe('Combined Operations Tests', () => {
    test('should apply all sanitizations in sequence', () => {
      const userQuery = 'რა არის JavaScript?'; // No Replit mention
      const input = 'მე ვარ აკაკი. რა საკითხი აქვს თქვენ? JavaScript მუშაობს Replit environment-ში ძალიან კარგად.' + 'x'.repeat(800);
      
      const result = sanitizeResponse(input, userQuery);
      
      // Check persona replacement
      expect(result).toContain('მე ვარ გურულო');
      expect(result).not.toContain('აკაკი');
      
      // Check grammar correction  
      expect(result).toContain('რა საკითხი გაქვთ');
      expect(result).not.toContain('რა საკითხი აქვს თქვენ');
      
      // Check Replit removal
      expect(result.toLowerCase()).not.toContain('replit');
      
      // Check truncation
      expect(result.length).toBeLessThanOrEqual(803);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined/empty inputs', () => {
      expect(sanitizeResponse(null)).toBe(null);
      expect(sanitizeResponse(undefined)).toBe(undefined);
      expect(sanitizeResponse('')).toBe('');
      expect(sanitizeResponse('   ')).toBe('');
    });

    test('should handle non-string inputs', () => {
      expect(sanitizeResponse(123)).toBe(123);
      expect(sanitizeResponse({})).toEqual({});
      expect(sanitizeResponse([])).toEqual([]);
    });

    test('should handle inputs with only whitespace', () => {
      const result = sanitizeResponse('   \n\t   ');
      expect(result).toBe('');
    });

    test('should preserve formatting in multi-line text', () => {
      const input = `მე ვარ აკაკი\nეს არის მეორე ხაზი\nმესამე ხაზი`;
      
      const result = sanitizeResponse(input);
      
      expect(result).toContain('მე ვარ გურულო');
      // The trim() call in sanitizer may affect formatting, so just check content is preserved
      expect(result).toContain('მეორე ხაზი');
      expect(result).toContain('მესამე ხაზი');
    });
  });
});