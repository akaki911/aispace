const { ToolRegistry } = require('../core/tool_registry');

describe('TaskManager Integration', () => {
  test('processRequest handles simple request successfully', async () => {
    const registry = new ToolRegistry();
    const result = await registry.processRequest('გამარჯობა, მითხარი რა მდგომარეობაა სისტემაზე?');

    expect(result.success).toBe(true);
    expect(Array.isArray(result.taskList)).toBe(true);
    expect(result.taskList.length).toBeGreaterThan(0);
    expect(result.taskList[0]).toHaveProperty('type', 'context_analysis');
    expect(typeof result.executionSummary).toBe('string');
  });

  test('processRequest preserves task planning for file related prompts', async () => {
    const registry = new ToolRegistry();
    const result = await registry.processRequest(
      'გთხოვ მოძებნე ფაილი bookingService.ts რომ განვაალიზო',
      { userId: 'integration-test-user' }
    );

    expect(result.success).toBe(true);
    const taskTypes = result.taskList.map(task => task.type);
    expect(taskTypes).toContain('file_search');
  });
});
