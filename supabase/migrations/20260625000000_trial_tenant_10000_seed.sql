-- 체험판(관리번호 10000) — 기능별 샘플 1건 + 기존 데이터 정리

UPDATE public.company_groups
SET group_name = 'LawyGo 체험판',
    memo = '관리번호 10000 — 기능별 샘플 1건',
    updated_at = NOW()
WHERE management_number = '10000';

-- 기존 체험 테넌트 데이터 전부 삭제 후 1건씩 재시드
DELETE FROM public.deadlines WHERE management_number = '10000';
DELETE FROM public.cases WHERE management_number = '10000';
DELETE FROM public.clients WHERE management_number = '10000';

DO $$
DECLARE
  v_client_id UUID := gen_random_uuid();
  v_case_id UUID := gen_random_uuid();
  v_deadline_date DATE := CURRENT_DATE + 7;
BEGIN
  INSERT INTO public.clients (
    id, name, position, contact_phone, memo, management_number, created_at, updated_at
  ) VALUES (
    v_client_id,
    '체험 의뢰인',
    '원고',
    '010-0000-1000',
    '체험판 샘플 의뢰인',
    '10000',
    NOW(),
    NOW()
  );

  INSERT INTO public.cases (
    id,
    case_number,
    case_type,
    case_name,
    court,
    client_id,
    client_name,
    client_position,
    opponent_name,
    status,
    assigned_staff_name,
    assistants,
    received_date,
    amount,
    received_amount,
    pending_amount,
    is_electronic,
    is_urgent,
    is_immutable_deadline,
    notes,
    trial_level,
    management_number,
    created_at,
    updated_at
  ) VALUES (
    v_case_id,
    '2026가합10000',
    '민사',
    '손해배상(체험)',
    '서울중앙지방법원',
    v_client_id,
    '체험 의뢰인',
    '원고',
    '상대방',
    '진행중',
    '신강',
    '',
    CURRENT_DATE - 30,
    3000000,
    1500000,
    1500000,
    true,
    false,
    false,
    '체험판 샘플 사건 — 사건관리·기일달력 연동용',
    '1심',
    '10000',
    NOW(),
    NOW()
  );

  INSERT INTO public.deadlines (
    case_id,
    deadline_date,
    deadline_type,
    court,
    memo,
    management_number,
    created_at,
    updated_at
  ) VALUES (
    v_case_id,
    v_deadline_date,
    '변론기일',
    '서울중앙지방법원',
    '체험판 샘플 기일',
    '10000',
    NOW(),
    NOW()
  );
END $$;
