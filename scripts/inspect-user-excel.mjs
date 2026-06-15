/**
 * user_lawygo.xls 구조 확인
 */
import XLSX from "xlsx";
import { readFileSync } from "fs";

const path = process.argv[2] || "c:\\Users\\user\\OneDrive\\문서\\카카오톡 받은 파일\\lawygo\\user_lawygo.xls";
const buf = readFileSync(path);
const wb = XLSX.read(buf, { type: "buffer" });
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
const headers = rows[0] || [];
const sample = rows.slice(1, 6);
console.log(JSON.stringify({ sheetName, headers, rowCount: rows.length - 1, sample }, null, 2));
