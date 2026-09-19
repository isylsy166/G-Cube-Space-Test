// 제품 화면 — 품목 기준으로 재고 상태를 본다. (요구사항 4-1)

let all = [];
let picked = null;
let current = null;

async function load() {
    all = await api.get('/api/items');
    fillFilters();
    paint();

    const wanted = param('code') || current;
    if (wanted) open(wanted);
}

let filled = false;
function fillFilters() {
    if (filled) return;
    filled = true;
    const add = (id, values) => values.sort().forEach((v) =>
        document.getElementById(id).insertAdjacentHTML('beforeend',
            `<option value="${esc(v)}">${esc(v)}</option>`));
    add('category', [...new Set(all.map((i) => i.category))]);
    add('type', [...new Set(all.map((i) => i.typeLabel))]);
}

const val = (id) => document.getElementById(id).value;

const RULES = {
    EMPTY: (i) => i.availableQuantity <= 0,
    SERIAL: (i) => i.serial,
    LEGACY: (i) => i.inactiveWarehouseQuantity > 0
};

function visible() {
    const q = val('q').trim().toLowerCase();
    return all
        .filter((i) => !q || i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
        .filter((i) => !val('category') || i.category === val('category'))
        .filter((i) => !val('type') || i.typeLabel === val('type'))
        .filter((i) => !picked || RULES[picked](i));
}

function paint() {
    const count = (fn) => all.filter(fn).length;
    const box = document.getElementById('stats');
    box.innerHTML = stats([
        {key: '', n: all.length, label: '전체 품목', hint: '매입품 · 생산품 · 서비스'},
        {key: 'EMPTY', tone: 'bad', n: count(RULES.EMPTY),
            label: '가용재고 없음', hint: '지금 바로 쓸 수 없음'},
        {key: 'SERIAL', tone: 'wait', n: count(RULES.SERIAL),
            label: '시리얼 관리', hint: '개체 단위로 추적'},
        {key: 'LEGACY', tone: 'rev', n: count(RULES.LEGACY),
            label: '중지 창고 보유', hint: '준비 판단에서 제외'}
    ], null, picked ?? '');
    bindStats(box, (key) => { picked = (picked === key || key === '') ? null : key; paint(); });

    const list = visible();
    document.getElementById('count').textContent = `${list.length}건 / 전체 ${all.length}건`;
    document.getElementById('list').innerHTML = grid(
        ['품목', '분류 · 유형', '공급처', {n: '현재고'}, {n: '예약'}, {n: '가용'}, {n: '중지창고'}],
        body(list, (i) => `
            <tr class="row" data-code="${esc(i.code)}" aria-selected="${i.code === current}">
                <td>
                    <div class="cell-main">${esc(i.code)}${i.serial ? ' ' + chip('시리얼', 'wait') : ''}</div>
                    <div class="cell-sub">${esc(i.name)}</div>
                </td>
                <td>
                    <div>${esc(i.category)}</div>
                    <div class="cell-sub">${esc(i.typeLabel)}${i.spec ? ' · ' + esc(i.spec) : ''}</div>
                </td>
                <td class="cell-sub">${esc(i.supplierName)}</td>
                <td class="num">${i.quantity}</td>
                <td class="num">${i.bookedQuantity || '—'}</td>
                <td class="num cell-main ${i.availableQuantity <= 0 ? 'short' : ''}">${i.availableQuantity}</td>
                <td class="num cell-sub">${i.inactiveWarehouseQuantity || '—'}</td>
            </tr>`, '조건에 맞는 품목이 없습니다.', 7));

    document.querySelectorAll('#list tr.row').forEach((tr) =>
        tr.onclick = () => open(tr.dataset.code));
}

async function open(code) {
    current = code;
    history.replaceState(null, '', `/items?code=${encodeURIComponent(code)}`);
    paint();
    render(await api.get('/api/items/' + encodeURIComponent(code)));
}

function onDrawerClose() {
    current = null;
    history.replaceState(null, '', '/items');
}

function render(d) {
    const i = d.item;
    drawer.open(
        esc(i.code),
        `${esc(i.name)} · ${esc(i.category)} · ${esc(i.typeLabel)}${i.spec ? ' · ' + esc(i.spec) : ''}`,
        `
        <div class="block">
            <h3>창고별 재고 — 가용재고는 현재고에서 예약수량을 뺀 값</h3>
            ${grid(['창고', {n: '현재고'}, {n: '예약수량'}, {n: '가용재고'}],
                body(d.stocks, (s) => `
                    <tr class="${s.active ? '' : 'muted'}">
                        <td>
                            <div class="cell-main">${esc(s.warehouseCode)}</div>
                            <div class="cell-sub">${esc(s.warehouseName)}
                                ${s.active ? '' : ' · ' + chip('사용 중지')}</div>
                        </td>
                        <td class="num">${s.quantity}</td>
                        <td class="num">${s.bookedQuantity || '—'}</td>
                        <td class="num cell-main">${s.active ? s.availableQuantity : '판단 제외'}</td>
                    </tr>`, '재고 기록이 없습니다.', 4))}
        </div>

        <div class="block">
            <h3>이 품목을 기다리는 주문</h3>
            ${grid(['주문번호', '배송예정', '준비상태', {n: '필요'}, {n: '부족'}],
                body(d.waitingOrders, (w) => `
                    <tr>
                        <td>
                            <div class="cell-main">${toOrder(w.orderNumber)}</div>
                            <div class="cell-sub">${esc(w.warehouseCode)}</div>
                        </td>
                        <td class="mono">${day(w.deliveryAt)}</td>
                        <td>${state(w.readinessStatus, w.readinessStatusLabel)}</td>
                        <td class="num">${w.requiredQuantity}</td>
                        <td class="num">${w.shortageQuantity
                            ? `<span class="short">${w.shortageQuantity}</span>` : '—'}</td>
                    </tr>`, '이 품목을 기다리는 주문이 없습니다.', 5))}
        </div>

        ${i.serial ? sec('시리얼 개체', d.units.length, grid(
            ['시리얼번호', '창고 · 위치', '상태', '배정된 주문'],
            body(d.units, (u) => `
                <tr class="${u.onHand ? '' : 'muted'}">
                    <td class="cell-main">${esc(u.serialNumber)}</td>
                    <td>
                        <div>${esc(u.warehouseCode)}</div>
                        <div class="cell-sub">${dash(u.location)}</div>
                    </td>
                    <td>${chip(u.statusLabel,
                        u.status === 'NORMAL' ? 'ok' : u.status === 'RESERVED' ? 'wait' : '')}</td>
                    <td>${toOrder(u.assignedOrderNumber)}</td>
                </tr>`, '등록된 개체가 없습니다.', 4))) : ''}

        ${sec('걸려 있는 발주 · 생산 문서', d.schedules.length, grid(
            ['문서번호', '구분', '창고', {n: '계획'}, {n: '남은'}, '사용가능', '판정'],
            body(d.schedules, (s) => `
                <tr class="${s.usableForPlanning ? '' : 'muted'}">
                    <td class="cell-main">${toDoc(s.code)}</td>
                    <td>${esc(s.typeLabel)}</td>
                    <td>${esc(s.warehouseCode)}</td>
                    <td class="num">${s.planQuantity}</td>
                    <td class="num">${s.remainingQuantity}</td>
                    <td class="mono">${day(s.availableAt)}</td>
                    <td>${s.usableForPlanning ? chip('반영', 'ok') : chip('제외')}</td>
                </tr>`, '걸려 있는 문서가 없습니다.', 7)))}

        ${ledgerBlock(d.ledgers)}`);
}

mountDrawer();
document.getElementById('q').addEventListener('input', paint);
['category', 'type'].forEach((id) =>
    document.getElementById(id).addEventListener('change', paint));
load().catch((e) => toast(e.message, true));
