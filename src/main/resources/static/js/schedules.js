// 발주 화면 — 제공된 문서와 앱에서 만든 문서를 한 목록에서 관리한다. (요구사항 4-3)

let all = [];
let picked = null;
let current = null;

const NOT_PASSED = ['BEFORE_INSPECTION', 'WAITING_INSPECTION', 'REJECTED'];

const RULES = {
    // 백엔드 StockSchedule.isReceivable() 과 같은 기준
    RECEIVABLE: (s) => s.confirmed && s.remainingQuantity > 0
        && (s.type !== 'PRODUCTION' || s.inspectStatus === 'INSPECTED'),
    INSPECT: (s) => NOT_PASSED.includes(s.inspectStatus),
    DRAFT: (s) => !s.confirmed
};

async function load() {
    all = await api.get('/api/stock-schedules');
    fillFilters();
    paint();

    const wanted = param('code') || current;
    if (wanted) open(wanted);
}

let filled = false;
function fillFilters() {
    if (filled) return;
    filled = true;
    [...new Set(all.map((s) => s.warehouseCode))].sort().forEach((w) =>
        document.getElementById('warehouse').insertAdjacentHTML('beforeend',
            `<option value="${esc(w)}">${esc(w)}</option>`));
}

const val = (id) => document.getElementById(id).value;

function visible() {
    const code = val('itemCode').trim().toLowerCase();
    return all
        .filter((s) => !val('type') || s.type === val('type'))
        .filter((s) => !val('warehouse') || s.warehouseCode === val('warehouse'))
        .filter((s) => !code || s.itemCode.toLowerCase().includes(code))
        .filter((s) => !picked || RULES[picked](s));
}

function paint() {
    const count = (fn) => all.filter(fn).length;
    const box = document.getElementById('stats');
    box.innerHTML = stats([
        {key: '', n: all.length, label: '전체 문서', hint: '구매발주 + 생산의뢰'},
        {key: 'RECEIVABLE', tone: 'ok', n: count(RULES.RECEIVABLE),
            label: '입고 가능', hint: '확정 · 검사 통과 · 잔량 있음'},
        {key: 'INSPECT', tone: 'wait', n: count(RULES.INSPECT),
            label: '검사 미통과', hint: '검사 전 · 대기 · 불합격'},
        {key: 'DRAFT', tone: 'rev', n: count(RULES.DRAFT),
            label: '미확정', hint: '준비 판단에서 제외'}
    ], null, picked ?? '');
    bindStats(box, (key) => { picked = (picked === key || key === '') ? null : key; paint(); });

    const list = visible();
    document.getElementById('count').textContent = `${list.length}건 / 전체 ${all.length}건`;
    document.getElementById('list').innerHTML = grid(
        ['문서번호', '구분', '품목', '입고창고', '공급처', {n: '계획'}, {n: '입고'}, {n: '남은'}, '사용가능', '진행상태'],
        body(list, (s) => `
            <tr class="row ${s.warehouseActive ? '' : 'muted'}"
                data-code="${esc(s.code)}" aria-selected="${s.code === current}">
                <td>
                    <div class="cell-main">${esc(s.code)}</div>
                    <div class="cell-sub">${s.confirmed ? '확정' : '미확정'}</div>
                </td>
                <td>${chip(s.typeLabel, s.type === 'PRODUCTION' ? 'wait' : '')}</td>
                <td>
                    <div class="cell-main">${esc(s.itemCode)}</div>
                    <div class="cell-sub">${esc(s.itemName)}</div>
                </td>
                <td>${esc(s.warehouseCode)}</td>
                <td class="cell-sub">${esc(s.supplierName)}</td>
                <td class="num">${s.planQuantity}</td>
                <td class="num">${s.receivedQuantity || '—'}</td>
                <td class="num cell-main">${s.remainingQuantity}</td>
                <td class="mono">${day(s.availableAt)}</td>
                <td>
                    <div>${dash(s.statusLabel)}</div>
                    ${s.type === 'PRODUCTION'
                        ? `<div class="cell-sub">${esc(s.inspectStatusLabel)}</div>` : ''}
                </td>
            </tr>`, '조건에 맞는 문서가 없습니다.', 10));

    document.querySelectorAll('#list tr.row').forEach((tr) =>
        tr.onclick = () => open(tr.dataset.code));
}

async function open(code) {
    current = code;
    history.replaceState(null, '', `/schedules?code=${encodeURIComponent(code)}`);
    paint();
    render(await api.get('/api/stock-schedules/' + encodeURIComponent(code)));
}

function onDrawerClose() {
    current = null;
    history.replaceState(null, '', '/schedules');
}

function render(d) {
    const s = d.schedule;
    const production = s.type === 'PRODUCTION';
    const inspected = s.inspectStatus === 'INSPECTED';
    const rejected = s.inspectStatus === 'REJECTED';
    const canReceive = s.confirmed && s.remainingQuantity > 0 && (!production || inspected);

    let blocked = '';
    if (s.remainingQuantity === 0) blocked = '남은 수량이 없어 더 입고할 수 없습니다.';
    else if (!s.confirmed) blocked = '확정되지 않은 문서는 입고할 수 없습니다. 먼저 발주 확정을 누르세요.';
    else if (rejected) blocked = '품질검사에서 불합격한 문서입니다. 이 물량은 준비 판단에서도 빠집니다. '
        + '재검사를 통과해야 입고할 수 있습니다.';
    else if (production && !inspected) blocked = '생산의뢰는 품질검사를 통과해야 입고할 수 있습니다.';

    drawer.open(
        esc(s.code),
        `${esc(s.typeLabel)} · ${esc(s.itemCode)} · ${esc(s.warehouseCode)} 입고`,
        `
        <div class="block">
            <div class="acts" style="padding-bottom:8px">
                <dl class="kv" style="width:100%">
                    <dt>품목</dt><dd>${toItem(s.itemCode)} · ${esc(s.itemName)}</dd>
                    <dt>입고창고</dt><dd>${esc(s.warehouseCode)} · ${esc(s.warehouseName)}
                        ${s.warehouseActive ? '' : chip('사용 중지', 'bad')}</dd>
                    <dt>공급처</dt><dd>${esc(s.supplierName)} (${esc(s.supplierCode)})
                        · 리드타임 ${s.leadTimeDays}일</dd>
                    <dt>수량</dt><dd>계획 ${s.planQuantity} · 입고 ${s.receivedQuantity}
                        · 남은 <span class="${s.remainingQuantity ? '' : 'short'}">${s.remainingQuantity}</span></dd>
                    <dt>사용가능예정일</dt><dd>${date(s.availableAt)}</dd>
                    <dt>진행상태</dt><dd>${dash(s.statusLabel)}</dd>
                    <dt>검사상태</dt><dd>${esc(s.inspectStatusLabel)}</dd>
                    <dt>만든 주문</dt><dd>${d.sourceOrderNumber
                        ? toOrder(d.sourceOrderNumber)
                        : '<span class="hint">기준시각에 이미 있던 문서</span>'}</dd>
                    <dt>준비 판단</dt><dd>${s.usableForPlanning ? chip('반영', 'ok') : chip('제외')}</dd>
                </dl>
            </div>
        </div>

        <div class="block">
            <h3>처리</h3>
            ${blocked ? `<div class="acts" style="padding-bottom:0">
                <div class="note warn" style="width:100%">${esc(blocked)}</div></div>` : ''}
            <div class="acts">
                <button class="btn" id="confirm" ${s.confirmed ? 'disabled' : ''}>발주 확정</button>
                ${production ? `
                    <button class="btn" id="pass" ${inspected ? 'disabled' : ''}>
                        ${rejected ? '재검사 통과' : '검사 통과'}</button>
                    <button class="btn danger" id="fail"
                        ${!s.confirmed || rejected ? 'disabled' : ''}>검사 불합격</button>`
                    : '<span class="hint">구매발주는 품질검사 대상이 아닙니다.</span>'}
            </div>
            <div class="acts" style="border-top:1px solid var(--line-soft)">
                <input id="qty" type="number" min="1" max="${s.remainingQuantity || 1}"
                       value="${s.remainingQuantity || 1}" ${canReceive ? '' : 'disabled'} style="width:80px">
                <button class="btn main" id="receive" ${canReceive ? '' : 'disabled'}>입고 처리</button>
                <span class="hint">입고해야 현재고가 늘어납니다. 계획수량을 넘는 입고는 거부됩니다.</span>
            </div>
        </div>

        ${ledgerBlock(d.ledgers)}`);

    bind(s);
}

function bind(s) {
    const code = encodeURIComponent(s.code);
    const refresh = async (result) => { if (result) { await load(); } };

    const wire = (id, work, message) => {
        const button = document.getElementById(id);
        if (!button || button.disabled) return;
        button.onclick = async () => refresh(await act(button, work, message));
    };

    wire('confirm', () => api.post(`/api/stock-schedules/${code}/confirmation`), '발주를 확정했습니다.');
    wire('pass', () => api.post(`/api/stock-schedules/${code}/inspection`, {passed: true}),
        '검사 통과로 기록했습니다.');
    wire('fail', () => api.post(`/api/stock-schedules/${code}/inspection`, {passed: false}),
        '검사 불합격으로 기록했습니다.');

    const receive = document.getElementById('receive');
    if (receive && !receive.disabled) {
        receive.onclick = async () => {
            const quantity = Number(document.getElementById('qty').value);
            if (!quantity) return;
            // 같은 입고를 두 번 눌러도 한 번만 반영되도록 요청마다 키를 만든다
            const key = `${s.code}:${s.receivedQuantity}:${quantity}`;
            refresh(await act(receive,
                () => api.post(`/api/stock-schedules/${code}/receipt`, {quantity}, {'Idempotency-Key': key}),
                '입고했습니다. 현재고가 늘었습니다.'));
        };
    }
}

mountDrawer();
['type', 'warehouse'].forEach((id) =>
    document.getElementById(id).addEventListener('change', paint));
document.getElementById('itemCode').addEventListener('input', paint);
load().catch((e) => toast(e.message, true));
