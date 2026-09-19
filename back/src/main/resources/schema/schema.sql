SET NAMES utf8mb4;

-- =========================================================
-- 1. 공급처
-- =========================================================
CREATE TABLE `supplier` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `code` VARCHAR(50) NOT NULL COMMENT '공급처 코드',
    `name` VARCHAR(100) NOT NULL COMMENT '공급처명',
    `type` VARCHAR(20) NOT NULL COMMENT '구분(구매처/생산처)',
    `lead_time_days` INT NOT NULL DEFAULT 0 COMMENT '리드타임 일수',

    PRIMARY KEY (`id`),
    UNIQUE KEY `UK_SUPPLIER_CODE` (`code`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='공급처';


-- =========================================================
-- 2. 창고
-- =========================================================
CREATE TABLE `warehouse` (
     `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
     `code` VARCHAR(50) NOT NULL COMMENT '창고 코드',
     `name` VARCHAR(100) NOT NULL COMMENT '창고명',
     `status` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '운영상태',

     PRIMARY KEY (`id`),
     UNIQUE KEY `UK_WAREHOUSE_CODE` (`code`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='창고';


-- =========================================================
-- 3. 품목
-- =========================================================
CREATE TABLE `item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `supplier_id` BIGINT NOT NULL COMMENT '공급처 아이디',
    `code` VARCHAR(50) NOT NULL COMMENT '품목 코드',
    `name` VARCHAR(100) NOT NULL COMMENT '품목명',
    `type` VARCHAR(50) NOT NULL COMMENT '유형',
    `category` VARCHAR(50) NOT NULL COMMENT '분류',
    `is_serial` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '시리얼 관리 여부',
    `spec` VARCHAR(255) NULL COMMENT '규격',
    PRIMARY KEY (`id`),
    UNIQUE KEY `UK_ITEM_CODE` (`code`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='품목';


-- =========================================================
-- 4. 세트
-- =========================================================
CREATE TABLE `item_set` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `code` VARCHAR(50) NOT NULL COMMENT '세트 코드',
    `name` VARCHAR(100) NOT NULL COMMENT '세트명',
    PRIMARY KEY (`id`),
    UNIQUE KEY `UK_ITEM_SET_CODE` (`code`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='세트';


-- =========================================================
-- 5. 세트 구성
-- =========================================================
CREATE TABLE `item_set_component` (
`id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
`item_set_id` BIGINT NOT NULL COMMENT '세트 아이디',
`item_id` BIGINT NOT NULL COMMENT '품목 아이디',
`quantity` INT NOT NULL COMMENT '구성 수량',
`is_shipping` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '출고 대상 여부',

PRIMARY KEY (`id`),
UNIQUE KEY `UK_ITEM_SET_COMPONENT`
  (`item_set_id`, `item_id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='세트 구성';


-- =========================================================
-- 6. 재고
-- =========================================================
CREATE TABLE `stock` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `warehouse_id` BIGINT NOT NULL COMMENT '창고 아이디',
    `item_id` BIGINT NOT NULL COMMENT '품목 아이디',
    `quantity` INT NOT NULL DEFAULT 0 COMMENT '현재 재고 수량',
    `booked_quantity` INT NOT NULL DEFAULT 0 COMMENT '예약된 재고 수량',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',

    PRIMARY KEY (`id`),

    UNIQUE KEY `UK_STOCK_WAREHOUSE_ITEM`
     (`warehouse_id`, `item_id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='재고';


-- =========================================================
-- 7. 품목 개체
-- 시리얼 관리 대상 품목만 사용
-- =========================================================
CREATE TABLE `item_unit` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `stock_id` BIGINT NOT NULL COMMENT '재고 아이디',
    `serial_number` VARCHAR(255) NOT NULL COMMENT '시리얼 번호',
    `location` VARCHAR(255) NULL COMMENT '보관 위치',
    `status` VARCHAR(30) NOT NULL DEFAULT 'NORMAL'
     COMMENT '상태(정상/예약/판매완료)',
    `order_id` BIGINT NULL COMMENT '배정된 주문 아이디',
    PRIMARY KEY (`id`),
    UNIQUE KEY `UK_ITEM_UNIT_SERIAL_NUMBER`
     (`serial_number`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='품목 개체';


-- =========================================================
-- 8. 입고 예정
-- =========================================================
CREATE TABLE `stock_schedule` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `supplier_id` BIGINT NOT NULL COMMENT '공급처 아이디',
    `warehouse_id` BIGINT NOT NULL COMMENT '창고 아이디',
    `item_id` BIGINT NOT NULL COMMENT '품목 아이디',

    `code` VARCHAR(50) NULL COMMENT '문서 번호',
    `type` VARCHAR(20) NOT NULL COMMENT '유형(생산/구매)',
    `status` VARCHAR(30) NULL COMMENT '진행 상태',

    `plan_quantity` INT NOT NULL DEFAULT 0 COMMENT '계획 수량',
    `received_quantity` INT NOT NULL DEFAULT 0 COMMENT '입고 수량',

    `available_at` DATETIME NULL COMMENT '사용 가능 예정일',
    `inspect_status` VARCHAR(30) NOT NULL COMMENT '검사 상태',
    `is_confirmed` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '확정 여부',
    `order_id` BIGINT NULL COMMENT '이 문서를 만들게 한 주문 아이디',

    PRIMARY KEY (`id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='입고 예정';


-- =========================================================
-- 9. 주문
-- =========================================================
CREATE TABLE `orders` (
`id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
`warehouse_id` BIGINT NOT NULL COMMENT '출고 창고 아이디',
`order_number` VARCHAR(50) NOT NULL COMMENT '주문 번호',
`order_status` VARCHAR(30) NOT NULL COMMENT '주문 상태',
`delivery_at` DATETIME NULL COMMENT '배송 예정일',
`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '주문 접수 일시',
`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
PRIMARY KEY (`id`),
UNIQUE KEY `UK_ORDERS_ORDER_NUMBER`
  (`order_number`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='주문';


-- =========================================================
-- 10. 주문 상세
--
-- 단품 주문:
-- item_id     = 값
-- item_set_id = NULL
--
-- 세트 주문:
-- item_id     = NULL
-- item_set_id = 값
-- =========================================================
CREATE TABLE `order_detail` (
`id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
`order_id` BIGINT NOT NULL COMMENT '주문 아이디',
`item_id` BIGINT NULL COMMENT '품목 아이디',
`item_set_id` BIGINT NULL COMMENT '세트 아이디',
`sequence` INT NOT NULL COMMENT '품목 순서',
`order_quantity` INT NOT NULL COMMENT '주문 수량',
`status` VARCHAR(30) NOT NULL DEFAULT 'NORMAL' COMMENT '품목 상태(정상/취소)',
PRIMARY KEY (`id`),
UNIQUE KEY `UK_ORDER_DETAIL_SEQUENCE`
    (`order_id`, `sequence`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='주문 상세';


-- =========================================================
-- 11. 주문 예약
--
-- 한 주문이 특정 재고에서 몇 개를 잡아두었는지 기록한다.
-- stock.booked_quantity 의 내역이며, 출고할 때 얼마를 되돌릴지 알기 위해 필요하다.
-- (order_id, item_id) 를 UNIQUE 로 묶어 같은 예약 요청이 두 번 반영되지 않게 한다.
-- =========================================================
CREATE TABLE `order_reservation` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `order_id` BIGINT NOT NULL COMMENT '주문 아이디',
    `item_id` BIGINT NOT NULL COMMENT '품목 아이디',
    `stock_id` BIGINT NOT NULL COMMENT '재고 아이디',
    `quantity` INT NOT NULL COMMENT '예약 수량',
    `status` VARCHAR(30) NOT NULL DEFAULT 'RESERVED'
     COMMENT '상태(예약/출고완료)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    PRIMARY KEY (`id`),
    UNIQUE KEY `UK_ORDER_RESERVATION_ORDER_ITEM` (`order_id`, `item_id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='주문 예약';


-- =========================================================
-- 12. 재고 이력
--
-- 예약·출고·입고로 수량이 어떻게 바뀌었는지 남긴다.
-- 변화량과 변화 후 값을 함께 적어 사후에 재계산 없이 추적할 수 있게 한다.
-- =========================================================
CREATE TABLE `stock_ledger` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `stock_id` BIGINT NOT NULL COMMENT '재고 아이디',
    `order_id` BIGINT NULL COMMENT '관련 주문 아이디',
    `stock_schedule_id` BIGINT NULL COMMENT '관련 입고예정 아이디',

    `type` VARCHAR(30) NOT NULL COMMENT '유형(예약/예약해제/출고/입고)',
    `quantity_delta` INT NOT NULL DEFAULT 0 COMMENT '현재고 변화량',
    `booked_delta` INT NOT NULL DEFAULT 0 COMMENT '예약수량 변화량',
    `quantity_after` INT NOT NULL COMMENT '변화 후 현재고',
    `booked_after` INT NOT NULL COMMENT '변화 후 예약수량',
    `memo` VARCHAR(255) NULL COMMENT '설명',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',

    PRIMARY KEY (`id`),
    KEY `IX_STOCK_LEDGER_STOCK` (`stock_id`, `id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='재고 이력';


-- =========================================================
-- 13. 처리 요청 기록
--
-- 발주 생성과 입고 처리처럼 같은 요청이 여러 번 와도 한 번만 반영해야 하는
-- 명령의 멱등 키를 담는다. UNIQUE 제약이 중복 반영을 막는 실제 방어선이다.
-- 예약·피킹·출고는 상태 자체로 중복을 걸러내므로 키가 없어도 된다.
-- =========================================================
CREATE TABLE `request_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '아이디',
    `idempotency_key` VARCHAR(100) NOT NULL COMMENT '멱등 키',
    `request_type` VARCHAR(30) NOT NULL COMMENT '요청 종류',
    `result_code` VARCHAR(100) NULL COMMENT '처리 결과 식별값(문서번호 등)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',

    PRIMARY KEY (`id`),
    UNIQUE KEY `UK_REQUEST_LOG_KEY` (`idempotency_key`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='처리 요청 기록';
