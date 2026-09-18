// 주문 화면 — 한 행이 주문 1건. 판정 결과와 처리 액션을 드로어에 담는다. (요구사항 4-2)

let all = [];
let picked = null;      // 요약 카드로 고른 준비상태
let current = null;     // 드로어에 열려 있는 주문번호

const WAITING = ['WAIT_INSPECTION', 'WAIT_PRODUCTION', 'WAIT_PURCHASE'];

async function load() {
    all = await api.get('/api/orders');
    fillFilters();
    paint();

    const wanted = param('order') || current;
    if (wanted) open(wanted);
}

let filled = false;
function fillFilters() {
    if (filled) return;
    filled = true;
    const add = (id, values, label = (v) => v) => values.forEach((v) =>
        document.getElementById(id).insertAdjacentHTML('beforeend',
            `<option value="${esc(v)}">${esc(label(v))}</option>`));
    add('delivery', [...new Set(all.map((o) => o.deliveryAt).filter(Boolean))].sort(), day);
    add('warehouse', [...new Set(all.map((o) => o.warehouseCode))].sort());
}

const val = (id) => document.getElementById(id).value;

function visible() {
    return all
        .filter((o) => !val('delivery') || o.deliveryAt === val('delivery'))
        .filter((o) => !val('warehouse') || o.warehouseCode === val('warehouse'))
        .filter((o) => !val('orderStatus') || o.orderStatus === val('orderStatus'))
        .filter((o) => !picked
            || (picked === 'WAIT' ? WAITING.includes(o.readinessStatus) : o.readinessStatus === picked));
}

function paint() {
    const count = (fn) => all.filter(fn).length;
    const box = document.getElementById('stats');
    box.innerHTML = stats([
        {key: 'READY', tone: 'ok', n: count((o) => o.readinessStatus === 'READY'),
            label: '바로 준비 가능', hint: '현재고만으로 전량 준비'},
        {key: 'WAIT', tone: 'wait', n: count((o) => WAITING.includes(o.readinessStatus)),
            label: '입고 대기', hint: '검사 · 생산 · 구매를 기다림'},
        {key: 'SHORTAGE', tone: 'bad', n: count((o) => o.readinessStatus === 'SHORTAGE'),
            label: '재고 부족', hint: '발주가 필요한 주문'},
        {key: 'REVIEW_REQUIRED', tone: 'rev', n: count((o) => o.readinessStatus === 'REVIEW_REQUIRED'),
            label: '확인 필요', hint: '담당자가 직접 봐야 함'}
    ], null, picked);
    bindStats(box, (key) => { picked = (picked === key) ? null : key; paint(); });

    const list = visible();
    document.getElementById('count').textContent = `${list.length}건 / 전체 ${all.length}건`;
    document.getElementById('list').innerHTML = grid(
        ['배송예정', '주문번호', '출고창고', '주문상태', '준비상태'],
        body(list, (o) => `
            <tr class="row ${o.preparationTarget ? '' : 'muted'}"
                data-no="${esc(o.orderNumber)}"
                aria-selected="${o.orderNumber === current}">
                <td class="mono cell-main">${day(o.deliveryAt)}</td>
                <td>
                    <div class="cell-main">${esc(o.orderNumber)}</div>
                    <div class="cell-sub">접수 ${stamp(o.createdAt)}</div>
                </td>
                <td>
                    <div>${esc(o.warehouseCode)}</div>
                    <div class="cell-sub">${o.warehouseActive ? esc(o.warehouseName) : '사용 중지'}</div>
                </td>
                <td>${chip(o.orderStatusLabel, o.orderStatus === 'CANCELED' ? 'bad' : '')}</td>
                <td>${state(o.readinessStatus, o.readinessStatusLabel)}</td>
            </tr>`, '조건에 맞는 주문이 없습니다.', 5));

    document.querySelectorAll('#list tr.row').forEach((tr) =>
        tr.onclick = () => open(tr.dataset.no));
}

async function open(orderNumber) {
    current = orderNumber;
    history.replaceState(null, '', `/orders?order=${encodeURIComponent(orderNumber)}`);
    paint();
    render(await api.get('/api/orders/' + encodeURIComponent(orderNumber)));
}

function onDrawerClose() {
    current = null;
    history.replaceState(null, '', '/orders');
}

function render(d) {
    const r = d.readiness;
    const reserved = d.reservations.length > 0;
    const shipped = d.order.orderStatus === 'SHIPPED' || d.order.orderStatus === 'DELIVERED';
    const needPick = r.demands.filter((x) => x.serial).reduce((n, x) => n + x.requiredQuantity, 0);
    const doneP = needPick > 0 && d.pickedUnits.length >= needPick;

    drawer.open(
        esc(d.order.orderNumber),
        `${date(d.order.deliveryAt)} 배송 예정 · ${esc(d.order.warehouseCode)} · ${state(r.status, r.statusLabel)}`,
        `
        ${r.reviewReasons.length ? `
            <div class="note">
                <b>담당자 확인이 필요합니다</b>
                이 주문은 재고를 바꾸지 않고, 발주 대상도 아닙니다.
                <ul>${r.reviewReasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            </div>` : ''}

        <div class="block">
            <div class="steps">
                <span class="s ${reserved ? 'done' : ''}"><i>1</i>예약</span><span class="bar"></span>
                <span class="s ${doneP ? 'done' : ''}"><i>2</i>시리얼 피킹</span><span class="bar"></span>
                <span class="s ${shipped ? 'done' : ''}"><i>3</i>출고</span>
            </div>
            <div class="acts">
                <button class="btn main" id="reserve"
                    ${r.status !== 'READY' || reserved || shipped ? 'disabled' : ''}>재고 예약</button>
                <button class="btn" id="pick"
                    ${!reserved || needPick === 0 || shipped ? 'disabled' : ''}>시리얼 피킹</button>
                <button class="btn" id="ship" ${!reserved || shipped ? 'disabled' : ''}>출고</button>
            </div>
            ${!reserved && !shipped && r.status !== 'READY' ? `
                <div class="acts" style="padding-top:0">
                    <span class="hint">현재고만으로 전량 준비되는 주문만 예약할 수 있습니다.</span>
                </div>` : ''}
        </div>

        <div class="block">
            <h3>준비해야 할 품목 — 세트를 전개하고 서비스를 뺀 결과</h3>
            ${grid(['품목', {n: '필요'}, {n: '가용'}, {n: '현재고'}, {n: '입고예정'}, {n: '부족'}, ''],
                body(r.demands, (x) => `
                    <tr>
                        <td>
                            <div class="cell-main">${toItem(x.itemCode)}</div>
                            <div class="cell-sub">${esc(x.itemName)}${x.serial ? ' · 시리얼' : ''}</div>
                        </td>
                        <td class="num cell-main">${x.requiredQuantity}</td>
                        <td class="num">${x.availableQuantity}</td>
                        <td class="num">${x.fromStock}</td>
                        <td class="num">${x.fromSchedule
                            ? `${x.fromSchedule}<div class="cell-sub">${x.waitingScheduleCodes.map(toDoc).join(' ')}</div>`
                            : '—'}</td>
                        <td class="num">${x.shortageQuantity
                            ? `<span class="short">${x.shortageQuantity}</span>` : '—'}</td>
                        <td>${x.shortageQuantity > 0
                            ? `<button class="mini buy" data-item="${esc(x.itemCode)}"
                                 data-qty="${x.shortageQuantity}">발주</button>` : ''}</td>
                    </tr>`, '준비할 재고 수요가 없습니다.', 7))}
        </div>

        ${sec('주문한 품목', d.lines.length, grid(
            [{n: '순번'}, '구분', '품목', {n: '수량'}, '상태'],
            body(d.lines, (l) => `
                <tr class="${l.status === 'CANCELED' ? 'muted' : ''}">
                    <td class="num">${l.sequence}</td>
                    <td>${chip(l.kind === 'SET' ? '세트' : '단품')}</td>
                    <td>
                        <div class="cell-main">${l.kind === 'SET' ? esc(l.code) : toItem(l.code)}</div>
                        <div class="cell-sub">${esc(l.name)}</div>
                    </td>
                    <td class="num">${l.orderQuantity}</td>
                    <td>${l.status === 'CANCELED' ? chip('취소', 'bad') : chip('정상', 'ok')}</td>
                </tr>`, '주문 상세가 없습니다.', 5)))}

        ${sec('잡아둔 재고', d.reservations.length, grid(
            ['품목', '창고', {n: '수량'}, '상태'],
            body(d.reservations, (x) => `
                <tr>
                    <td>${toItem(x.itemCode)}</td>
                    <td>${esc(x.warehouseCode)}</td>
                    <td class="num cell-main">${x.quantity}</td>
                    <td>${chip(x.statusLabel, x.status === 'RESERVED' ? 'wait' : 'ok')}</td>
                </tr>`, '아직 예약하지 않았습니다.', 4)))}

        ${sec('배정된 시리얼 개체', d.pickedUnits.length, grid(
            ['시리얼번호', '창고', '보관위치', '상태'],
            body(d.pickedUnits, (u) => `
                <tr>
                    <td class="cell-main">${esc(u.serialNumber)}</td>
                    <td>${esc(u.warehouseCode)}</td>
                    <td>${dash(u.location)}</td>
                    <td>${chip(u.statusLabel, u.onHand ? 'wait' : '')}</td>
                </tr>`, '배정된 개체가 없습니다.', 4)))}

        ${sec('이 주문에서 만든 발주', d.schedules.length, grid(
            ['문서번호', '구분', '품목', {n: '계획'}, {n: '남은'}, '진행상태'],
            body(d.schedules, (s) => `
                <tr>
                    <td class="cell-main">${toDoc(s.code)}</td>
                    <td>${esc(s.typeLabel)}</td>
                    <td>${toItem(s.itemCode)}</td>
                    <td class="num">${s.planQuantity}</td>
                    <td class="num">${s.remainingQuantity}</td>
                    <td>${dash(s.statusLabel)}</td>
                </tr>`, '이 주문에서 만든 발주가 없습니다.', 6)))}

        ${ledgerBlock(d.ledgers)}`);

    bind(d.order.orderNumber);
}

function bind(orderNumber) {
    const wire = (id, path, message) => {
        const button = document.getElementById(id);
        if (!button || button.disabled) return;
        button.onclick = async () => {
            const result = await act(button,
                () => api.post(`/api/orders/${encodeURIComponent(orderNumber)}/${path}`), message);
            if (result) { render(result); await load(); }
        };
    };
    wire('reserve', 'reservation', '재고를 예약했습니다.');
    wire('pick', 'picking', '시리얼 개체를 배정했습니다.');
    wire('ship', 'shipment', '출고했습니다. 현재고와 예약수량이 함께 줄었습니다.');

    document.querySelectorAll('.buy').forEach((button) => {
        button.onclick = async () => {
            const itemCode = button.dataset.item;
            const quantity = Number(prompt(
                `${itemCode} 발주 수량을 입력하세요.\n매입품은 구매발주, 생산품은 생산의뢰로 만들어집니다.`,
                button.dataset.qty));
            if (!quantity) return;
            const made = await act(button, () => api.post(
                `/api/orders/${encodeURIComponent(orderNumber)}/purchase-orders`,
                {itemCode, quantity, supplierCode: null},
                {'Idempotency-Key': `${orderNumber}:${itemCode}:${quantity}`}),
                '발주 문서를 만들었습니다.');
            if (made) location.href = `/schedules?code=${encodeURIComponent(made.code)}`;
        };
    });
}

mountDrawer();
['delivery', 'warehouse', 'orderStatus'].forEach((id) =>
    document.getElementById(id).addEventListener('change', paint));
load().catch((e) => toast(e.message, true));
