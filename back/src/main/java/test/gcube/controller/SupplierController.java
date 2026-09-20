package test.gcube.controller;

import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import test.gcube.dto.SupplierResponse;
import test.gcube.repository.SupplierRepository;

/**
 * 공급처 목록. 발주 화면에서 기본 공급처 대신 다른 곳을 고를 때 쓴다.
 * 조회만 하므로 서비스를 두지 않는다.
 */
@RestController
@RequestMapping("/api/suppliers")
@RequiredArgsConstructor
public class SupplierController {

    private final SupplierRepository supplierRepository;

    @GetMapping
    public List<SupplierResponse> findAll() {
        return supplierRepository.findAll().stream()
                .sorted(Comparator.comparing(s -> s.getCode()))
                .map(SupplierResponse::from)
                .toList();
    }
}
