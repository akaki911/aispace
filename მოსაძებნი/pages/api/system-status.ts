
import type { NextApiRequest, NextApiResponse } from 'next';

interface SystemStatusResponse {
  system: string;
  uptime: number;
  version: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SystemStatusResponse>
) {
  res.status(200).json({
    system: "GPT Panel",
    uptime: process.uptime(),
    version: "1.0.0"
  });
}
