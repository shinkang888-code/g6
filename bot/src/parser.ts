/**
 * 결과 HTML → CaseBasicData 파서
 * LawTop 의 HtmlAgilityPack 파싱 + CaseBasicData.txt(라벨|값) 포맷 대응.
 *
 * safind 결과 페이지의 정확한 DOM 구조는 세션/사건구분에 따라 다를 수 있어,
 * "라벨 텍스트 기반 휴리스틱"으로 추출합니다. 실제 사이트 구조 확인 후
 * LABELS 매핑과 selector 를 조정하세요. (src/selectors.ts)
 */
import * as cheerio from "cheerio";
import type { CaseBasicData, CaseEvent, SearchParams } from "./types.js";

/**
 * 결과 페이지에서 찾을 한글 라벨 → CaseBasicData 키 매핑.
 * 정확일치 우선(긴 라벨이 먼저 오도록 배치).
 * (라이브 실측: ssgo 기본정보 표는 th(라벨)+td(값) 쌍으로 구성)
 */
const LABELS: { label: string; key: keyof CaseBasicData }[] = [
  { label: "사건번호", key: "caseNumber" },
  { label: "사건명", key: "caseName" },
  { label: "피고인명", key: "defendantName" },
  { label: "원고", key: "matchClient" },
  { label: "재판부", key: "court_division" },
  { label: "접수일", key: "receivedDate" },
  { label: "종국결과", key: "finalResult" },
  { label: "형제번호", key: "caseManageNo" },
  { label: "상소제기내용", key: "appealInfo" },
];

/** 표 공백 정리 */
function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * 숨김 노드(aria-hidden / display:none / visibility:hidden) 제거.
 * ssgo 결과 페이지는 비활성 탭/배지([전자] 등)를 숨김 처리해 두므로,
 * 텍스트 추출 전에 제거해야 값이 오염되지 않는다.
 */
function stripHidden($: cheerio.CheerioAPI): void {
  $(
    '[aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]'
  ).remove();
}

/** caption 텍스트 조건으로 표 1개 찾기 */
function findTable(
  $: cheerio.CheerioAPI,
  pred: (caption: string) => boolean
): cheerio.Cheerio<never> | null {
  let hit: cheerio.Cheerio<never> | null = null;
  $("table").each((_i, t) => {
    if (hit) return;
    const cap = clean($(t).find("caption").first().text());
    if (cap && pred(cap)) hit = $(t) as unknown as cheerio.Cheerio<never>;
  });
  return hit;
}

/**
 * "사건이 존재하지 않습니다" 류 판단.
 * ssgo 폼 페이지에는 안내문구가 상시 포함되므로 HTML 전체가 아닌
 * alert(dialog) 메시지 텍스트를 넣어 호출하는 것을 전제로 정밀 매칭한다.
 * (라이브 실측 메시지: "사건이 존재하지 않습니다.")
 */
export function isNotFound(text: string): boolean {
  return /사건이?\s*존재하지\s*않|일치하는\s*사건.*없|조회.*결과.*없습니다|검색.*결과.*없습니다/.test(
    text
  );
}

/**
 * 캡차 오답(입력값 불일치) 판단 → 재시도 트리거.
 * alert(dialog) 메시지 전제. (라이브 실측 메시지:
 * "자동입력 방지문자가 일치하지 않습니다. 자동입력 방지문자를 다시 입력 후 검색해 주십시오.")
 * 주의: 폼 안내문 "자동입력방지문자가 도입되었습니다" 와 구분하기 위해
 *       반드시 '일치하지 않' / '다시 입력' 토큰을 함께 본다.
 */
export function isCaptchaError(text: string): boolean {
  return /(방지문자|보안문자).*일치하지\s*않|방지문자를?\s*다시\s*입력|문자를?\s*다시\s*입력/.test(
    text
  );
}

/**
 * 결과 HTML 에서 사건기본정보 추출.
 * label-value 가 인접 셀(th/td, dt/dd, label+span)에 있다고 가정하고 추출.
 */
export function parseCaseBasic(html: string, params: SearchParams): CaseBasicData {
  const $ = cheerio.load(html);
  stripHidden($); // 숨김 배지/비활성 탭 제거(값 오염 방지)

  const data: CaseBasicData = {
    court: params.courtName,
    client: params.partyName,
    serial: params.serial,
    year: params.year,
    caseCode: params.gubun,
    caseNumber: `${params.year}${params.gubun}${params.serial}`,
    matchCaseId: params.matchCaseId,
  };

  // 1) 기본정보 표(caption 에 '재판부'+'접수일' 포함)에서 th(라벨)→다음 td(값) 추출
  const info = findTable($, (c) => c.includes("재판부") && c.includes("접수일"));
  if (info) {
    info.find("th").each((_i, th) => {
      const label = clean($(th).text());
      if (!label) return;
      const td = $(th).nextAll("td").first();
      const val = clean(td.text());
      if (!val) return;
      const hit = LABELS.find((l) => label === l.label || label.startsWith(l.label));
      if (hit && !data[hit.key]) {
        (data as unknown as Record<string, unknown>)[hit.key] = val;
      }
    });
  }

  // 사건번호 정규화(라벨 추출 실패 시 폼 파라미터 기반 기본값 유지)
  if (!/\d/.test(data.caseNumber)) {
    data.caseNumber = `${params.year}${params.gubun}${params.serial}`;
  }

  // 2) 기일 표(caption 에 '기일구분' 또는 '기일장소' 포함) → 헤더 매핑 추출
  data.events = parseEvents($);
  if (!data.events?.length) {
    data.events = parseEventsFromWebSquareGrid($);
  }

  data.rawLine = toRawLine(data);
  return data;
}

/**
 * 최근기일내용 표만 정확히 추출(제출서류/병합분리 표 오인 방지).
 * 헤더(일자/시각/기일구분/기일장소/결과)를 컬럼명으로 매핑.
 */
function parseEvents($: cheerio.CheerioAPI): CaseEvent[] {
  const table = findTable($, (c) => c.includes("기일구분") || c.includes("기일장소"));
  if (!table) return [];

  // 헤더 라벨 → 컬럼 인덱스
  const headers = table
    .find("thead th, tr th")
    .map((_i, th) => clean($(th).text()))
    .get();
  const col = (name: string) => headers.findIndex((h) => h.includes(name));
  const ci = {
    date: col("일자"),
    time: col("시각"),
    type: col("기일구분"),
    place: col("기일장소"),
    result: col("결과"),
  };

  const events: CaseEvent[] = [];
  table.find("tbody tr").each((_j, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_k, td) => clean($(td).text()))
      .get();
    if (cells.length === 0 || cells.every((c) => !c)) return;
    const at = (i: number) => (i >= 0 && i < cells.length ? cells[i] || undefined : undefined);
    const ev: CaseEvent = {
      date: at(ci.date) ?? cells[0],
      time: at(ci.time),
      type: at(ci.type),
      place: at(ci.place),
      result: at(ci.result),
    };
    if (ev.date || ev.type || ev.place) events.push(ev);
  });
  return events;
}

/** WebSquare w2grid — tbody 가 비어 있어도 data-value 셀로 기일 행 추출 */
function parseEventsFromWebSquareGrid($: cheerio.CheerioAPI): CaseEvent[] {
  const events: CaseEvent[] = [];
  const dateRe = /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/;

  $('[id*="grd_rcntDxdyLst"]').each((_i, grid) => {
    const $grid = $(grid);
    $grid.find("tr[data-tr-id]").each((_j, tr) => {
      const $tr = $(tr);
      if ($tr.hasClass("gridHeaderStyle_0") || $tr.find("th").length > 0) return;

      const values = $tr
        .find("td")
        .map((_k, td) => {
          const dv = $(td).attr("data-value")?.trim();
          if (dv) return dv;
          return clean($(td).find(".w2grid_span").first().text() || $(td).text());
        })
        .get()
        .filter(Boolean);

      if (!values.length) return;
      const dateCell = values.find((v) => dateRe.test(v));
      if (!dateCell && !values.some((v) => /기일|변론|선고|공판|조정/.test(v))) return;

      const ev: CaseEvent = {
        date: dateCell ?? values[0],
        time: values.find((v) => /^\d{1,2}:\d{2}$/.test(v)),
        type: values.find((v) => /기일|변론|선고|공판|조정/.test(v)),
        place: values.find((v) => /법정|호|별관|동/.test(v)),
        result: values.find((v) => /속행|종결|연기|기일변경|불출석/.test(v)),
      };
      if (ev.date || ev.type || ev.place) events.push(ev);
    });
  });

  return events;
}

/**
 * CaseBasicData → LawTop CaseBasicData.txt 호환 라벨|값 라인.
 * 예: 법원|대구지방법원|의뢰인|이선아|일련번호|5285|...|사건번호|2025노5285|...
 */
export function toRawLine(d: CaseBasicData): string {
  const pairs: [string, string][] = [
    ["법원", d.court],
    ["의뢰인", d.client],
    ["일련번호", d.serial],
    ["매치법원", d.matchCourt ?? d.court],
    ["고유번호", d.caseCode ?? ""],
    ["연도", d.year ?? ""],
    ["매치의뢰인", d.matchClient ?? d.client],
    ["기일매치", d.dateMatched ? "Y" : "N"],
    ["사건키", d.caseKey ?? ""],
    ["사건번호", d.caseNumber],
    ["사건명", d.caseName ?? ""],
    ["피고인명", d.defendantName ?? ""],
    ["재판부", d.court_division ?? ""],
    ["접수일", d.receivedDate ?? ""],
    ["종국결과", d.finalResult ?? ""],
  ];
  return pairs.map(([k, v]) => `${k}|${v}`).join("|");
}

/**
 * LawTop CaseBasicData.txt 라벨|값 라인 → CaseBasicData 역파싱 (기존 데이터 이관용).
 */
export function parseRawLine(line: string): Partial<CaseBasicData> {
  const tokens = line.split("|").map((s) => s.trim());
  const map: Record<string, string> = {};
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    map[tokens[i]] = tokens[i + 1];
  }
  return {
    court: map["법원"],
    client: map["의뢰인"],
    serial: map["일련번호"],
    matchCourt: map["매치법원"],
    caseCode: map["고유번호"],
    year: map["연도"],
    matchClient: map["매치의뢰인"],
    dateMatched: map["기일매치"] === "Y",
    caseKey: map["사건키"],
    caseNumber: map["사건번호"],
    caseName: map["사건명"],
    defendantName: map["피고인명"],
    court_division: map["재판부"],
    receivedDate: map["접수일"],
    finalResult: map["종국결과"],
    rawLine: line,
  };
}
