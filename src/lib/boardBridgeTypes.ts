/**
 * 게시판 브릿지 공통 타입
 */

export type BridgeSource = "lawygo" | "g6" | "fallback";

export interface BridgeResult<T> {
  success: boolean;
  data: T;
  error?: string;
  source: BridgeSource;
  total?: number;
}

export interface BoardPost {
  id: number;
  subject: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  hit: number;
  commentCount: number;
  category?: string;
  caseId?: string;
  caseType?: string;
}

export interface BoardComment {
  id: number;
  postId: number;
  content: string;
  author: string;
  createdAt: string;
}

export type BridgeContext = {
  managementNumber?: string | null;
  authorName?: string;
  authorLoginId?: string;
};

export type BoardBridgeStatus = {
  nativeBoard: boolean;
  g6Connected: boolean;
  prefer: "native" | "g6" | "hybrid";
};
