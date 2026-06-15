/**
 * 알리고 SMS 발송 테스트 (직접 API 호출)
 * 사용: node scripts/test-aligo-sms.js
 * 환경변수 또는 config 수정 후 실행
 *
 * -101 인증오류 시: 알리고 관리자(연동형 API)에서 발송 IP를 등록해야 합니다.
 *   로컬에서 실행하면 현재 PC 공인 IP를, 서버에서는 해당 서버 발송 IP를 등록하세요.
 */
const ALIGO_SEND_URL = "https://apis.aligo.in/send/";

const config = {
  key: process.env.ALIGO_KEY || "2qswvj7ttk0hx91oghz3i6wlf0ywa3ls",
  userId: process.env.ALIGO_USER_ID || "shinkang88",
  sender: process.env.ALIGO_SENDER || "01028242468",
  receiver: process.env.ALIGO_RECEIVER || "01084828545",
  msg: process.env.ALIGO_MSG || "test",
};

async function main() {
  const form = new URLSearchParams({
    key: config.key,
    user_id: config.userId,
    sender: config.sender,
    receiver: config.receiver,
    msg: config.msg,
  });

  console.log("요청 파라미터 (key 마스킹):", {
    user_id: config.userId,
    sender: config.sender,
    receiver: config.receiver,
    msg: config.msg,
  });

  try {
    const res = await fetch(ALIGO_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: form.toString(),
    });
    const rawText = await res.text();
    console.log("HTTP status:", res.status);
    console.log("응답 본문:", rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("응답이 JSON이 아님.");
      process.exit(1);
    }

    const resultCode = Number(data.result_code);
    if (resultCode >= 1) {
      console.log("발송 성공. result_code:", resultCode, "msg_id:", data.msg_id);
    } else {
      console.error("알리고 실패. result_code:", resultCode, "message:", data.message);
      process.exit(1);
    }
  } catch (e) {
    console.error("요청 예외:", e.message || e);
    process.exit(1);
  }
}

main();
