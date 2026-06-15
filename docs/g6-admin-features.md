# G6(그누보드6) 관리자 콘솔 기능 목록

LawyGo에서 G6를 연동할 때, **G6 관리자 콘솔**(`/admin`)에 있는 기능을 한눈에 보기 위한 문서입니다.  
G6 admin 파일(`g6/admin/*.py`, `g6/admin/templates`)을 기준으로 정리했습니다.

---

## 1. G6 관리자 접근

- **URL**: `{G6_BASE_URL}/admin` (예: `http://localhost:8000/admin`)
- **인증**: G6 로그인(관리자 계정) 필요
- **LawyGo 연동**: 관리자 페이지에서 "G6 관리자 콘솔 열기"로 동일 기능 사용 가능

---

## 2. 카테고리별 기능 (100% 목록)

### 2.1 관리자 메인
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/` | GET | 관리자 메인 대시보드 (신규회원·최근글·포인트 요약) |

### 2.2 기본환경설정
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/config_form` | GET | 기본환경설정 폼 |
| `/admin/config_form_update` | POST | 기본환경설정 저장 |

### 2.3 회원 관리
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/member_list` | GET | 회원 목록 |
| `/admin/member_list_update` | POST | 회원 목록 일괄 수정 |
| `/admin/member_list_delete` | POST | 회원 목록 일괄 삭제 |
| `/admin/member_form` | GET | 회원 추가 폼 |
| `/admin/member_form/{mb_id}` | GET | 회원 수정 폼 |
| `/admin/member_form_update` | POST | 회원 추가/수정 처리 |
| `/admin/check_member_id/{mb_id}` | GET | 회원 아이디 중복 확인 |
| `/admin/check_member_email/{mb_email}/{mb_id}` | GET | 이메일 중복 확인 |
| `/admin/check_member_nick/{mb_nick}/{mb_id}` | GET | 닉네임 중복 확인 |

### 2.4 포인트
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/point_list` | GET | 포인트 목록 |
| `/admin/point_update` | POST | 포인트 지급/차감 |
| `/admin/point_list_delete` | POST | 포인트 내역 일괄 삭제 |

### 2.5 게시판 그룹
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/boardgroup_list` | GET | 게시판 그룹 목록 |
| `/admin/boardgroup_list_update` | POST | 그룹 일괄 수정 |
| `/admin/boardgroup_list_delete` | POST | 그룹 일괄 삭제 |
| `/admin/boardgroup_form` | GET | 그룹 등록 폼 |
| `/admin/boardgroup_form/{gr_id}` | GET | 그룹 수정 폼 |
| `/admin/boardgroup_form_update` | POST | 그룹 등록/수정 처리 |

### 2.6 게시판
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/board_list` | GET | 게시판 목록 |
| `/admin/board_list_update` | POST | 게시판 일괄 수정 |
| `/admin/board_list_delete` | POST | 게시판 일괄 삭제 |
| `/admin/board_form` | GET | 게시판 등록 폼 |
| `/admin/board_form/{bo_table}` | GET | 게시판 수정 폼 |
| `/admin/board_form_update` | POST | 게시판 등록/수정 처리 |
| `/admin/board_copy/{bo_table}` | GET | 게시판 복사 폼 |
| `/admin/board_copy_update` | POST | 게시판 복사 처리 |

### 2.7 그룹별 접근 회원
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/boardgroupmember_list/{gr_id}` | GET | 그룹별 접근 회원 목록 |
| `/admin/boardgroupmember_form/{mb_id}` | GET | 회원별 접근 가능 그룹 폼 |
| `/admin/boardgroupmember_insert` | POST | 접근 그룹 회원 추가 |
| `/admin/boardgroupmember_delete` | POST | 접근 그룹 회원 삭제 |

### 2.8 내용(컨텐츠) 관리
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/content_list` | GET | 내용 목록 |
| `/admin/content_form` | GET | 내용 등록 폼 |
| `/admin/content_form/{co_id}` | GET | 내용 수정 폼 |
| `/admin/content_form_update` | POST | 내용 등록/수정 처리 |
| `/admin/content_delete/{co_id}` | GET | 내용 삭제 |

### 2.9 FAQ
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/faq_master_list` | GET | FAQ 마스터 목록 |
| `/admin/faq_master_form` | GET | FAQ 마스터 등록 폼 |
| `/admin/faq_master_form/{fm_id}` | GET | FAQ 마스터 수정 폼 |
| `/admin/faq_master_form_update` | POST | FAQ 마스터 등록 처리 |
| `/admin/faq_master_form_update/{fm_id}` | POST | FAQ 마스터 수정 처리 |
| `/admin/faq_master_form_delete/{fm_id}` | DELETE | FAQ 마스터 삭제 |
| `/admin/faq_list/{fm_id}` | GET | FAQ 항목 목록 |
| `/admin/faq_form/{fm_id}` | GET | FAQ 항목 등록 폼 |
| `/admin/faq_form/{fm_id}/{fa_id}` | GET | FAQ 항목 수정 폼 |
| `/admin/faq_form_update/{fm_id}` | POST | FAQ 항목 등록 |
| `/admin/faq_form_update/{fm_id}/{fa_id}` | POST | FAQ 항목 수정 |
| `/admin/faq_form_delete/{fa_id}` | DELETE | FAQ 항목 삭제 |

### 2.10 테마
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/theme` | GET | 테마 목록 |
| `/admin/theme_detail` | POST | 테마 상세 조회 |
| `/admin/theme_preview/{theme}` | GET | 테마 미리보기 |
| `/admin/theme_update` | POST | 테마 적용 |
| `/admin/screenshot/{theme}` | GET | 테마 스크린샷 파일 |

### 2.11 접속자/방문자
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/visit_search` | GET | 접속자 검색 |
| `/admin/visit_delete` | GET | 접속자 로그 삭제 페이지 |
| `/admin/visit_delete_update` | POST | 접속자 로그 삭제 처리 |
| `/admin/visit_list` | GET | 접속자 집계 목록 |

### 2.12 1:1 문의 설정
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/qa_config` | GET | 1:1 문의 설정 폼 |
| `/admin/qa_config_update` | POST | 1:1 문의 설정 저장 |

### 2.13 메일 테스트
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/sendmail_test` | GET | 메일 테스트 폼 |
| `/admin/sendmail_test_result` | POST | 메일 테스트 실행 |

### 2.14 메뉴
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/menu_list` | GET | 메뉴 목록 |
| `/admin/menu_form` | GET | 메뉴 추가 팝업 |
| `/admin/menu_form_search` | POST | 메뉴 추가(검색 타입별) |
| `/admin/menu_list_update` | POST | 메뉴 수정 |

### 2.15 관리자 권한
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/auth_list` | GET | 관리자 권한 목록 |
| `/admin/auth_update` | POST | 권한 등록/수정 |
| `/admin/auth_list_delete` | POST | 권한 삭제 |

### 2.16 인기 검색어
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/popular_list` | GET | 인기 검색어 목록 |
| `/admin/popular/delete` | POST | 인기 검색어 일괄 삭제 |
| `/admin/popular_rank` | GET | 인기 검색어 순위 |

### 2.17 설문조사
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/poll_list` | GET | 설문조사 목록 |
| `/admin/poll_list_delete` | POST | 설문조사 목록 삭제 |
| `/admin/poll_form` | GET | 설문조사 등록 폼 |
| `/admin/poll_form/{po_id}` | GET | 설문조사 수정 폼 |
| `/admin/poll_form_update` | POST | 설문조사 등록/수정 처리 |

### 2.18 팝업(레이어)
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/newwin_list` | GET | 팝업 목록 |
| `/admin/newwin_form` | GET | 팝업 등록 폼 |
| `/admin/newwin_form/{nw_id}` | GET | 팝업 수정 폼 |
| `/admin/newwin_form_update` | POST | 팝업 등록/수정 처리 |
| `/admin/newwin_delete/{nw_id}` | GET | 팝업 삭제 |

### 2.19 회원 메일 발송
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/mail_list` | GET | 회원 메일 발송 목록 |
| `/admin/mail_form` | GET | 메일 등록 폼 |
| `/admin/mail_form/{ma_id}` | GET | 메일 수정 폼 |
| `/admin/mail_update` | POST | 메일 등록/수정 |
| `/admin/mail_delete` | POST | 메일 삭제 |
| `/admin/mail_test/{ma_id}` | GET | 메일 테스트 발송 |
| `/admin/mail_select_form/{ma_id}` | GET | 수신 대상 회원 선택 폼 |
| `/admin/mail_select_list` | POST | 수신 대상 목록(발송) |

### 2.20 글/댓글 현황
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/write_count` | GET | 글/댓글 현황 그래프 |

### 2.21 플러그인
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/plugin_list` | GET | 플러그인 목록 |
| `/admin/plugin_detail` | POST | 플러그인 상세(폼) |
| `/admin/plugin_update` | POST | 플러그인 활성/비활성 |
| `/admin/plugin/screenshot/{module_name}` | GET | 플러그인 스크린샷 |

### 2.22 캐시
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/cache_file_delete` | GET | 캐시 파일 삭제 화면 |
| `/admin/cache_file_deleting` | GET | 캐시 파일 삭제 실행(SSE) |

### 2.23 부가서비스
| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/admin/service` | GET | 부가서비스 화면 |

---

## 3. LawyGo에서 100% 재구현을 위한 참고

- **현재**: G6 관리자 콘솔은 **HTML 폼 + 서버 렌더링**(Jinja)으로 동작하며, 관리 전용 **JSON API는 제공하지 않습니다**.
- **LawyGo 연동**: LawyGo 관리자 페이지에서 **"G6 관리자 콘솔"**을 열어 동일한 G6 admin 화면을 그대로 사용할 수 있습니다 (같은 기능 100% 사용).
- **프론트 재구현**: 위 기능을 LawyGo React 화면으로 **완전히 다시 만들려면**,
  1. G6 측에 **Admin 전용 JSON API**(회원 CRUD, 게시판 CRUD, 설정 CRUD 등)를 추가하거나,
  2. LawyGo 백엔드에서 G6 admin 폼을 대신 호출하는 프록시를 두는 방식이 필요합니다.  
  G6 API v1(`/api/v1`)은 게시판·설정 조회 등은 있으나, **관리자용 수정/삭제 API**는 없습니다.

이 문서는 `g6/admin/` 소스와 라우터를 기준으로 작성되었습니다.
