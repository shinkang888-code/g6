"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

const SETTINGS_KEY = "messenger_settings";

interface MessengerSettings {
  aligoKey: string;
  aligoUserId: string;
  aligoSender: string;
  kakaoGatewayIp: string;
  kakaoGatewayApikey: string;
  kakaoBizAccessToken: string;
  kakaoSenderKey: string;
  telegramBotToken: string;
  lineChannelAccessToken: string;
  lineChannelSecret: string;
  whatsappApiKey: string;
  tiktokApiKey: string;
}

const defaults: MessengerSettings = {
  aligoKey: "",
  aligoUserId: "",
  aligoSender: "",
  kakaoGatewayIp: "",
  kakaoGatewayApikey: "",
  kakaoBizAccessToken: "",
  kakaoSenderKey: "",
  telegramBotToken: "",
  lineChannelAccessToken: "",
  lineChannelSecret: "",
  whatsappApiKey: "",
  tiktokApiKey: "",
};

const FIELDS: { key: keyof MessengerSettings; label: string; placeholder: string }[] = [
  { key: "aligoKey", label: "알리고 API Key", placeholder: "알리고 인증 키" },
  { key: "aligoUserId", label: "알리고 User ID", placeholder: "알리고 사용자 ID" },
  { key: "aligoSender", label: "알리고 발신번호", placeholder: "010-0000-0000" },
  { key: "kakaoGatewayIp", label: "카카오톡 연동 서버 IP", placeholder: "121.166.75.165 (또는 IP:포트)" },
  { key: "kakaoGatewayApikey", label: "카카오톡 연동 API Key", placeholder: "게이트웨이 발급 API 키" },
  { key: "kakaoBizAccessToken", label: "카카오톡 비즈 액세스 토큰", placeholder: "카카오 비즈메시지 토큰" },
  { key: "kakaoSenderKey", label: "카카오톡 발신 키", placeholder: "발신 프로필 키" },
  { key: "telegramBotToken", label: "텔레그램 봇 토큰", placeholder: "Bot token from @BotFather" },
  { key: "lineChannelAccessToken", label: "라인 채널 액세스 토큰", placeholder: "LINE Messaging API token" },
  { key: "lineChannelSecret", label: "라인 채널 시크릿", placeholder: "Channel secret" },
  { key: "whatsappApiKey", label: "WhatsApp API Key", placeholder: "Meta WhatsApp Business API key" },
  { key: "tiktokApiKey", label: "틱톡 API Key", placeholder: "TikTok API key" },
];

export default function AdminSettingsMessengerPage() {
  const [form, setForm] = useState<MessengerSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data[SETTINGS_KEY]) {
          const s = data[SETTINGS_KEY] as Partial<MessengerSettings>;
          setForm((prev) => ({ ...prev, ...s }));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [SETTINGS_KEY]: form }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("메신저 연동 설정이 저장되었습니다. 메신저 페이지에서 발송을 사용할 수 있습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="설정 목록으로">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare size={26} className="text-primary-500" />
            메신저 연동관리
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            알리고(문자), 카카오톡, 텔레그램, 라인, WhatsApp, 틱톡 API 키를 입력하면 메신저 페이지에서 메시지 발송이 가능합니다.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-5">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <input
              type="password"
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              autoComplete="off"
            />
          </div>
        ))}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
          <p>필요한 항목만 입력하면 됩니다. 알리고(문자)와 카카오톡은 메신저 페이지에서 이미 선택 가능하며, 나머지 채널은 추후 발송 UI에 연동됩니다. 환경 변수(ALIGO_KEY 등)보다 여기 저장값이 우선 사용됩니다.</p>
          <p className="text-amber-700 mt-1">
            <strong>알리고 인증오류(-101) 시:</strong> 알리고 관리자 &gt; 연동형 API &gt; 발송 IP에 <strong>현재 서버(또는 Vercel)의 발송 IP</strong>를 등록해야 합니다. 미등록 IP에서는 발송이 차단됩니다.
          </p>
        </div>
        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving} leftIcon={<Save size={16} />}>
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
