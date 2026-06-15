/**
 * 엑셀 파일 헤더·샘플 행 확인 (1회성)
 * node scripts/inspect-excel.mjs "경로"
 */
import XLSX from "xlsx";
import { readFileSync } from "fs";

const path = process.argv[2] || "c:\\Users\\user\\OneDrive\\문서\\카카오톡 받은 파일\\lawygo\\lawygo_caselist.xls";
const buf = readFileSync(path);
const wb = XLSX.read(buf, { type: "buffer" });
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
const headers = rows[0] || [];
const dataRows = rows.slice(1);

let totalRows = 0;
let emptyCaseNo = 0;
const caseNumbers = new Set();
dataRows.forEach((row) => {
  if (!row || row.length === 0) return;
  totalRows += 1;
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i];
  });
  const cn = String(obj["사건번호"] ?? "").trim();
  if (!cn) emptyCaseNo += 1;
  else caseNumbers.add(cn);
});

const sample = dataRows.slice(0, 3);
console.log(
  JSON.stringify(
    { sheetName, headers, totalRows, distinctCaseNumbers: caseNumbers.size, emptyCaseNo, sample },
    null,
    2
  )
);
