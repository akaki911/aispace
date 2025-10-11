
export function countAddedRemoved(unified: string) {
  let added = 0, removed = 0;
  for (const line of unified.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') || line.startsWith('diff ')) continue;
    if (line.startsWith('+')) added++;
    else if (line.startsWith('-')) removed++;
  }
  return { added, removed };
}
