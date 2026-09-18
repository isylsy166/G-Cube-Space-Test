// 발주 페이지 — 제공된 문서와 앱에서 만든 문서를 한 목록에서 본다. (요구사항 4-3)

let schedules = [];
let selected = null;

async function load(keepSelection = true) {
    const query = new URLSearchParams();
    ['type', 'warehouseCode', 'confirmed', 'itemCode'].forEach((id) => {
        const value = document.getElementById(id).value.trim();
        if (value) query.set(id, value);
    });

    schedules = await api.get('/api/stock-schedules' + (query.toString() ? '?' + query : ''));
    fillOnce();
    draw();

    const wanted = (keepSelection && selected) || param('code')
        || (schedules[0] && schedules[0].code);
    if (wanted) select(wanted);
}

let filled = false;
function fillOnce() {
    if (filled) return;
    filled = true;
    [...new Set(schedules.map((s) => s.warehouseCode))].sort().forEach((w) =>
        document.getElementById('warehouseCode')
            .insertAdjacentHTML('beforeend', `<option value="${esc(w)}">${esc(w)}</option>`));
}

function draw() {
    document.getElementById('scheduleCount').textContent = `${schedules.length}건`;
    document.getElementById('scheduleList').innerHTML = table(
        ['문서번호', '구분', '품목', '창고', {num: '계획'}, {num: '입고'}, {num: '남은'}, '사용가능', '진행상태', '확정'],
        rows(schedules, (s) => `
            <tr class="pick ${s.code === selected ? 'on' : ''} ${s.warehouseActive ? '' : 'dim'}"
                data-code="${esc(s.code)}">
                <td>${esc(s.code)}</td>
                <td>${esc(s.typeLabel)}</td>
                <td>${esc(s.itemCode)}</td>
                <td>${esc(s.warehouseCode)}</td>
                <td class="num">${s.planQuantity}</td>
                <td class="num">${s.receivedQuantity}</td>
                <td class="num"><b>${s.remainingQuantity}</b></td>
                <td>${day(s.availableAt)}</td>
                <td>${dash(s.statusLabel)}</td>
                <td>${s.confirmed
                    ? '<span class="tag ok">확정</span>' : '<span class="tag">미확정</span>'}</td>
            </tr>`, '조건에 맞는 문서가 없습니다.', 10));

    document.querySelectorAll('#scheduleList tr.pick').forEach((tr) =>
        tr.onclick = () => select(tr.dataset.code));
}

async function select(code) {
    selected = code;
    draw();
    history.replaceState(null, '', `/schedules?code=${encodeURIComponent(code)}`);
    render(await api.get('/api/stock-schedules/' + encodeURIComponent(code)));
}

function render(d) {
    const s = d.schedule;
    const production = s.type === 'PRODUCTION';
    const inspected = s.inspectStatus === 'INSPECTED';
    const canReceive = s.confirmed && s.remainingQuantity > 0 && (!production || inspected);

    let blockReason = '';
    if (s.remainingQuantity === 0) blockReason = '남은 수량이 없어 더 입고할 수 없습니다.';
    else if (!s.confirmed) blockReason = '확정되지 않은 문서는 입고할 수 없습니다.';
    else if (production && !inspected) blockReason = '생산의뢰는 품질검사를 통과해야 입고할 수 있습니다.';

    document.getElementById('detail').innerHTML = `
        <h2>${esc(s.code)}</h2>
        <div class="body">
            <dl class="kv">
                <dt>문서구분</dt><dd>${esc(s.typeLabel)}</dd>
                <dt>품목</dt><dd>${linkItem(s.itemCode)} · ${esc(s.itemName)}</dd>
                <dt>입고창고</dt><dd>${esc(s.warehouseCode)} · ${esc(s.warehouseName)}
                    ${s.warehouseActive ? '' : '<span class="tag">사용 중지</span>'}</dd>
                <dt>공급처</dt><dd>${esc(s.supplierName)} (${esc(s.supplierCode)}) · 리드타임 ${s.leadTimeDays}일</dd>
                <dt>수량</dt><dd>계획 ${s.planQuantity} · 입고 ${s.receivedQuantity} · <b>남은 ${s.remainingQuantity}</b></dd>
                <dt>사용가능예정일</dt><dd>${dash(s.availableAt && s.availableAt.slice(0, 10))}</dd>
                <dt>진행상태</dt><dd>${dash(s.statusLabel)}</dd>
                <dt>검사상태</dt><dd>${esc(s.inspectStatusLabel)}</dd>
                <dt>확정여부</dt><dd>${s.confirmed ? '확정' : '미확정'}</dd>
                <dt>만든 주문</dt><dd>${d.sourceOrderNumber
                    ? linkOrder(d.sourceOrderNumber)
                    : '<span style="font-weight:400;color:var(--muted)">기준시각에 이미 있던 문서</span>'}</dd>
                <dt>판정 반영</dt><dd>${s.usableForPlanning
                    ? '<span class="tag ok">준비 판단에 사용</span>'
                    : '<span class="tag">준비 판단에서 제외</span>'}</dd>
            </dl>
        </div>

        <section class="block">
            <h3>처리</h3>
            ${blockReason ? `<div class="notice">${esc(blockReason)}</div>` : ''}
            <div class="actions">
                <button id="confirm" ${s.confirmed ? 'disabled' : ''}>발주 확정</button>
                ${production ? `
                    <button id="pass" ${inspected ? 'disabled' : ''}>검사 통과</button>
                    <button id="fail" ${!s.confirmed ? 'disabled' : ''}>검사 불합격</button>` : ''}
            </div>
            <div class="actions">
                <input id="qty" type="number" min="1" max="${s.remainingQuantity || 1}"
                       value="${s.remainingQuantity || 1}" ${canReceive ? '' : 'disabled'}>
                <button class="primary" id="receive" ${canReceive ? '' : 'disabled'}>입고 처리</button>
                <span class="step">입고해야 현재고가 늘어납니다. 계획수량을 넘는 입고는 거부됩니다.</span>
            </div>
        </section>

        <section class="block">
            <h3>입고 이력 — 현재고가 어떻게 바뀌었는지</h3>
            ${ledgerTable(d.ledgers)}
        </section>`;

    bind(s);
}

function bind(s) {
    const code = encodeURIComponent(s.code);
    // run() 이 성공 토스트를 띄우므로 여기서는 목록만 다시 읽는다
    const reload = async (result) => { if (result) await load(); };

    const confirmButton = document.getElementById('confirm');
    if (confirmButton && !confirmButton.disabled) {
        confirmButton.onclick = async () => reload(await run(confirmButton,
            () => api.post(`/api/stock-schedules/${code}/confirmation`), '확정했습니다.'));
    }

    [['pass', true, '검사 통과로 기록했습니다.'], ['fail', false, '검사 불합격으로 기록했습니다.']]
        .forEach(([id, passed, message]) => {
            const button = document.getElementById(id);
            if (!button || button.disabled) return;
            button.onclick = async () => reload(await run(button,
                () => api.post(`/api/stock-schedules/${code}/inspection`, {passed}), message));
        });

    const receiveButton = document.getElementById('receive');
    if (receiveButton && !receiveButton.disabled) {
        receiveButton.onclick = async () => {
            const quantity = Number(document.getElementById('qty').value);
            if (!quantity) return;
            // 같은 입고를 두 번 눌러도 한 번만 반영되도록 요청마다 키를 만든다
            const key = `${s.code}:${s.receivedQuantity}:${quantity}`;
            await reload(await run(receiveButton,
                () => api.post(`/api/stock-schedules/${code}/receipt`, {quantity}, {'Idempotency-Key': key}),
                '입고했습니다. 현재고가 늘었습니다.'));
        };
    }
}

['type', 'warehouseCode', 'confirmed'].forEach((id) =>
    document.getElementById(id).addEventListener('change', () => { selected = null; load(false); }));
document.getElementById('itemCode').addEventListener('input', () => { selected = null; load(false); });

load(false).catch((e) => flash(e.message, true));
