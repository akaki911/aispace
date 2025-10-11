
export type ActivityEvent =
  | { type: 'scan'; total: number; sample?: string[] }
  | { type: 'install'; pm: string; pkg: string; status?: 'pending'|'ok'|'fail'; out?: string; err?: string }
  | { type: 'file'; action: 'create'|'update'|'delete'; path: string; added?: number; removed?: number; unified?: string };

export interface ActivityPayload {
  activity?: ActivityEvent[];
}
