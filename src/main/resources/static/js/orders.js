// 주문 페이지 — 한 행이 주문 1건. 판정 결과와 처리 액션을 함께 둔다. (요구사항 4-2)

let orders = [];
let selected = null;

async function load(keepSelection = true) {
    const query = new URLSearchParams();
    ['readiness', 'status', 'warehouseCode'].forEach((key) => {
        const id = key === 'warehouseCode' ? 'warehouse' : key;
        const value = document.getElementById(id).value;
        if (value) query.set(key, value);
    });

    orders = await api.get('/api/orders' + (query.toString() ? '?' + query : ''));
    fillOnce();
    draw();

    const wanted = (keepSelection && selected) || param('order') || (visible()[0] && visible()[0].orderNumber);
    if (wanted) select(wanted);
}

let filled = false;
function fillOnce() {
    if (filled) return;
    filled = true;
    const days = [...new Set(orders.map((o) => o.deliveryAt).filter(Boolean))].sort();
    days.forEach((d) => document.getElementById('delivery')
        .insertAdjacentHTML('beforeend', `<option value="${esc(d)}">${day(d)}</option>`));
    const warehouses = [...new Set(orders.map((o) => o.warehouseCode))].sort();
    warehouses.forEach((w) => document.getElementById('warehouse')
        .insertAdjacentHTML('beforeend', `<option value="${esc(w)}">${esc(w)}</option>`));
}

/** 배송일만 화면에서 거른다. 나머지 조건은 서버가 걸러 준다. */
function visible() {
    const delivery = document.getElementById('delivery').value;
    return orders.filter((o) => !delivery || o.deliveryAt === delivery);
}

function draw() {
    const list = visible();
    document.getElementById('orderCount').textContent = `${list.length}건`;
    document.getElementById('orderList').innerHTML = table(
        ['배송예정', '주문번호', '창고', '주문상태', '준비상태'],
        rows(list, (o) => `
            <tr class="pick ${o.orderNumber === selected ? 'on' : ''} ${isBlocked(o.readinessStatus) ? 'blocked' : ''}"
                data-no="${esc(o.orderNumber)}">
                <td>${day(o.deliveryAt)}</td>
                <td>${esc(o.orderNumber)}</td>
                <td>${esc(o.warehouseCode)}${o.warehouseActive ? '' : ' <span class="tag">중지</span>'}</td>
                <td>${orderStatusTag(o.orderStatus, o.orderStatusLabel)}</td>
                <td>${readinessTag(o.readinessStatus, o.readinessStatusLabel)}</td>
            </tr>`, '조건에 맞는 주문이 없습니다.', 5));

    document.querySelectorAll('#orderList tr.pick').forEach((tr) =>
        tr.onclick = () => select(tr.dataset.no));
}

async function select(orderNumber) {
    selected = orderNumber;
    draw();
    history.replaceState(null, '', `/orders?order=${encodeURIComponent(orderNumber)}`);
    render(await api.get('/api/orders/' + encodeURIComponent(orderNumber)));
}

function render(d) {
    const r = d.readiness;
    const reserved = d.reservations.length > 0;
    const shipped = d.order.orderStatus === 'SHIPPED' || d.order.orderStatus === 'DELIVERED';
    const serialDemands = r.demands.filter((x) => x.serial);
    const picked = d.pickedUnits.length;
    const needPick = serialDemands.reduce((sum, x) => sum + x.requiredQuantity, 0);

    document.getElementById('detail').innerHTML = `
        <h2>${esc(d.order.orderNumber)}</h2>
        <div class="body">
            <dl class="kv">
                <dt>배송예정일</dt><dd>${dash(d.order.deliveryAt && d.order.deliveryAt.slice(0, 10))}</dd>
                <dt>출고창고</dt><dd>${esc(d.order.warehouseCode)} · ${esc(d.order.warehouseName)}
                    ${d.order.warehouseActive ? '' : '<span class="tag">사용 중지</span>'}</dd>
                <dt>주문상태</dt><dd>${orderStatusTag(d.order.orderStatus, d.order.orderStatusLabel)}</dd>
                <dt>준비상태</dt><dd>${readinessTag(r.status, r.statusLabel)}</dd>
                <dt>접수일시</dt><dd>${stamp(d.order.createdAt)}</dd>
            </dl>
        </div>

        ${r.reviewReasons.length ? `
            <div class="notice">
                <b>담당자 확인이 필요합니다.</b> 이 주문은 재고를 바꾸지 않고 발주 대상도 아닙니다.
                <ul>${r.reviewReasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            </div>` : ''}

        <section class="block">
            <h3>처리 단계</h3>
            <div class="actions">
                <span class="step">
                    <b class="${reserved ? 'done' : ''}">① 예약</b> →
                    <b class="${picked >= needPick && needPick > 0 ? 'done' : ''}">② 시리얼 피킹</b> →
                    <b class="${shipped ? 'done' : ''}">③ 출고</b>
                </span>
            </div>
            <div class="actions">
                <button class="primary" id="reserve" ${r.status !== 'READY' || reserved || shipped ? 'disabled' : ''}>
                    재고 예약</button>
                <button id="pick" ${!reserved || needPick === 0 || shipped ? 'disabled' : ''}>
                    시리얼 피킹</button>
                <button id="ship" ${!reserved || shipped ? 'disabled' : ''}>출고</button>
                ${r.status !== 'READY' && !reserved && !shipped
                    ? `<span class="step">현재고만으로 전량 준비되는 주문만 예약할 수 있습니다.</span>` : ''}
            </div>
        </section>

        <section class="block">
            <h3>주문한 품목</h3>
            ${table([{num: '순번'}, '구분', '코드', '품목명', {num: '수량'}, '상태'],
                rows(d.lines, (l) => `
                    <tr class="${l.status === 'CANCELED' ? 'dim' : ''}">
                        <td class="num">${l.sequence}</td>
                        <td>${l.kind === 'SET' ? '<span class="tag">세트</span>' : '단품'}</td>
                        <td>${l.kind === 'SET' ? esc(l.code) : linkItem(l.code)}</td>
                        <td>${esc(l.name)}</td>
                        <td class="num">${l.orderQuantity}</td>
                        <td>${l.status === 'CANCELED'
                            ? '<span class="tag bad">취소</span>' : '<span class="tag ok">정상</span>'}</td>
                    </tr>`, '주문 상세가 없습니다.', 6))}
        </section>

        <section class="block">
            <h3>준비해야 할 품목 — 세트를 전개하고 서비스 항목을 뺀 결과</h3>
            ${table(['품목', {num: '필요'}, {num: '가용'}, {num: '현재고'}, {num: '입고예정'}, {num: '부족'}, '기다리는 문서', ''],
                rows(r.demands, (x) => `
                    <tr class="${x.shortageQuantity > 0 ? 'blocked' : ''}">
                        <td>${linkItem(x.itemCode)} ${esc(x.itemName)}
                            ${x.serial ? '<span class="tag">시리얼</span>' : ''}</td>
                        <td class="num"><b>${x.requiredQuantity}</b></td>
                        <td class="num">${x.availableQuantity}</td>
                        <td class="num">${x.fromStock}</td>
                        <td class="num">${x.fromSchedule || '—'}</td>
                        <td class="num">${x.shortageQuantity
                            ? `<b style="color:#a02020">${x.shortageQuantity}</b>` : '—'}</td>
                        <td>${x.waitingScheduleCodes.map(linkSchedule).join(' ') || '—'}</td>
                        <td>${x.shortageQuantity > 0
                            ? `<button class="link order-btn" data-item="${esc(x.itemCode)}"
                                 data-qty="${x.shortageQuantity}">발주 생성</button>` : ''}</td>
                    </tr>`, '준비할 재고 수요가 없습니다.', 8))}
        </section>

        <section class="block">
            <h3>잡아둔 재고</h3>
            ${table(['품목', '창고', {num: '수량'}, '상태', '시각'],
                rows(d.reservations, (x) => `
                    <tr>
                        <td>${linkItem(x.itemCode)} ${esc(x.itemName)}</td>
                        <td>${esc(x.warehouseCode)}</td>
                        <td class="num">${x.quantity}</td>
                        <td><span class="tag ${x.status === 'RESERVED' ? 'wait' : 'ok'}">${esc(x.statusLabel)}</span></td>
                        <td>${stamp(x.createdAt)}</td>
                    </tr>`, '아직 예약하지 않았습니다.', 5))}
        </section>

        <section class="block">
            <h3>배정된 시리얼 개체</h3>
            ${table(['시리얼번호', '창고', '보관위치', '상태'],
                rows(d.pickedUnits, (u) => `
                    <tr>
                        <td>${esc(u.serialNumber)}</td>
                        <td>${esc(u.warehouseCode)}</td>
                        <td>${dash(u.location)}</td>
                        <td><span class="tag ${u.onHand ? 'wait' : ''}">${esc(u.statusLabel)}</span></td>
                    </tr>`, '배정된 개체가 없습니다.', 4))}
        </section>

        <section class="block">
            <h3>이 주문 때문에 생긴 발주 · 생산의뢰</h3>
            ${table(['문서번호', '구분', '품목', {num: '계획'}, {num: '입고'}, {num: '남은'}, '사용가능', '진행상태'],
                rows(d.schedules, (s) => `
                    <tr>
                        <td>${linkSchedule(s.code)}</td>
                        <td>${esc(s.typeLabel)}</td>
                        <td>${linkItem(s.itemCode)}</td>
                        <td class="num">${s.planQuantity}</td>
                        <td class="num">${s.receivedQuantity}</td>
                        <td class="num">${s.remainingQuantity}</td>
                        <td>${day(s.availableAt)}</td>
                        <td>${dash(s.statusLabel)}</td>
                    </tr>`, '이 주문에서 만든 발주가 없습니다.', 8))}
        </section>

        <section class="block">
            <h3>재고 이력</h3>
            ${ledgerTable(d.ledgers)}
        </section>`;

    bind(d.order.orderNumber);
}

function bind(orderNumber) {
    const act = (id, path, message) => {
        const button = document.getElementById(id);
        if (!button || button.disabled) return;
        button.onclick = async () => {
            const result = await run(button,
                () => api.post(`/api/orders/${encodeURIComponent(orderNumber)}/${path}`), message);
            if (result) { render(result); await load(); }
        };
    };
    act('reserve', 'reservation', '재고를 예약했습니다.');
    act('pick', 'picking', '시리얼 개체를 배정했습니다.');
    act('ship', 'shipment', '출고했습니다. 현재고와 예약수량이 함께 줄었습니다.');

    document.querySelectorAll('.order-btn').forEach((button) => {
        button.onclick = async () => {
            const itemCode = button.dataset.item;
            const quantity = Number(prompt(
                `${itemCode} 발주 수량을 입력하세요. 매입품은 구매발주, 생산품은 생산의뢰로 만들어집니다.`,
                button.dataset.qty));
            if (!quantity) return;
            const created = await run(button, () => api.post(
                `/api/orders/${encodeURIComponent(orderNumber)}/purchase-orders`,
                {itemCode, quantity, supplierCode: null},
                {'Idempotency-Key': `${orderNumber}:${itemCode}:${quantity}`}), '발주 문서를 만들었습니다.');
            if (created) location.href = `/schedules?code=${encodeURIComponent(created.code)}`;
        };
    });
}

['delivery', 'warehouse', 'readiness', 'status'].forEach((id) =>
    document.getElementById(id).addEventListener('change', () => {
        if (id === 'delivery') { draw(); } else { selected = null; load(false); }
    }));

load(false).catch((e) => flash(e.message, true));
