import { syncCaseDeadlines } from "../src/lib/courtDeadlineSync";

const caseId = process.argv[2] || "2c23e933-47f5-4394-ab97-2328bc3dd441";
const userId = process.argv[3] || "411d5155-cc94-46ac-a4f1-419ab91c44f1";

const r = await syncCaseDeadlines(caseId, userId);
console.log(JSON.stringify(r, null, 2));
