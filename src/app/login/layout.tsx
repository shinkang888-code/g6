/**
 * 로그인 영역 전용 레이아웃 (사이드바/헤더 없음)
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      {children}
    </div>
  );
}
