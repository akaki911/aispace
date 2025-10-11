/**
 * Unit Tests for routeQuery() function
 * Tests the policy classification and model routing logic
 */

const { routeQuery } = require('../policy/model_router');

describe('routeQuery Function Tests', () => {
  
  describe('GREETING Policy Tests', () => {
    test('should classify simple Georgian greetings as GREETING with model "none"', () => {
      const testCases = [
        'გამარჯობა',
        'გაგიმარჯოთ',
        'მოგესალმები',
        'დილა მშვიდობისა',
        'შუადღე მშვიდობისა',
        'საღამო მშვიდობისა',
        'როგორ ხარ?',
        'როგორ ხართ?'
      ];

      testCases.forEach(greeting => {
        const result = routeQuery(greeting);
        expect(result).toEqual({
          policy: 'GREETING',
          model: 'none'
        });
      });
    });

    test('should classify English greetings as GREETING with model "none"', () => {
      const testCases = [
        'hello',
        'hi',
        'hey',
        'good morning',
        'good afternoon',  
        'good evening',
        'how are you?'
      ];

      testCases.forEach(greeting => {
        const result = routeQuery(greeting);
        expect(result).toEqual({
          policy: 'GREETING',
          model: 'none'
        });
      });
    });
  });

  describe('CODE_COMPLEX Policy Tests', () => {
    test('should classify code-related queries as CODE_COMPLEX with model "large"', () => {
      const testCases = [
        'დამიწერე React კომპონენტი',
        'კოდი არ მუშაობს',
        'მაქვს TypeScript შეცდომა',
        'debug ეს ფუნქცია',
        'refactor this component',
        'unit test დამიწერე',
        'SyntaxError ვიღებ',
        'TypeError: cannot read property',
        'ვერ ვუშვებ სერვერს',
        'express.js-ში რაღაც არ მუშაობს',
        'hook იმუშავებს',
        'regex pattern მჭირდება'
      ];

      testCases.forEach(codeQuery => {
        const result = routeQuery(codeQuery);
        expect(result).toEqual({
          policy: 'CODE_COMPLEX',
          model: 'large'
        });
      });
    });
  });

  describe('REASONING_COMPLEX Policy Tests', () => {
    test('should classify complex reasoning queries as REASONING_COMPLEX with model "large"', () => {
      const testCases = [
        'ამიხსენი ეს რთული პრობლემა',
        'გაანალიზე ეს სიტუაცია',
        'დაგეგმე ეს პროექტი',
        'გადამიწყვიტე რომელი ფრეიმვორკი უკეთესია',
        'why doesn\'t this approach work?',
        'how to solve this complex problem?',
        'break down this issue into steps',
        'compare React vs Vue performance analysis',
        'evaluate trade-offs between these solutions'
      ];

      testCases.forEach(reasoningQuery => {
        const result = routeQuery(reasoningQuery);
        expect(result).toEqual({
          policy: 'REASONING_COMPLEX',
          model: 'large'
        });
      });
    });

    test('should classify long/complex queries as REASONING_COMPLEX with model "large"', () => {
      // Create a query over 40 words that should trigger isLongOrComplex()
      const longQuery = 'ეს არის ძალიან გრძელი კითხვა რომელშიც ბევრი რაღაც არის და ძალიან რთული საკითხებია და ეს უნდა დავანალიზო და გავიგო რას ნიშნავს ყოველივე ეს რომ სწორად ვუპასუხო მომხმარებელს ყველაზე კარგი პასუხით რომ კმაყოფილი იყოს შედეგით და კიდევ ბევრი რამ და ერთი წინადადება და მეორე წინადადება და მესამე წინადადება რომ გრძელი იყოს';
      
      const result = routeQuery(longQuery);
      expect(result).toEqual({
        policy: 'REASONING_COMPLEX',
        model: 'large'
      });
    });
  });

  describe('SIMPLE_QA Policy Tests', () => {
    test('should classify simple questions as SIMPLE_QA with model "small"', () => {
      const testCases = [
        'რა არის React?',
        'ვინ არის Python-ის შემქმნელი?',  
        'სად მდებარეობს package.json?',
        'რა ნიშნავს REST API?',
        'what is HTML?',
        'who is Tim Berners-Lee?',
        'when was Django created?',
        'where is the config file?',
        'define recursion'
      ];

      testCases.forEach(simpleQuery => {
        const result = routeQuery(simpleQuery);
        expect(result).toEqual({
          policy: 'SIMPLE_QA',
          model: 'small'
        });
      });
    });

    test('should classify short queries as SIMPLE_QA with model "small"', () => {
      const shortQuery = 'მოკლე კითხვა';
      
      const result = routeQuery(shortQuery);
      expect(result).toEqual({
        policy: 'SIMPLE_QA',
        model: 'small'
      });
    });
  });

  describe('Default Policy Tests', () => {
    test('should default to SIMPLE_QA with model "small" for unknown queries', () => {
      const unknownQueries = [
        'რაღაც უცნაური კითხვა',
        'random question without clear category',
        'განსაზღვრული კატეგორიის გარეშე'
      ];

      unknownQueries.forEach(unknownQuery => {
        const result = routeQuery(unknownQuery);
        expect(result).toEqual({
          policy: 'SIMPLE_QA',
          model: 'small'
        });
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty or null inputs', () => {
      expect(routeQuery('')).toEqual({
        policy: 'SIMPLE_QA',
        model: 'small'
      });
      
      expect(routeQuery(null)).toEqual({
        policy: 'SIMPLE_QA',
        model: 'small'
      });
      
      expect(routeQuery(undefined)).toEqual({
        policy: 'SIMPLE_QA',
        model: 'small'
      });
    });

    test('should handle queries with special characters', () => {
      const result = routeQuery('რა არის @#$%^&*() სიმბოლოები?');
      expect(result).toEqual({
        policy: 'SIMPLE_QA',
        model: 'small'
      });
    });
  });
});