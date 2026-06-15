/** 프로젝트 키: slugify(의뢰인)__slugify(사건명) */

export function slugifySegment(s: string): string {
  return (s || "unknown")
    .trim()
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

export function buildProjectKey(clientName: string, caseTitle: string): string {
  return `${slugifySegment(clientName)}__${slugifySegment(caseTitle)}`;
}

export function buildProjectDisplay(clientName: string, caseTitle: string): string {
  return `${clientName.trim()} · ${caseTitle.trim()}`;
}
