
import type { NextApiRequest, NextApiResponse } from 'next';

interface LogEntry {
  id: number;
  message: string;
  timestamp: string;
  level: string;
  source?: string;
}

interface LogsResponse {
  logs: LogEntry[];
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogsResponse>
) {
  const level = (req.query.level as string) || "info";
  const limit = Number(req.query.limit) || 10;

  // Generate fake logs based on parameters
  const logs: LogEntry[] = Array(limit).fill(null).map((_, i) => ({
    id: i + 1,
    message: `Fake ${level} log entry #${i + 1} - System operational`,
    timestamp: new Date(Date.now() - (i * 1000)).toISOString(),
    level: level,
    source: i % 3 === 0 ? 'backend' : i % 3 === 1 ? 'frontend' : 'ai-service'
  }));

  res.status(200).json({
    logs: logs
  });
}
