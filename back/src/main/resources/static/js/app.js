// 세 화면이 함께 쓰는 유틸과 공통 컴포넌트. 빌드 없이 브라우저에서 그대로 돈다.

const api = {
    get: (path) => send(fetch(path)),
    post: (path, body, headers = {}) => send(fetch(path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', ...headers},
        body: body === undefined ? undefined : JSON.stringify(body)
    }))
};

async function send(promise) {
    const response = await promise;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        // 서버가 담당자용 한글 사유를 내려 준다
        throw new Error(data?.message || '요청을 처리하지 못했습니다.');
    }
    return data;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
    (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const dash = (v) => (v === null || v === undefined || v === '') ? '<span style="color:var(--ink-3)">—</span>' : esc(v);

const day = (iso) => iso ? iso.slice(5, 10) : '—';
const date = (iso) => iso ? iso.slice(0, 10) : '—';
const stamp = (iso) => iso ? iso.slice(5, 10) + ' ' + iso.slice(11, 16) : '—';

/** 준비 판정 상태 → 색 계열. 막힌 주문이 눈에 띄어야 한다. */
const TONE = {
    READY: 'ok',
    WAIT_INSPECTION: 'wait', WAIT_PRODUCTION: 'wait', WAIT_PURCHASE: 'wait',
    SHORTAGE: 'bad',
    REVIEW_REQUIRED: 'rev'
};

const state = (status, label) =>
    `<span class="state ${TONE[status] || ''}">${esc(label ?? '—')}</span>`;

const chip = (label, tone = '') => `<span class="chip ${tone}">${esc(label)}</span>`;

const isBlocked = (status) => status === 'SHORTAGE' || status === 'REVIEW_REQUIRED';

/** 화면 사이를 오가는 링크. 세 화면의 연결(요구사항 4-4)을 만든다. */
const toItem = (code) => code ? `<a href="/items?code=${encodeURIComponent(code)}">${esc(code)}</a>` : '—';
const toOrder = (no) => no ? `<a href="/orders?order=${encodeURIComponent(no)}">${esc(no)}</a>` : '—';
const toDoc = (code) => code ? `<a href="/schedules?code=${encodeURIComponent(code)}">${esc(code)}</a>` : '—';

const param = (name) => new URLSearchParams(location.search).get(name);

/** 표 본문. 비어 있으면 안내 문구 한 줄로 대체한다. */
function body(list, render, emptyText, span) {
    if (!list || !list.length) return `<tr><td class="blank" colspan="${span}">${esc(emptyText)}</td></tr>`;
    return list.map(render).join('');
}

function grid(headers, rowsHtml) {
    const head = headers.map((h) => typeof h === 'string'
        ? `<th>${esc(h)}</th>` : `<th class="num">${esc(h.n)}</th>`).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

/** 접히는 상세 섹션. 정보가 많아도 처음엔 접혀 있어 답답하지 않다. */
const sec = (title, count, html, open = false) => `
    <details class="sec" ${open ? 'open' : ''}>
        <summary>${esc(title)}${count !== null ? `<span class="n">${count}</span>` : ''}</summary>
        ${html}
    </details>`;

/* ---------- 상태 요약 카드 ---------- */

function stats(items, onPick, active) {
    return items.map((s) => `
        <button class="stat ${s.tone || ''}" data-key="${esc(s.key ?? '')}"
                aria-pressed="${active === s.key}">
            <span class="n">${s.n}</span>
            <span class="t">${esc(s.label)}</span>
            <span class="s">${esc(s.hint || '')}</span>
        </button>`).join('');
}

function bindStats(container, onPick) {
    container.querySelectorAll('.stat').forEach((b) =>
        b.onclick = () => onPick(b.dataset.key));
}

/* ---------- 드로어 ---------- */

const drawer = {
    open(title, subtitle, html) {
        document.getElementById('scrim').classList.add('open');
        const node = document.getElementById('drawer');
        node.classList.add('open');
        node.querySelector('h2').innerHTML = title;
        node.querySelector('.sub').innerHTML = subtitle;
        node.querySelector('.drawer-body').innerHTML = html;
        node.querySelector('.drawer-body').scrollTop = 0;
    },
    close() {
        document.getElementById('scrim').classList.remove('open');
        document.getElementById('drawer').classList.remove('open');
        document.querySelectorAll('tr.row[aria-selected="true"]')
            .forEach((tr) => tr.setAttribute('aria-selected', 'false'));
        if (typeof onDrawerClose === 'function') onDrawerClose();
    },
    isOpen: () => document.getElementById('drawer').classList.contains('open')
};

function mountDrawer() {
    document.body.insertAdjacentHTML('beforeend', `
        <div class="scrim" id="scrim"></div>
        <aside class="drawer" id="drawer" aria-label="상세">
            <div class="drawer-head">
                <div><h2></h2><div class="sub"></div></div>
                <button class="x" aria-label="닫기">&times;</button>
            </div>
            <div class="drawer-body"></div>
        </aside>`);
    document.getElementById('scrim').onclick = () => drawer.close();
    document.querySelector('#drawer .x').onclick = () => drawer.close();
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.isOpen()) drawer.close();
    });
}

/* ---------- 알림 / 액션 ---------- */

function toast(message, bad = false) {
    document.querySelectorAll('.toast').forEach((n) => n.remove());
    const node = document.createElement('div');
    node.className = 'toast' + (bad ? ' bad' : '');
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 4000);
}

/** 액션 버튼 공통 처리. 실패하면 서버가 준 사유를 그대로 보여 준다. */
async function act(button, work, okMessage) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = '처리 중…';
    try {
        const result = await work();
        toast(okMessage);
        return result;
    } catch (e) {
        toast(e.message, true);
        return null;
    } finally {
        button.disabled = false;
        button.textContent = label;
    }
}

/* ---------- 재고 이력 (세 화면 공용) ---------- */

const signed = (n) => n > 0 ? '+' + n : String(n);

const ledgerBlock = (ledgers) => sec('재고 이력', ledgers.length, grid(
    ['시각', '유형', '품목', '창고', {n: '현재고'}, {n: '예약'}, '관련'],
    body(ledgers, (l) => `
        <tr>
            <td class="cell-sub">${stamp(l.createdAt)}</td>
            <td>${chip(l.typeLabel, l.type === 'RECEIVE' ? 'ok' : l.type === 'SHIP' ? 'bad' : 'wait')}</td>
            <td>${toItem(l.itemCode)}</td>
            <td class="cell-sub">${dash(l.warehouseCode)}</td>
            <td class="num">${signed(l.quantityDelta)} <span class="cell-sub">→ ${l.quantityAfter}</span></td>
            <td class="num">${signed(l.bookedDelta)} <span class="cell-sub">→ ${l.bookedAfter}</span></td>
            <td class="cell-sub">${l.scheduleCode ? toDoc(l.scheduleCode) : toOrder(l.orderNumber)}</td>
        </tr>`, '아직 재고가 바뀐 기록이 없습니다.', 7)));
