package test.gcube.service;

import test.gcube.entity.Item;

/** 세트를 전개하고 서비스를 걸러낸 뒤 남은 준비 수요 한 건. */
public record ItemDemand(Item item, int quantity) {
}
