// 제품 페이지 — 품목 기준으로 재고 상태를 본다. (요구사항 4-1)

let items = [];
let selected = null;

async function load() {
    items = await api.get('/api/items');
    fillOptions('category', [...new Set(items.map((i) => i.category))]);
    fillOptions('type', [...new Set(items.map((i) => i.typeLabel))]);
    draw();

    const wanted = param('code') || (items[0] && items[0].code);
    if (wanted) select(wanted);
}

function fillOptions(id, values) {
    const select = document.getElementById(id);
    values.sort().forEach((v) => select.insertAdjacentHTML('beforeend',
        `<option value="${esc(v)}">${esc(v)}</option>`));
}

function visible() {
    const keyword = document.getElementById('keyword').value.trim().toLowerCase();
    const category = document.getElementById('category').value;
    const type = document.getElementById('type').value;
    const serialOnly = document.getElementById('serialOnly').checked;
    return items.filter((i) =>
        (!keyword || i.code.toLowerCase().includes(keyword) || i.name.toLowerCase().includes(keyword))
        && (!category || i.category === category)
        && (!type || i.typeLabel === type)
        && (!serialOnly || i.serial));
}

function draw() {
    const list = visible();
    document.getElementById('itemCount').textContent = `${list.length} / ${items.length}`;
    document.getElementById('itemList').innerHTML = table(
        ['품목코드', '품목명', '분류', '유형', '시리얼', {num: '현재고'}, {num: '예약'}, {num: '가용'}, {num: '중지창고'}],
        rows(list, (i) => `
            <tr class="pick ${i.code === selected ? 'on' : ''}" data-code="${esc(i.code)}">
                <td>${esc(i.code)}</td>
                <td>${esc(i.name)}</td>
                <td>${esc(i.category)}</td>
                <td>${esc(i.typeLabel)}</td>
                <td>${i.serial ? '<span class="tag ok">관리</span>' : '—'}</td>
                <td class="num">${i.quantity}</td>
                <td class="num">${i.bookedQuantity}</td>
                <td class="num"><b>${i.availableQuantity}</b></td>
                <td class="num">${i.inactiveWarehouseQuantity || '—'}</td>
            </tr>`, '조건에 맞는 품목이 없습니다.', 9));

    document.querySelectorAll('#itemList tr.pick').forEach((tr) =>
        tr.onclick = () => select(tr.dataset.code));
}

async function select(code) {
    selected = code;
    draw();
    history.replaceState(null, '', `/items?code=${encodeURIComponent(code)}`);

    const d = await api.get('/api/items/' + encodeURIComponent(code));
    document.getElementById('detail').innerHTML = `
        <h2>${esc(d.item.code)} · ${esc(d.item.name)}</h2>
        <div class="body">
            <dl class="kv">
                <dt>분류 / 유형</dt><dd>${esc(d.item.category)} · ${esc(d.item.typeLabel)}</dd>
                <dt>규격</dt><dd>${dash(d.item.spec)}</dd>
                <dt>기본 공급처</dt><dd>${esc(d.item.supplierName)} (${esc(d.item.supplierCode)})</dd>
                <dt>시리얼 관리</dt><dd>${d.item.serial ? '예' : '아니오'}</dd>
            </dl>
        </div>

        <section class="block">
            <h3>창고별 재고 — 가용재고는 현재고에서 예약수량을 뺀 값입니다</h3>
            ${table(['창고', '운영상태', {num: '현재고'}, {num: '예약수량'}, {num: '가용재고'}],
                rows(d.stocks, (s) => `
                    <tr class="${s.active ? '' : 'dim'}">
                        <td>${esc(s.warehouseCode)} · ${esc(s.warehouseName)}</td>
                        <td>${s.active
                            ? '<span class="tag ok">사용 중</span>'
                            : '<span class="tag">사용 중지</span>'}</td>
                        <td class="num">${s.quantity}</td>
                        <td class="num">${s.bookedQuantity}</td>
                        <td class="num"><b>${s.active ? s.availableQuantity : '—'}</b></td>
                    </tr>`, '재고 기록이 없습니다.', 5))}
        </section>

        ${d.item.serial ? `
        <section class="block">
            <h3>시리얼 개체</h3>
            <div class="scroll">
            ${table(['시리얼번호', '창고', '보관위치', '상태', '배정된 주문'],
                rows(d.units, (u) => `
                    <tr class="${u.onHand ? '' : 'dim'}">
                        <td>${esc(u.serialNumber)}</td>
                        <td>${esc(u.warehouseCode)}</td>
                        <td>${dash(u.location)}</td>
                        <td><span class="tag ${u.status === 'NORMAL' ? 'ok' : u.status === 'RESERVED' ? 'wait' : ''}">${esc(u.statusLabel)}</span></td>
                        <td>${linkOrder(u.assignedOrderNumber)}</td>
                    </tr>`, '등록된 개체가 없습니다.', 5))}
            </div>
        </section>` : ''}

        <section class="block">
            <h3>이 품목을 기다리는 주문</h3>
            ${table(['주문번호', '창고', '배송예정', '준비상태', {num: '필요'}, {num: '부족'}],
                rows(d.waitingOrders, (w) => `
                    <tr class="${w.shortageQuantity > 0 ? 'blocked' : ''}">
                        <td>${linkOrder(w.orderNumber)}</td>
                        <td>${esc(w.warehouseCode)}</td>
                        <td>${day(w.deliveryAt)}</td>
                        <td>${readinessTag(w.readinessStatus, w.readinessStatusLabel)}</td>
                        <td class="num">${w.requiredQuantity}</td>
                        <td class="num">${w.shortageQuantity || '—'}</td>
                    </tr>`, '이 품목을 기다리는 주문이 없습니다.', 6))}
        </section>

        <section class="block">
            <h3>걸려 있는 발주 · 생산 문서</h3>
            ${table(['문서번호', '구분', '창고', {num: '계획'}, {num: '입고'}, {num: '남은'}, '사용가능', '진행상태', '판정반영'],
                rows(d.schedules, (s) => `
                    <tr class="${s.usableForPlanning ? '' : 'dim'}">
                        <td>${linkSchedule(s.code)}</td>
                        <td>${esc(s.typeLabel)}</td>
                        <td>${esc(s.warehouseCode)}</td>
                        <td class="num">${s.planQuantity}</td>
                        <td class="num">${s.receivedQuantity}</td>
                        <td class="num"><b>${s.remainingQuantity}</b></td>
                        <td>${day(s.availableAt)}</td>
                        <td>${dash(s.statusLabel)}</td>
                        <td>${s.usableForPlanning
                            ? '<span class="tag ok">사용</span>'
                            : '<span class="tag">제외</span>'}</td>
                    </tr>`, '걸려 있는 문서가 없습니다.', 9))}
        </section>

        <section class="block">
            <h3>재고 이력 — 예약 · 출고 · 입고로 수량이 바뀐 기록</h3>
            <div class="scroll">${ledgerTable(d.ledgers)}</div>
        </section>`;
}

['keyword', 'category', 'type', 'serialOnly'].forEach((id) => {
    const node = document.getElementById(id);
    node.addEventListener(node.type === 'checkbox' ? 'change' : 'input', draw);
});

load().catch((e) => flash(e.message, true));
