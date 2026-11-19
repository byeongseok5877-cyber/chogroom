/* 첫그루밍 공용 스크립트: 상태 저장 · 이벤트 추적 · 장바구니 · 페이지별 동작 */
(function () {
  'use strict';
  var C = window.FG_CONFIG || {};

  /* ---------- 데이터 (가상) ---------- */
  var KIT_PRICE = 14900;
  var TYPES = { oily: '지성용', dry: '건성용' };
  var STEPS = [
    { key: 'cleanser', step: 'STEP 1', label: '클렌저', time: '1분',
      act: '물에 적신 얼굴에 거품을 내 씻어냅니다.',
      name: { oily: '젤 클렌저', dry: '크림·밀크 클렌저' } },
    { key: 'lotion', step: 'STEP 2', label: '로션', time: '1분',
      act: '물기를 닦고 얼굴 전체에 얇게 바릅니다.',
      name: { oily: '가벼운 젤 로션', dry: '보습 로션' } },
    { key: 'sunscreen-bb', step: 'STEP 3', label: '선크림 BB', time: '1분',
      act: '외출 전 마지막 단계로 펴 바릅니다.',
      name: { oily: '산뜻한 BB 선크림', dry: '촉촉한 BB 선크림' } }
  ];
  var REFILLS = [
    { sku: 'refill-cleanser', name: '클렌저 본품', spec: '100ml', price: 19000 },
    { sku: 'refill-lotion', name: '로션 본품', spec: '100ml', price: 22000 },
    { sku: 'refill-bb', name: '선크림 BB 본품', spec: '50ml', price: 20000 },
    { sku: 'refill-bundle', name: '3종 묶음', spec: '클렌저 + 로션 + 선크림 BB', price: 54900, was: 61000 }
  ];

  /* ---------- 저장소 ---------- */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ssGet(k, d) { try { var v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var won = function (n) { return n.toLocaleString('ko-KR') + '원'; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- URL 파라미터: variant, UTM ---------- */
  var qs = new URLSearchParams(location.search);
  if (qs.get('variant')) ssSet('fg_variant', qs.get('variant'));
  var VARIANT = ssGet('fg_variant', 'base');
  if (qs.get('debug') === '1') ssSet('fg_debug', true);

  var utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
    if (qs.get(k)) utm[k] = qs.get(k);
  });
  if (Object.keys(utm).length) lsSet('fg_utm', utm); // 새 UTM이 오면 덮어쓰기

  /* 내부 링크에 variant 유지 */
  if (VARIANT !== 'base') {
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (/^[a-z-]+\.html/.test(h) && h.indexOf('variant=') < 0) {
        a.setAttribute('href', h + (h.indexOf('?') < 0 ? '?' : '&') + 'variant=' + VARIANT);
      }
    });
  }

  /* ---------- GA4 / 이벤트 ---------- */
  var gaReady = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  if (C.GA_ID && C.GA_ID.indexOf('XXXX') < 0) {
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + C.GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', C.GA_ID, { send_page_view: false });
    gaReady = true;
  }

  var log = ssGet('fg_log', []);
  function track(name, params) {
    params = Object.assign({ variant: VARIANT }, params || {});
    if (C.DEBUG_EVENTS) console.log('[FG event]', name, params);
    log.push({ t: new Date().toTimeString().slice(0, 8), n: name, p: params });
    log = log.slice(-40); ssSet('fg_log', log);
    if (gaReady) gtag('event', name, params);
    renderDebug();
  }

  function renderDebug() {
    if (!ssGet('fg_debug', false)) return;
    var box = $('#fg-debug');
    if (!box) {
      box = document.createElement('aside');
      box.id = 'fg-debug';
      box.setAttribute('aria-label', '이벤트 로그');
      document.body.appendChild(box);
    }
    box.innerHTML = '<div class="dbg-head"><b>이벤트 로그</b><span>' +
      (gaReady ? 'GA4 전송 중' : 'GA4 미연결(로그만)') + '</span>' +
      '<button type="button" id="dbg-clear">지우기</button></div>' +
      '<ol>' + log.slice().reverse().map(function (e) {
        var p = Object.keys(e.p).filter(function (k) { return k !== 'variant'; })
          .map(function (k) { return k + '=' + e.p[k]; }).join(' ');
        return '<li><i>' + e.t + '</i> <b>' + e.n + '</b> <span>' + p + ' variant=' + e.p.variant + '</span></li>';
      }).join('') + '</ol>';
    $('#dbg-clear').onclick = function () { log = []; ssSet('fg_log', []); renderDebug(); };
  }

  /* ---------- 상태: 피부 타입, 장바구니 ---------- */
  function getType() { var t = lsGet('fg_type', null); return TYPES[t] ? t : null; }
  function setType(t, source) {
    lsSet('fg_type', t);
    applyType(t);
    track('select_skin_type', { skin_type: t, source: source || 'unknown' });
  }
  function getCart() { return lsGet('fg_cart', []); }
  function saveCart(c) { lsSet('fg_cart', c); updateBadge(); }
  function addItem(it) {
    var c = getCart();
    if (it.sku === 'kit') c = c.filter(function (x) { return x.sku !== 'kit'; }); // 키트는 1개만
    else c = c.filter(function (x) { return !(x.sku === it.sku && x.type === it.type); });
    c.push(it); saveCart(c);
  }
  function cartTotal(c) {
    var sub = c.reduce(function (a, x) { return a + x.price * x.qty; }, 0);
    var hasKit = c.some(function (x) { return x.sku === 'kit'; });
    var ship = (!c.length || hasKit || sub >= 30000) ? 0 : 3000; // 가상 배송비 규칙
    return { sub: sub, ship: ship, total: sub + ship };
  }
  function updateBadge() {
    var n = getCart().length;
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = n; el.hidden = n === 0;
    });
  }
  function primaryType(c) {
    var k = c.filter(function (x) { return x.sku === 'kit'; })[0] || c[0];
    return k ? k.type : getType();
  }

  /* ---------- 타입 적용(이미지·이름·버튼) ---------- */
  function applyType(t) {
    $$('[data-seg] button').forEach(function (b) {
      // 히어로 미리보기는 선택 전에도 지성용을 보여 줌(저장은 하지 않음)
      var shown = (b.parentNode.dataset.seg === 'hero') ? (t || 'oily') : t;
      b.setAttribute('aria-pressed', String(b.dataset.type === shown));
    });
    $$('img[data-prod]').forEach(function (img) {
      var tt = t || 'oily';
      var next = 'assets/' + img.dataset.prod + '-' + tt + '.svg';
      if (img.getAttribute('src') !== next) img.setAttribute('src', next);
    });
    $$('img[data-kit]').forEach(function (img) {
      img.setAttribute('src', 'assets/kit-' + (t || 'oily') + '.svg');
    });
    $$('[data-pname]').forEach(function (el) {
      var st = STEPS.filter(function (s) { return s.key === el.dataset.pname; })[0];
      el.textContent = t ? st.name[t] : st.label;
    });
    $$('[data-type-label]').forEach(function (el) {
      el.textContent = t ? TYPES[t] : '타입 선택 전';
    });
    document.body.dataset.type = t || '';
  }

  /* ---------- 공통: CTA 클릭 추적 ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cta]');
    if (el) track('click_cta', { cta_name: el.dataset.cta });
    var seg = e.target.closest('[data-seg] button');
    if (seg && seg.dataset.type) setType(seg.dataset.type, seg.closest('[data-seg]').dataset.seg);
  });

  /* ---------- 페이지별 ---------- */
  var page = document.body.dataset.page;
  var inits = {};

  inits.index = function () {
    // 진단 퀴즈
    var ans = {};
    var res = $('#quiz-result');
    function showResult() {
      if (ans.q1 === undefined || ans.q2 === undefined) return;
      var t = (ans.q1 && !ans.q2) ? 'oily' : (!ans.q1 && ans.q2) ? 'dry' : null;
      if (t) {
        res.innerHTML = '<p class="res-title"><strong>' + TYPES[t] + '</strong>부터 시작해 보세요.</p>' +
          '<p>' + (t === 'oily'
            ? '오후에 번들거리고 세안 후엔 당기지 않는 편이라, 가볍게 마무리되는 구성이 어울립니다.'
            : '세안 후 당김이 있고 번들거림은 덜한 편이라, 보습이 든든한 구성이 어울립니다.') + '</p>' +
          '<a class="btn" href="product.html">' + TYPES[t] + ' 키트 보기</a>';
        setType(t, 'quiz');
      } else {
        res.innerHTML = '<p class="res-title">답이 엇갈려도 괜찮아요.</p>' +
          '<p>두 타입 중 마음 가는 쪽으로 시작하면 됩니다. 처음 쓸 땐 팔 안쪽에 소량 테스트해 보세요.</p>' +
          '<div class="seg" data-seg="quiz" role="group" aria-label="피부 타입 직접 고르기">' +
          '<button type="button" data-type="oily" aria-pressed="false">지성용</button>' +
          '<button type="button" data-type="dry" aria-pressed="false">건성용</button></div>';
      }
      res.hidden = false;
    }
    $$('#quiz [data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        ans[b.dataset.q] = b.dataset.a === 'y';
        $$('#quiz [data-q="' + b.dataset.q + '"]').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        showResult();
      });
    });
  };

  inits.product = function () {
    var chosen = getType();
    track('view_item', { item_name: '입문 키트', value: KIT_PRICE, currency: 'KRW' });
    if (VARIANT === 'top') {
      var tb = $('#type-box'), pb = $('#price-box');
      pb.parentNode.insertBefore(tb, pb.nextSibling);
    }
    var err = $('#type-error');
    $$('[data-seg="product"] button').forEach(function (b) {
      b.addEventListener('click', function () { err.hidden = true; });
    });
    $('#add-btn').addEventListener('click', function () {
      var t = getType();
      if (!t) {
        err.hidden = false;
        $('#type-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      addItem({ sku: 'kit', name: '입문 키트', type: t, price: KIT_PRICE, qty: 1 });
      track('add_to_cart', { item_name: '입문 키트', skin_type: t, value: KIT_PRICE, currency: 'KRW' });
      var btn = $('#add-btn'); btn.textContent = '담았어요'; btn.disabled = true;
      setTimeout(function () { location.href = 'cart.html' + (VARIANT !== 'base' ? '?variant=' + VARIANT : ''); }, 350);
    });
    $('#bar-type').textContent = chosen ? TYPES[chosen] : '타입을 골라 주세요';
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-seg="product"] button')) {
        $('#bar-type').textContent = TYPES[getType()];
      }
    });
  };

  inits.cart = function () {
    var c = getCart(), list = $('#cart-list');
    function render() {
      c = getCart();
      var empty = !c.length;
      $('#cart-full').hidden = empty; $('#cart-empty').hidden = !empty;
      list.innerHTML = '';
      c.forEach(function (it, i) {
        var li = document.createElement('li'); li.className = 'line';
        var img = it.sku === 'kit' ? 'assets/kit-' + it.type + '.svg' : null;
        li.innerHTML = (img ? '<img src="' + img + '" alt="" width="132" height="59">' : '<span class="ph" aria-hidden="true"></span>') +
          '<div class="line-body"><strong>' + it.name + '</strong>' +
          '<span>' + (it.sku === 'kit' ? '클렌저 · 로션 · 선크림 BB (각 30ml) · ' : '') + TYPES[it.type] + ' · 수량 ' + it.qty + '개</span>' +
          '<button type="button" class="link" data-rm="' + i + '">삭제</button></div>' +
          '<b>' + won(it.price * it.qty) + '</b>';
        list.appendChild(li);
      });
      var t = cartTotal(c);
      $('#sub').textContent = won(t.sub);
      $('#ship').textContent = t.ship ? won(t.ship) : '무료';
      $('#total').textContent = won(t.total);
    }
    list.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-rm]');
      if (!rm) return;
      var cc = getCart(); cc.splice(+rm.dataset.rm, 1); saveCart(cc); render();
    });
    render();
  };

  inits.checkout = function () {
    var c = getCart();
    if (!c.length) { location.replace('cart.html'); return; }
    var t = cartTotal(c);
    $('#sum-list').innerHTML = c.map(function (x) {
      return '<li><span>' + x.name + ' (' + TYPES[x.type] + ')</span><b>' + won(x.price * x.qty) + '</b></li>';
    }).join('');
    $('#c-ship').textContent = t.ship ? won(t.ship) : '무료';
    $('#c-total').textContent = won(t.total);
    $('#pay-btn').textContent = won(t.total) + ' 결제하기 (데모)';
    track('begin_checkout', { value: t.total, currency: 'KRW', skin_type: primaryType(c) });

    var form = $('#co-form');
    var rules = {
      name: function (v) { return v.trim().length >= 2 ? '' : '이름을 2자 이상 입력해 주세요.'; },
      phone: function (v) { return /^01[0-9][- ]?\d{3,4}[- ]?\d{4}$/.test(v.trim()) ? '' : '연락처를 010-0000-0000 형식으로 입력해 주세요.'; },
      addr: function (v) { return v.trim().length >= 6 ? '' : '받으실 주소를 동·호수까지 입력해 주세요.'; }
    };
    function check(id) {
      var f = $('#' + id), m = rules[id](f.value);
      $('#' + id + '-err').textContent = m;
      f.setAttribute('aria-invalid', m ? 'true' : 'false');
      return !m;
    }
    Object.keys(rules).forEach(function (id) { $('#' + id).addEventListener('blur', function () { check(id); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = Object.keys(rules).map(check).every(Boolean);
      if (!ok) { var bad = $('[aria-invalid="true"]'); if (bad) bad.focus(); return; }
      var seq = lsGet('fg_seq', 0) + 1; lsSet('fg_seq', seq);
      var id = 'FG-' + String(seq).padStart(4, '0');
      // 개인정보는 저장·전송하지 않고, 주문 요약만 세션에 둡니다.
      ssSet('fg_order', { id: id, items: c, total: t.total, type: primaryType(c), tracked: false });
      saveCart([]);
      location.href = 'done.html' + (VARIANT !== 'base' ? '?variant=' + VARIANT : '');
    });
  };

  inits.done = function () {
    var o = ssGet('fg_order', null);
    if (!o) { $('#done-ok').hidden = true; $('#done-none').hidden = false; return; }
    $('#order-id').textContent = o.id;
    $('#order-sum').textContent = o.items.map(function (x) { return x.name + '(' + TYPES[x.type] + ')'; }).join(', ') + ' · ' + won(o.total);
    $('#next-type').textContent = TYPES[o.type] || '내 타입';
    if (!o.tracked) {
      var p = { transaction_id: o.id, value: o.total, currency: 'KRW', skin_type: o.type };
      var u = lsGet('fg_utm', {}); Object.keys(u).forEach(function (k) { p[k] = u[k]; });
      track('purchase', p);
      o.tracked = true; ssSet('fg_order', o);
    }
    $$('[data-signup]').forEach(function (b) {
      b.addEventListener('click', function () {
        track('sign_up', { method: b.dataset.signup });
        $('#signup-msg').hidden = false;
        $$('[data-signup]').forEach(function (x) { x.disabled = true; });
      });
    });
  };

  inits.refill = function () {
    var box = $('#refill-list');
    function render() {
      var t = getType() || 'oily';
      box.innerHTML = REFILLS.map(function (r) {
        return '<li class="line' + (r.was ? ' bundle' : '') + '"><div class="line-body"><strong>' + r.name + '</strong>' +
          '<span>' + r.spec + ' · ' + TYPES[t] + '</span></div>' +
          '<div class="price-col">' + (r.was ? '<s>' + won(r.was) + '</s><em>10% 할인</em>' : '') + '<b>' + won(r.price) + '</b></div>' +
          '<button type="button" class="btn small" data-add="' + r.sku + '">장바구니 담기</button></li>';
      }).join('');
    }
    render();
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-seg="refill"] button')) render();
      var b = e.target.closest('[data-add]');
      if (!b) return;
      var t = getType();
      if (!t) { $('#refill-err').hidden = false; return; }
      var r = REFILLS.filter(function (x) { return x.sku === b.dataset.add; })[0];
      addItem({ sku: r.sku, name: r.name, type: t, price: r.price, qty: 1 });
      track('add_to_cart', { item_name: r.name, skin_type: t, value: r.price, currency: 'KRW' });
      b.textContent = '담았어요'; b.disabled = true;
      $('#refill-go').hidden = false;
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-seg="refill"] button')) $('#refill-err').hidden = true;
    });
  };

  /* ---------- 시작 ---------- */
  applyType(getType());
  updateBadge();
  renderDebug();
  track('page_view', { page_title: document.title, page_path: location.pathname });
  if (inits[page]) inits[page]();
  document.documentElement.classList.add('ready');
})();
