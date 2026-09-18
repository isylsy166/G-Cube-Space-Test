// 세 화면이 함께 쓰는 유틸. 별도 빌드 없이 그대로 브라우저에서 돈다.

const api = {
    async get(path) {
        return handle(await fetch(path));
    },
    async post(path, body, headers = {}) {
        return handle(await fetch(path, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', ...headers},
            body: body === undefined ? undefined : JSON.stringify(body)
        }));
    }
};

async function handle(response) {
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        // 서버가 담당자용 한글 사유를 내려 준다
        throw new Error(data && data.message ? data.message : '요청을 처리하지 못했습니다.');
    }
    return data;
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g,
    (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const dash = (value) => (value === null || value === undefined || value === '') ? '—' : esc(value);

/** 2026-07-22T00:00 → 07-22 */
const day = (iso) => iso ? iso.slice(5, 10) : '—';

/** 2026-07-21T08:30:00 → 07-21 08:30 */
const stamp = (iso) => iso ? iso.slice(5, 10) + ' ' + iso.slice(11, 16) : '—';

/** 준비 판정 상태를 색으로 구분한다. 막힌 주문이 눈에 띄어야 한다. */
function readinessTag(status, label) {
    if (!status) return '<span class="tag">—</span>';
    const tone = {
        READY: 'ok',
        WAIT_INSPECTION: 'wait', WAIT_PRODUCTION: 'wait', WAIT_PURCHASE: 'wait',
        SHORTAGE: 'bad',
        REVIEW_REQUIRED: 'review'
    }[status] || '';
    return `<span class="tag ${tone}">${esc(label)}</span>`;
}

function orderStatusTag(status, label) {
    const tone = {CONFIRMED: 'ok', SHIPPED: 'wait', DELIVERED: '', CANCELED: 'bad'}[status] || '';
    return `<span class="tag ${tone}">${esc(label)}</span>`;
}

const isBlocked = (status) => status === 'SHORTAGE' || status === 'REVIEW_REQUIRED';

function flash(message, bad = false) {
    document.querySelectorAll('.flash').forEach((n) => n.remove());
    const node = document.createElement('div');
    node.className = 'flash' + (bad ? ' bad' : '');
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 4200);
}

/** 액션 버튼 공통 처리. 실패하면 서버가 준 사유를 그대로 보여 준다. */
async function run(button, work, okMessage) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = '처리 중…';
    try {
        const result = await work();
        flash(okMessage);
        return result;
    } catch (e) {
        flash(e.message, true);
        return null;
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

function rows(list, render, emptyText, columns) {
    if (!list || list.length === 0) {
        return `<tr><td class="empty" colspan="${columns}">${esc(emptyText)}</td></tr>`;
    }
    return list.map(render).join('');
}

function table(headers, bodyHtml) {
    const head = headers.map((h) =>
        typeof h === 'string' ? `<th>${esc(h)}</th>` : `<th class="num">${esc(h.num)}</th>`).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

/** 다른 화면으로 넘어가는 링크. 세 화면의 연결(요구사항 4-4)을 만든다. */
const linkItem = (code) => code ? `<a href="/items?code=${encodeURIComponent(code)}">${esc(code)}</a>` : '—';
const linkOrder = (no) => no ? `<a href="/orders?order=${encodeURIComponent(no)}">${esc(no)}</a>` : '—';
const linkSchedule = (code) => code ? `<a href="/schedules?code=${encodeURIComponent(code)}">${esc(code)}</a>` : '—';

const param = (name) => new URLSearchParams(location.search).get(name);

/** 재고 이력 표. 세 화면이 같은 모양으로 쓴다. */
function ledgerTable(ledgers) {
    return table(['시각', '유형', '품목', '창고', {num: '현재고'}, {num: '예약'}, '관련', '설명'],
        rows(ledgers, (l) => `
            <tr>
                <td>${stamp(l.createdAt)}</td>
                <td><span class="tag">${esc(l.typeLabel)}</span></td>
                <td>${linkItem(l.itemCode)}</td>
                <td>${dash(l.warehouseCode)}</td>
                <td class="num">${signed(l.quantityDelta)} → ${l.quantityAfter}</td>
                <td class="num">${signed(l.bookedDelta)} → ${l.bookedAfter}</td>
                <td>${l.scheduleCode ? linkSchedule(l.scheduleCode) : linkOrder(l.orderNumber)}</td>
                <td>${dash(l.memo)}</td>
            </tr>`, '아직 재고가 바뀐 기록이 없습니다.', 8));
}

const signed = (n) => (n > 0 ? '+' + n : String(n));
