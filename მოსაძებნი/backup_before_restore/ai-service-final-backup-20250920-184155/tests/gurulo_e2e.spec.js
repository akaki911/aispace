#!/usr/bin/env node
/**
 * SOL-212 Gurulo E2E Tests
 * Simple verification tests for new functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001';
const TEST_AUTH = 'Bearer TEST';

// Simple test runner
class SimpleTestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }
  
  async test(name, testFn) {
    try {
      console.log(`🧪 ${name}...`);
      await testFn();
      console.log(`✅ ${name} - PASSED`);
      this.passed++;
    } catch (error) {
      console.log(`❌ ${name} - FAILED: ${error.message}`);
      this.failed++;
    }
  }
  
  summary() {
    console.log(`\n📊 Test Summary: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

async function runTests() {
  const runner = new SimpleTestRunner();
  
  console.log('🚀 SOL-212 Gurulo Assistant E2E Tests\n');
  
  // Test 1: FS Search API
  await runner.test('FS Search API finds Georgian files', async () => {
    const response = await axios.get(`${BASE_URL}/api/fs/search?q=შემდეგი`);
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (!response.data.success) throw new Error('Search failed');
    if (response.data.matches.length === 0) throw new Error('No Georgian files found');
    console.log(`   Found ${response.data.matches.length} files`);
  });
  
  // Test 2: FS File API  
  await runner.test('FS File API reads with UTF-8', async () => {
    // First search for a file
    const searchResponse = await axios.get(`${BASE_URL}/api/fs/search?q=txt`);
    if (searchResponse.data.matches.length === 0) throw new Error('No files to test');
    
    const testFile = searchResponse.data.matches[0];
    const encodedPath = encodeURIComponent(testFile.rel);
    const response = await axios.get(`${BASE_URL}/api/fs/file?path=${encodedPath}&encoding=utf8`);
    
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (!response.data.success) throw new Error('File read failed');
    if (!response.data.meta.bytes || response.data.meta.bytes <= 0) throw new Error('Invalid file metadata');
    console.log(`   Read ${response.data.meta.bytes} bytes, ${response.data.meta.lines} lines`);
  });
  
  // Test 3: Assistant Tools Endpoint (without auth - should fail)
  await runner.test('Assistant API requires authentication', async () => {
    try {
      await axios.get(`${BASE_URL}/api/assistant/tools`);
      throw new Error('Should have required authentication');
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('   Correctly blocked unauthorized access');
      } else {
        throw error;
      }
    }
  });
  
  // Test 4: Assistant Tools with Auth
  await runner.test('Assistant Tools API with auth', async () => {
    const response = await axios.get(`${BASE_URL}/api/assistant/tools`, {
      headers: { 'Authorization': TEST_AUTH }
    });
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (!response.data.success) throw new Error('Tools API failed');
    if (!response.data.tools || response.data.tools.length < 2) throw new Error('Missing tools');
    console.log(`   Found ${response.data.tools.length} tools available`);
  });
  
  // Test 5: Web Get Tool (with auth)
  await runner.test('Web Get Tool with safe URL', async () => {
    const response = await axios.post(`${BASE_URL}/api/assistant/tool/web_get`, {
      inputs: { url: 'https://httpbin.org/status/200' }
    }, {
      headers: { 
        'Authorization': TEST_AUTH,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (!response.data.success) throw new Error('Web get failed');
    console.log(`   Successfully fetched web page`);
  });
  
  // Test 6: AI Chat Georgian File Reading
  await runner.test('AI Chat Georgian File Reading', async () => {
    const response = await axios.post(`${BASE_URL}/api/ai/chat`, {
      message: 'გთხოვ, წაიკითხე შემდეგი ჩატის პრ.txt და დამიდასტურე მხოლოდ მზადყოფნა'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (!response.data.success) throw new Error('Chat failed');
    if (!response.data.response.includes('წარმატებით წავიკითხე')) {
      throw new Error('Georgian confirmation not found');
    }
    console.log(`   AI correctly handled Georgian file reading`);
  });
  
  // Test 7: Health Check
  await runner.test('Health Check', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status !== 200) throw new Error(`Status ${response.status}`);
    if (response.data.status !== 'HEALTHY') throw new Error('Service not healthy');
    console.log(`   Service healthy, uptime: ${response.data.uptime}s`);
  });
  
  const success = runner.summary();
  process.exit(success ? 0 : 1);
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('🚨 Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests };