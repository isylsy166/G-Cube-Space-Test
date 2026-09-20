package test.gcube.controller;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import test.gcube.dto.ItemDetailResponse;
import test.gcube.dto.ItemSummaryResponse;
import test.gcube.dto.ItemUnitGroupResponse;
import test.gcube.service.ItemQueryService;

/** 제품 페이지 API. (요구사항 4-1) */
@RestController
@RequestMapping("/api/items")
@RequiredArgsConstructor
public class ItemController {

    private final ItemQueryService itemQueryService;

    /** 품목 목록과 창고 합계 재고. 사용 중지된 창고 수량은 따로 떼어 준다. */
    @GetMapping
    public List<ItemSummaryResponse> findAll() {
        return itemQueryService.findAll();
    }

    /**
     * 시리얼 개체 전부를 품목별로 묶어서. 개체 현황 화면이 이 한 건만 부른다.
     * 고정 경로라 아래 {@code /{code}} 보다 먼저 매칭된다.
     */
    @GetMapping("/units")
    public List<ItemUnitGroupResponse> findAllUnits() {
        return itemQueryService.findAllUnits();
    }

    /** 품목 상세. 창고별 재고, 시리얼 개체, 이 품목으로 걸려 있는 입고예정 문서. */
    @GetMapping("/{code}")
    public ItemDetailResponse findByCode(@PathVariable String code) {
        return itemQueryService.findByCode(code);
    }
}
