import { Play, RefreshCw } from 'lucide-react';
import { useAssistantMode } from '../../contexts/useAssistantMode';

export const TestingDashboard = () => {
  const { isReadOnly } = useAssistantMode();

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Browser Automation Runner</h1>
          <p className="text-sm text-gray-600">
            Minimal scaffolding for orchestrating smoke journeys with Playwright. Endpoints are currently stubbed while platform integration is prepared.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            type="button"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh status
          </button>
          <button
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-blue-300"
            type="button"
            disabled={isReadOnly}
          >
            <Play className="mr-2 h-4 w-4" />
            Queue smoke run
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-6 text-sm text-gray-600">
        <h2 className="mb-2 text-base font-semibold text-gray-800">Current status</h2>
        <p>
          No live orchestrations yet. The runner service will attach to Playwright jobs once the automation agents are promoted to P1.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-800">Recent activity</h2>
        <p className="mt-2 text-sm text-gray-500">
          Activity feed coming soon. The stub keeps the admin surface visible without affecting existing dashboards.
        </p>
      </section>
    </div>
  );
};

export default TestingDashboard;
