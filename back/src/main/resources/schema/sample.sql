-- 접속 문자셋을 파일 안에서 못박는다.
-- 컨테이너의 mysql 클라이언트는 기본값이 utf8mb4 가 아니라,
-- 이 줄이 없으면 CLI 로 적재할 때 한글이 깨져 들어간다.
SET NAMES utf8mb4;

-- =========================================================
-- 재고 흐름 ERP 과제 — 샘플 데이터
--
-- 출처 : .claude/재고흐름ERP과제_example-data_실무형_v2.xlsx
-- 대상 : src/main/resources/schema/schema.sql 의 10개 테이블
-- 기준시각 : 2026-07-21 09:00:00 (Asia/Seoul)
--
-- 엑셀의 한글 업무 상태값은 아래 코드로 치환했습니다.
--
--   supplier.type        구매처=PURCHASE / 생산처=PRODUCTION / 자사=INHOUSE
--   warehouse.status     사용 중=TRUE / 사용 중지=FALSE
--   item.type            생산품=MANUFACTURED / 매입품=PURCHASED / 서비스=SERVICE
--   item_unit.status     창고 보관 중=NORMAL / 주문 배정됨=RESERVED / 출고 완료=SOLD
--   stock_schedule.type  생산=PRODUCTION / 구매=PURCHASE
--   stock_schedule.status
--                        작성 중=DRAFT / 발주 확정=CONFIRMED / 진행 중=IN_PROGRESS
--                        생산 완료=PRODUCED / 부분 입고=PARTIAL_RECEIVED
--                        검사 완료=INSPECTED / 입고 완료=RECEIVED
--   stock_schedule.inspect_status
--                        해당 없음=NOT_APPLICABLE / 검사 전=BEFORE_INSPECTION
--                        검사 대기=WAITING_INSPECTION / 검사 완료=INSPECTED
--   orders.order_status  주문 확정=CONFIRMED / 취소=CANCELED
--                        출고 완료=SHIPPED / 배송 완료=DELIVERED
--
-- 스키마에 자리가 없어 옮기지 못한 엑셀 컬럼은 각 섹션 주석에 적어두었습니다.
-- =========================================================

-- 재실행 가능하도록 기존 데이터를 비웁니다.
DELETE FROM `request_log`;
DELETE FROM `stock_ledger`;
DELETE FROM `order_reservation`;
DELETE FROM `order_detail`;
DELETE FROM `orders`;
DELETE FROM `stock_schedule`;
DELETE FROM `item_unit`;
DELETE FROM `stock`;
DELETE FROM `item_set_component`;
DELETE FROM `item_set`;
DELETE FROM `item`;
DELETE FROM `warehouse`;
DELETE FROM `supplier`;


-- =========================================================
-- 1. 공급처  (08_공급처)
--
-- SUP-INHOUSE 는 엑셀에 없는 보조 데이터입니다.
-- 서비스 품목(SVC-*)에는 기본 공급처가 없지만 item.supplier_id 가
-- NOT NULL 이라 자사 공급처를 하나 만들어 연결했습니다.
-- =========================================================
INSERT INTO `supplier` (`id`, `code`, `name`, `type`, `lead_time_days`) VALUES
(1, 'SUP-FOAM',    '폼텍소재',       'PURCHASE',   3),
(2, 'SUP-FRAME',   '우드프레임',     'PURCHASE',   4),
(3, 'SUP-TEX',     '텍스타일코리아', 'PURCHASE',   2),
(4, 'SUP-PILLOW',  '슬립하우스',     'PURCHASE',   2),
(5, 'FAC-01',      '1공장',          'PRODUCTION', 3),
(6, 'FAC-02',      '2공장',          'PRODUCTION', 5),
(7, 'SUP-INHOUSE', '자사',           'INHOUSE',    0);


-- =========================================================
-- 2. 창고  (03_창고)
-- =========================================================
INSERT INTO `warehouse` (`id`, `code`, `name`, `status`) VALUES
(1, 'WH-HQ',     '본사물류창고',   TRUE),
(2, 'WH-08',     '8창고',          TRUE),
(3, 'WH-CJ',     '청주물류창고',   TRUE),
(4, 'WH-LEGACY', '구창고(비활성)', FALSE);


-- =========================================================
-- 3. 품목  (01_품목)
--
-- 세트상품(SET-Z10-DMN-Q / SET-Z10-DMN-K)은 item 이 아니라
-- item_set 테이블로 분리했습니다. (스키마 설계상 주문 상세가
-- item_id / item_set_id 를 나눠 참조합니다.)
-- =========================================================
INSERT INTO `item` (`id`, `supplier_id`, `code`, `name`, `type`, `category`, `is_serial`, `spec`) VALUES
( 1, 5, 'MAT-Z10-Q',    'Z10 매트리스 Q',     'MANUFACTURED', '매트리스', TRUE,  'Q'),
( 2, 5, 'MAT-Z10-K',    'Z10 매트리스 K',     'MANUFACTURED', '매트리스', TRUE,  'K'),
( 3, 6, 'MAT-V3-Q',     'V3 매트리스 Q',      'MANUFACTURED', '매트리스', TRUE,  'Q'),
( 4, 6, 'MAT-E5-SS',    'E5 매트리스 SS',     'MANUFACTURED', '매트리스', TRUE,  'SS'),
( 5, 2, 'FRM-DMN-Q',    '데이먼 프레임 Q',    'PURCHASED',    '프레임',   TRUE,  'Q'),
( 6, 2, 'FRM-DMN-K',    '데이먼 프레임 K',    'PURCHASED',    '프레임',   TRUE,  'K'),
( 7, 2, 'FRM-LOW-Q',    '로우 프레임 Q',      'PURCHASED',    '프레임',   TRUE,  'Q'),
( 8, 3, 'CVR-WP-Q',     '방수커버 Q',         'PURCHASED',    '침구',     FALSE, 'Q'),
( 9, 3, 'CVR-WP-K',     '방수커버 K',         'PURCHASED',    '침구',     FALSE, 'K'),
(10, 1, 'TOP-LTX-Q',    '라텍스 토퍼 Q',      'PURCHASED',    '침구',     FALSE, 'Q'),
(11, 4, 'PIL-ZERO',     '제로 베개',          'PURCHASED',    '베개',     FALSE, 'STD'),
(12, 4, 'PIL-CERV',     '경추 베개',          'PURCHASED',    '베개',     FALSE, 'STD'),
(13, 7, 'SVC-INSTALL',  '설치 서비스',        'SERVICE',      '서비스',   FALSE, NULL),
(14, 7, 'SVC-DISPOSAL', '기존 매트리스 수거', 'SERVICE',      '서비스',   FALSE, NULL);


-- =========================================================
-- 4. 세트  (01_품목 중 품목유형 = 세트상품)
--
-- 분류(결합제품)와 규격(Q/K)은 화면에서 쓰는 곳이 없어 컬럼을 두지 않았습니다.
-- =========================================================
INSERT INTO `item_set` (`id`, `code`, `name`) VALUES
(1, 'SET-Z10-DMN-Q', 'Z10 + 데이먼 세트 Q'),
(2, 'SET-Z10-DMN-K', 'Z10 + 데이먼 풀세트 K');


-- =========================================================
-- 5. 세트 구성  (02_세트구성)
--
-- is_shipping = FALSE 인 서비스 항목은 재고 수요에서 제외 대상입니다.
-- =========================================================
INSERT INTO `item_set_component` (`id`, `item_set_id`, `item_id`, `quantity`, `is_shipping`) VALUES
(1, 1,  1, 1, TRUE),   -- SET-Z10-DMN-Q : MAT-Z10-Q
(2, 1,  5, 1, TRUE),   -- SET-Z10-DMN-Q : FRM-DMN-Q
(3, 1, 13, 1, FALSE),  -- SET-Z10-DMN-Q : SVC-INSTALL
(4, 2,  2, 1, TRUE),   -- SET-Z10-DMN-K : MAT-Z10-K
(5, 2,  6, 1, TRUE),   -- SET-Z10-DMN-K : FRM-DMN-K
(6, 2,  9, 1, TRUE),   -- SET-Z10-DMN-K : CVR-WP-K
(7, 2, 13, 1, FALSE),  -- SET-Z10-DMN-K : SVC-INSTALL
(8, 2, 14, 1, FALSE);  -- SET-Z10-DMN-K : SVC-DISPOSAL


-- =========================================================
-- 6. 재고  (04_재고현황)
--
-- 가용재고 = quantity - booked_quantity
-- 엑셀의 '기존예약주문번호'(ORD-PRE-001 ~ 006)는 참조용 주문이라
-- orders 테이블에 넣지 않고 booked_quantity 로만 반영했습니다.
-- =========================================================
INSERT INTO `stock` (`id`, `warehouse_id`, `item_id`, `quantity`, `booked_quantity`, `created_at`, `updated_at`) VALUES
( 1, 1,  1,  3, 1, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / MAT-Z10-Q  (ORD-PRE-001)
( 2, 1,  2,  2, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / MAT-Z10-K
( 3, 1,  3,  1, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / MAT-V3-Q
( 4, 1,  4,  2, 1, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / MAT-E5-SS  (ORD-PRE-004)
( 5, 1,  5,  1, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / FRM-DMN-Q
( 6, 1,  6,  2, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / FRM-DMN-K
( 7, 1,  7,  0, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / FRM-LOW-Q
( 8, 1,  8,  6, 1, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / CVR-WP-Q   (ORD-PRE-002)
( 9, 1,  9,  3, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / CVR-WP-K
(10, 1, 10,  4, 2, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-HQ     / TOP-LTX-Q  (ORD-PRE-005)
(11, 2, 11, 10, 2, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-08     / PIL-ZERO   (ORD-PRE-003)
(12, 2, 12,  6, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-08     / PIL-CERV
(13, 2,  8,  3, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-08     / CVR-WP-Q
(14, 2, 10,  1, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-08     / TOP-LTX-Q
(15, 3,  3,  2, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-CJ     / MAT-V3-Q
(16, 3,  7,  3, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-CJ     / FRM-LOW-Q
(17, 3,  9,  2, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-CJ     / CVR-WP-K
(18, 3, 11,  5, 1, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-CJ     / PIL-ZERO   (ORD-PRE-006)
(19, 4,  1,  5, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00'),  -- WH-LEGACY / MAT-Z10-Q
(20, 4,  5,  2, 0, '2026-07-21 09:00:00', '2026-07-21 09:00:00');  -- WH-LEGACY / FRM-DMN-Q


-- =========================================================
-- 7. 품목 개체  (05_개체재고)
--
-- item_unit 은 stock_id 로 창고·품목을 함께 참조하므로
-- 엑셀의 창고코드/품목코드는 stock_id 하나로 합쳤습니다.
--
-- '예약주문번호'는 order_id 로 반영하되, orders 에 없는 기존 예약 주문
-- (ORD-PRE-001 / ORD-PRE-004)은 NULL 로 둡니다. 그 예약 수량 자체는
-- stock.booked_quantity 에 이미 들어 있습니다.
-- '입고일시'는 스키마에 자리가 없어 주석으로 남깁니다.
-- =========================================================
INSERT INTO `item_unit` (`id`, `stock_id`, `serial_number`, `location`, `status`, `order_id`) VALUES
( 1,  1, 'UNIT-Z10-Q-0000',   'A-01-00', 'SOLD', 14),      -- 출고 완료 / ORD202607180014, 입고 2026-07-15 11:00
( 2,  1, 'UNIT-Z10-Q-0001',   'A-01-01', 'NORMAL', NULL),    -- 입고 2026-07-18 16:00
( 3,  1, 'UNIT-Z10-Q-0002',   'A-01-02', 'NORMAL', NULL),    -- 입고 2026-07-18 16:00
( 4,  1, 'UNIT-Z10-Q-0003',   'A-01-03', 'RESERVED', NULL),  -- 주문 배정됨 / ORD-PRE-001, 입고 2026-07-17 15:30
( 5,  2, 'UNIT-Z10-K-0001',   'A-04-01', 'NORMAL', NULL),    -- 입고 2026-07-19 10:00
( 6,  2, 'UNIT-Z10-K-0002',   'A-04-02', 'NORMAL', NULL),    -- 입고 2026-07-19 10:00
( 7,  3, 'UNIT-V3-Q-0001',    'A-02-01', 'NORMAL', NULL),    -- 입고 2026-07-19 17:00
( 8,  4, 'UNIT-E5-SS-0001',   'A-05-01', 'NORMAL', NULL),    -- 입고 2026-07-20 09:30
( 9,  4, 'UNIT-E5-SS-0002',   'A-05-02', 'RESERVED', NULL),  -- 주문 배정됨 / ORD-PRE-004, 입고 2026-07-20 09:30
(10,  5, 'UNIT-DMN-Q-0001',   'F-03-01', 'NORMAL', NULL),    -- 입고 2026-07-20 14:00
(11,  6, 'UNIT-DMN-K-0001',   'F-04-01', 'NORMAL', NULL),    -- 입고 2026-07-20 14:00
(12,  6, 'UNIT-DMN-K-0002',   'F-04-02', 'NORMAL', NULL),    -- 입고 2026-07-20 14:00
(13, 15, 'UNIT-V3-Q-0101',    'C-02-01', 'NORMAL', NULL),    -- 입고 2026-07-17 13:00
(14, 15, 'UNIT-V3-Q-0102',    'C-02-02', 'NORMAL', NULL),    -- 입고 2026-07-17 13:00
(15, 16, 'UNIT-LOW-Q-0101',   'C-05-01', 'NORMAL', NULL),    -- 입고 2026-07-16 15:00
(16, 16, 'UNIT-LOW-Q-0102',   'C-05-02', 'NORMAL', NULL),    -- 입고 2026-07-16 15:00
(17, 16, 'UNIT-LOW-Q-0103',   'C-05-03', 'NORMAL', NULL),    -- 입고 2026-07-16 15:00
(18, 19, 'UNIT-Z10-LEG-0001', 'L-01-01', 'NORMAL', NULL),    -- 비활성 창고, 입고 2026-06-30 09:00
(19, 19, 'UNIT-Z10-LEG-0002', 'L-01-02', 'NORMAL', NULL),    -- 비활성 창고, 입고 2026-06-30 09:00
(20, 19, 'UNIT-Z10-LEG-0003', 'L-01-03', 'NORMAL', NULL),    -- 비활성 창고, 입고 2026-06-30 09:00
(21, 19, 'UNIT-Z10-LEG-0004', 'L-01-04', 'NORMAL', NULL),    -- 비활성 창고, 입고 2026-06-30 09:00
(22, 19, 'UNIT-Z10-LEG-0005', 'L-01-05', 'NORMAL', NULL),    -- 비활성 창고, 입고 2026-06-30 09:00
(23, 20, 'UNIT-DMN-LEG-0001', 'L-03-01', 'NORMAL', NULL),    -- 비활성 창고, 입고 2026-06-30 09:00
(24, 20, 'UNIT-DMN-LEG-0002', 'L-03-02', 'NORMAL', NULL);    -- 비활성 창고, 입고 2026-06-30 09:00


-- =========================================================
-- 8. 입고 예정  (07_입고예정)
--
-- 앞으로 들어올 수량 = plan_quantity - received_quantity
-- received_quantity 는 이미 stock.quantity 에 반영된 값입니다.
-- =========================================================
INSERT INTO `stock_schedule`
(`id`, `supplier_id`, `warehouse_id`, `item_id`, `code`, `type`, `status`,
 `plan_quantity`, `received_quantity`, `available_at`, `inspect_status`, `is_confirmed`,
 `order_id`) VALUES
( 1, 5, 1,  1, 'MO-20260721-Z10',  'PRODUCTION', 'PRODUCED',         2, 0, '2026-07-22 00:00:00', 'WAITING_INSPECTION', TRUE, NULL),
( 2, 6, 1,  3, 'MO-20260722-V3',   'PRODUCTION', 'IN_PROGRESS',      2, 0, '2026-07-24 00:00:00', 'BEFORE_INSPECTION',  TRUE, NULL),
( 3, 2, 1,  5, 'PO-20260719-DMN',  'PURCHASE',   'PARTIAL_RECEIVED', 3, 1, '2026-07-24 00:00:00', 'NOT_APPLICABLE',     TRUE, NULL),
( 4, 3, 1,  8, 'PO-20260720-CVR',  'PURCHASE',   'CONFIRMED',        5, 0, '2026-07-22 00:00:00', 'NOT_APPLICABLE',     TRUE, NULL),
( 5, 4, 2, 11, 'PO-20260721-PIL',  'PURCHASE',   'DRAFT',           10, 0, '2026-07-23 00:00:00', 'NOT_APPLICABLE',     FALSE, NULL),
( 6, 1, 4,  1, 'PO-LEGACY-Z10',    'PURCHASE',   'CONFIRMED',       10, 0, '2026-07-21 00:00:00', 'NOT_APPLICABLE',     TRUE, NULL),
( 7, 1, 1, 10, 'PO-20260720-LTX',  'PURCHASE',   'CONFIRMED',        4, 0, '2026-07-22 00:00:00', 'NOT_APPLICABLE',     TRUE, NULL),
( 8, 5, 1,  2, 'MO-20260720-Z10K', 'PRODUCTION', 'PRODUCED',         2, 0, '2026-07-24 00:00:00', 'WAITING_INSPECTION', TRUE, NULL),
( 9, 6, 1,  4, 'MO-20260721-E5',   'PRODUCTION', 'IN_PROGRESS',      2, 0, '2026-07-25 00:00:00', 'BEFORE_INSPECTION',  TRUE, NULL),
(10, 3, 3,  9, 'PO-20260718-CVRK', 'PURCHASE',   'RECEIVED',         3, 3, '2026-07-19 00:00:00', 'NOT_APPLICABLE',     TRUE, NULL),
(11, 6, 3,  3, 'MO-20260719-V3C',  'PRODUCTION', 'INSPECTED',        1, 0, '2026-07-22 00:00:00', 'INSPECTED',          TRUE, NULL),
(12, 2, 1,  6, 'PO-20260721-FRMK', 'PURCHASE',   'DRAFT',            2, 0, '2026-07-25 00:00:00', 'NOT_APPLICABLE',     FALSE, NULL);


-- =========================================================
-- 9. 주문  (06_주문)
--
-- 엑셀의 '출고창고코드'는 한 주문 안에서 항상 같은 값이라 orders.warehouse_id
-- 에 실었습니다. 주문은 이 창고의 재고만 사용합니다. (요구사항 3-2)
-- =========================================================
INSERT INTO `orders` (`id`, `warehouse_id`, `order_number`, `order_status`, `delivery_at`,
                      `created_at`, `updated_at`) VALUES
(1, 1, 'ORD202607200001', 'CONFIRMED', '2026-07-22 00:00:00', '2026-07-20 10:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(2, 1, 'ORD202607200002', 'CONFIRMED', '2026-07-23 00:00:00', '2026-07-20 14:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(3, 1, 'ORD202607200003', 'CONFIRMED', '2026-07-24 00:00:00', '2026-07-20 09:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(4, 1, 'ORD202607190004', 'CANCELED',  '2026-07-23 00:00:00', '2026-07-19 15:00:00', '2026-07-21 08:30:00'),  -- WH-HQ / 주문 자체가 취소
(5, 1, 'ORD202607200005', 'CONFIRMED', '2026-07-25 00:00:00', '2026-07-20 15:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(6, 1, 'ORD202607200006', 'CONFIRMED', '2026-07-22 00:00:00', '2026-07-20 11:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(7, 1, 'ORD202607200007', 'CONFIRMED', '2026-07-23 00:00:00', '2026-07-20 16:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(8, 1, 'ORD202607200008', 'CONFIRMED', '2026-07-25 00:00:00', '2026-07-20 17:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(9, 2, 'ORD202607200009', 'CONFIRMED', '2026-07-22 00:00:00', '2026-07-20 13:00:00', '2026-07-21 08:30:00'),  -- WH-08
(10, 4, 'ORD202607200010', 'CONFIRMED', '2026-07-24 00:00:00', '2026-07-20 12:00:00', '2026-07-21 08:30:00'),  -- WH-LEGACY / 비활성 창고
(11, 1, 'ORD202607200011', 'CONFIRMED', '2026-07-24 00:00:00', '2026-07-20 12:30:00', '2026-07-21 08:30:00'),  -- WH-HQ / 상세는 아래 주석 참고
(12, 2, 'ORD202607200012', 'CONFIRMED', '2026-07-23 00:00:00', '2026-07-20 17:30:00', '2026-07-21 08:30:00'),  -- WH-08
(13, 1, 'ORD202607190013', 'SHIPPED',   '2026-07-22 00:00:00', '2026-07-19 09:30:00', '2026-07-21 08:30:00'),  -- WH-HQ
(14, 1, 'ORD202607180014', 'DELIVERED', '2026-07-22 00:00:00', '2026-07-18 10:30:00', '2026-07-21 08:30:00'),  -- WH-HQ
(15, 1, 'ORD202607200015', 'CONFIRMED', '2026-07-25 00:00:00', '2026-07-20 18:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(16, 1, 'ORD202607200016', 'CONFIRMED', '2026-07-22 00:00:00', '2026-07-20 08:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(17, 3, 'ORD202607200017', 'CONFIRMED', '2026-07-22 00:00:00', '2026-07-20 09:30:00', '2026-07-21 08:30:00'),  -- WH-CJ
(18, 2, 'ORD202607200018', 'CONFIRMED', '2026-07-23 00:00:00', '2026-07-20 10:30:00', '2026-07-21 08:30:00'),  -- WH-08
(19, 1, 'ORD202607200019', 'CONFIRMED', '2026-07-23 00:00:00', '2026-07-20 11:30:00', '2026-07-21 08:30:00'),  -- WH-HQ
(20, 1, 'ORD202607200020', 'CONFIRMED', '2026-07-24 00:00:00', '2026-07-20 13:30:00', '2026-07-21 08:30:00'),  -- WH-HQ
(21, 3, 'ORD202607200021', 'CONFIRMED', '2026-07-24 00:00:00', '2026-07-20 14:30:00', '2026-07-21 08:30:00'),  -- WH-CJ
(22, 1, 'ORD202607200022', 'CONFIRMED', '2026-07-25 00:00:00', '2026-07-20 15:30:00', '2026-07-21 08:30:00'),  -- WH-HQ
(23, 2, 'ORD202607200023', 'CONFIRMED', '2026-07-25 00:00:00', '2026-07-20 16:30:00', '2026-07-21 08:30:00'),  -- WH-08
(24, 1, 'ORD202607200024', 'CONFIRMED', '2026-07-26 00:00:00', '2026-07-20 17:00:00', '2026-07-21 08:30:00'),  -- WH-HQ
(25, 1, 'ORD202607200025', 'CONFIRMED', '2026-07-26 00:00:00', '2026-07-20 18:30:00', '2026-07-21 08:30:00'),  -- WH-HQ
(26, 1, 'ORD202607200026', 'CONFIRMED', '2026-07-22 00:00:00', '2026-07-20 07:00:00', '2026-07-21 08:30:00'),  -- WH-HQ / 수량 0
(27, 2, 'ORD202607200027', 'CONFIRMED', '2026-07-27 00:00:00', '2026-07-20 19:00:00', '2026-07-21 08:30:00'),  -- WH-08
(28, 3, 'ORD202607210028', 'CONFIRMED', '2026-07-28 00:00:00', '2026-07-21 08:00:00', '2026-07-21 08:30:00'),  -- WH-CJ
(29, 1, 'ORD202607210029', 'CONFIRMED', '2026-07-27 00:00:00', '2026-07-21 08:20:00', '2026-07-21 08:30:00');  -- WH-HQ


-- =========================================================
-- 10. 주문 상세  (06_주문)
--
-- 단품 주문 : item_id = 값,  item_set_id = NULL
-- 세트 주문 : item_id = NULL, item_set_id = 값
--
-- status = CANCELED 인 라인은 준비 수량에서 제외됩니다. (요구사항 3-1)
--
-- 반영하지 못한 엑셀 내용
--  · ORD202607200011 순번 1 은 품목코드가 UNKNOWN-SKU 로,
--    item 테이블에 대응 품목이 없어 상세를 넣지 못했습니다.
--    (주문 헤더만 존재하는 '확인 필요' 케이스로 남겨둡니다.)
-- =========================================================
INSERT INTO `order_detail` (`id`, `order_id`, `item_id`, `item_set_id`, `sequence`,
                            `order_quantity`, `status`) VALUES
( 1,  1,    1, NULL, 1, 1, 'NORMAL'),  -- MAT-Z10-Q
( 2,  2, NULL,    1, 1, 1, 'NORMAL'),  -- SET-Z10-DMN-Q
( 3,  3,    3, NULL, 1, 1, 'NORMAL'),  -- MAT-V3-Q
( 4,  3,    8, NULL, 2, 1, 'NORMAL'),  -- CVR-WP-Q
( 5,  3,    8, NULL, 3, 2, 'CANCELED'),  -- CVR-WP-Q / 엑셀상 '취소' 라인
( 6,  4,    1, NULL, 1, 1, 'NORMAL'),  -- MAT-Z10-Q / 취소된 주문
( 7,  5,    5, NULL, 1, 2, 'NORMAL'),  -- FRM-DMN-Q
( 8,  6,    8, NULL, 1, 2, 'NORMAL'),  -- CVR-WP-Q
( 9,  7,    1, NULL, 1, 1, 'NORMAL'),  -- MAT-Z10-Q
(10,  8,    3, NULL, 1, 2, 'NORMAL'),  -- MAT-V3-Q
(11,  9,   11, NULL, 1, 4, 'NORMAL'),  -- PIL-ZERO
(12, 10,    1, NULL, 1, 1, 'NORMAL'),  -- MAT-Z10-Q / 비활성 창고 출고
(13, 12,   11, NULL, 1, 5, 'NORMAL'),  -- PIL-ZERO
(14, 13,    8, NULL, 1, 1, 'NORMAL'),  -- CVR-WP-Q
(15, 14,    1, NULL, 1, 1, 'NORMAL'),  -- MAT-Z10-Q
(16, 15,    3, NULL, 1, 1, 'NORMAL'),  -- MAT-V3-Q
(17, 15,    8, NULL, 2, 1, 'NORMAL'),  -- CVR-WP-Q
(18, 16, NULL,    2, 1, 1, 'NORMAL'),  -- SET-Z10-DMN-K
(19, 17,    3, NULL, 1, 1, 'NORMAL'),  -- MAT-V3-Q
(20, 17,    7, NULL, 2, 1, 'NORMAL'),  -- FRM-LOW-Q
(21, 18,   12, NULL, 1, 3, 'NORMAL'),  -- PIL-CERV
(22, 19,   10, NULL, 1, 3, 'NORMAL'),  -- TOP-LTX-Q
(23, 20,    4, NULL, 1, 2, 'NORMAL'),  -- MAT-E5-SS
(24, 21,   11, NULL, 1, 5, 'NORMAL'),  -- PIL-ZERO
(25, 22,    2, NULL, 1, 2, 'NORMAL'),  -- MAT-Z10-K
(26, 23,    8, NULL, 1, 2, 'NORMAL'),  -- CVR-WP-Q
(27, 23,   10, NULL, 2, 1, 'NORMAL'),  -- TOP-LTX-Q
(28, 24,    7, NULL, 1, 2, 'NORMAL'),  -- FRM-LOW-Q
(29, 25,    3, NULL, 1, 1, 'NORMAL'),  -- MAT-V3-Q
(30, 26,    8, NULL, 1, 0, 'NORMAL'),  -- CVR-WP-Q / 수량 0
(31, 27,   11, NULL, 1, 3, 'NORMAL'),  -- PIL-ZERO
(32, 27,   12, NULL, 2, 2, 'NORMAL'),  -- PIL-CERV
(33, 28,    9, NULL, 1, 2, 'NORMAL'),  -- CVR-WP-K
(34, 28,    7, NULL, 2, 1, 'NORMAL'),  -- FRM-LOW-Q
(35, 29, NULL,    1, 1, 1, 'NORMAL'),  -- SET-Z10-DMN-Q
(36, 29,   14, NULL, 2, 1, 'NORMAL');  -- SVC-DISPOSAL / 서비스, 재고 수요 없음


-- =========================================================
-- 11~13. 주문 예약 / 재고 이력 / 처리 요청 기록
--
-- 앱이 예약·출고·발주·입고를 처리하면서 쌓는 테이블이라 초기 데이터는 없습니다.
-- 기준시각에 이미 잡혀 있던 예약은 stock.booked_quantity 로만 표현됩니다.
-- =========================================================
