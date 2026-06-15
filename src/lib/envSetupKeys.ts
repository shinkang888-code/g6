/** .env.local 설정 UI/API 공통 키 정의 */

export type EnvKeyDef = {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  hint?: string;
};

export const ENV_SETUP_SECTIONS: { title: string; items: EnvKeyDef[] }[] = [
  {
    title: "Supabase",
    items: [
      {
        key: "NEXT_PUBLIC_SUPABASE_URL",
        label: "Supabase URL",
        placeholder: "https://xxxxx.supabase.co",
        hint: "Supabase 프로젝트 Settings → API → Project URL",
      },
      {
        key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        label: "Supabase Anon Key",
        placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
        secret: true,
        hint: "publishable / anon public key",
      },
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        label: "Supabase Service Role Key",
        placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
        secret: true,
        hint: "서버 전용. 절대 공개 저장소에 올리지 마세요.",
      },
    ],
  },
  {
    title: "Google OAuth (구글 로그인·가입)",
    items: [
      {
        key: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google Client ID",
        placeholder: "123456789-xxxx.apps.googleusercontent.com",
        hint: "Google Cloud Console → OAuth 클라이언트 ID (웹). 동의 화면 앱 이름은 LawyGo로 설정",
      },
      {
        key: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google Client Secret",
        placeholder: "GOCSPX-xxxxxxxx",
        secret: true,
        hint: "리디렉션 URI: /api/auth/google/callback",
      },
    ],
  },
  {
    title: "국가법령정보 Open API",
    items: [
      {
        key: "LAW_GO_KR_OC",
        label: "법령 Open API OC",
        placeholder: "신청 이메일 @ 앞 ID",
        secret: true,
        hint: "open.law.go.kr Open API 인증값. 관리자 > 국가법령정보 API에서도 설정 가능",
      },
    ],
  },
  {
    title: "기타 (선택)",
    items: [
      {
        key: "SESSION_SECRET",
        label: "세션 비밀키",
        placeholder: "랜덤 긴 문자열",
        secret: true,
        hint: "미설정 시 Supabase URL로 대체",
      },
    ],
  },
  {
    title: "Vercel 연동 (선택)",
    items: [
      {
        key: "VERCEL_ACCESS_TOKEN",
        label: "Vercel Access Token",
        placeholder: "vercel_xxxxxxxx",
        secret: true,
        hint: "Vercel → Account Settings → Tokens. 「Vercel에 반영」 버튼에 필요 (로컬에만 저장)",
      },
    ],
  },
];

export const ALL_ENV_SETUP_KEYS = ENV_SETUP_SECTIONS.flatMap((s) => s.items.map((i) => i.key));
