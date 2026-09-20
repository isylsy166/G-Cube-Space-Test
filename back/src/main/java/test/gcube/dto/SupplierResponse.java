package test.gcube.dto;

import test.gcube.entity.Supplier;

/** 발주 화면에서 공급처를 고를 때 쓰는 한 줄. */
public record SupplierResponse(
        String code,
        String name,
        String type,
        String typeLabel,
        int leadTimeDays
) {
    public static SupplierResponse from(Supplier supplier) {
        return new SupplierResponse(
                supplier.getCode(),
                supplier.getName(),
                supplier.getType().name(),
                supplier.getType().getLabel(),
                supplier.getLeadTimeDays());
    }
}
