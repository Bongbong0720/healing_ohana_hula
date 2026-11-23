'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const SONGS = [ ['ke-aloha', 'Ke Aloha'], ['pearly-shells', 'Pearly Shell'], ['ke-ao-nani', 'Ke Ao Nani'], ['hawaiian-wedding', 'Hawaiian Wedding Song'] ];
  const LABELS = Object.fromEntries([...SONGS, ['basic', '기본 동작'], ['unassigned', '곡 미분류']]);
  const CATEGORIES = { instructor: '강사 영상', practice: '연습 영상', attendance: '수업 기록', photo: '사진', press: '강남라이프', workshop: '워크숍', mv: '종강 기념 영상', graduation: '종강모임', festival: '비건페스티벌' };
  const GRADUATION_GROUPS = [['lei', 'Lei 만들기'], ['party-time', 'Party Time']];
  const GRADUATION_LABELS = Object.fromEntries(GRADUATION_GROUPS);
  const GRADUATION_SEARCH = { lei: 'lei 레이 만들기', 'party-time': 'party time party-time partytime 파티 타임' };
  const FESTIVAL_GROUPS = [['outdoor-performance', 'Ke Aloha 공연'], ['outdoor-group', '야외 단체사진'], ['indoor', 'Behind the Stage'], ['green-dress', '하나리케 마이투투 공연'], ['other', '그 밖의 순간']];
  const FESTIVAL_LABELS = Object.fromEntries(FESTIVAL_GROUPS);
  const MODES = ['week', 'song', 'press', 'festival'];
  const PLAN_NOTICE = '학습 내용은 참가신청서의 계획을 참고했으며, 실제 기록은 파일의 주차 구분을 따릅니다.';
  const state = { items: [], curriculum: [], mode: 'week', selection: 'all', category: 'all', query: '', visible: [], loaded: false, loadError: false };
  let viewerItems = [], viewerIndex = 0, returnFocus = null;
  const dialog = $('media-dialog');
  function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function icon(name) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('aria-hidden', 'true'); const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#i-' + name); svg.append(use); return svg; }
  function asset(filename) {
    if (typeof filename !== 'string' || !filename.trim()) return '';
    let name = filename.startsWith('./') ? filename.slice(2) : filename;
    try { name = decodeURIComponent(name); } catch (_) { /* Literal percent is a valid filename. */ }
    if (name === '.' || name === '..' || /[\\/]/.test(name) || name.includes(':')) return '';
    return './' + encodeURIComponent(name);
  }
  function isFestival(item) { return item.category === 'festival'; }
  function festivalKey(item) { return Object.hasOwn(FESTIVAL_LABELS, item.festivalPart) ? item.festivalPart : 'other'; }
  function isPress(item) { if (isFestival(item)) return false; let name = String(item.original || '') + ' ' + String(item.src || ''); try { name = decodeURIComponent(name); } catch (_) {} return item.category === 'press' || name.includes('강남라이프'); }
  function isGraduation(item) { return item.category === 'graduation'; }
  function groupKey(item) { return Object.hasOwn(GRADUATION_LABELS, item.group) ? item.group : ''; }
  function isRegular(item) { return !isGraduation(item) && !isFestival(item) && !isPress(item) && item.category !== 'workshop' && item.category !== 'mv'; }
  function songKey(item) { return Object.hasOwn(LABELS, item.song) ? item.song : 'unassigned'; }
  function songLabel(value) { if (Object.hasOwn(LABELS, value)) return LABELS[value]; return String(value || ''); }
  function weekLabel(item) { return item.week ? item.week + '주차' : ''; }
  function titleFor(item) { return String(item.title || '').trim() || (isGraduation(item) ? (GRADUATION_LABELS[groupKey(item)] || '종강모임') + '의 순간' : isFestival(item) ? FESTIVAL_LABELS[festivalKey(item)] + '의 순간' : item.week ? item.week + '주차의 기록' : item.category === 'mv' ? '종강 기념 영상' : isPress(item) ? '강남라이프의 기록' : '함께한 순간의 기록'); }
  function duration(seconds) { const n = Number(seconds); if (!Number.isFinite(n) || n <= 0) return ''; const total = Math.round(n), h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = String(total % 60).padStart(2, '0'); return h ? h + ':' + String(m).padStart(2, '0') + ':' + s : m + ':' + s; }
  function graduationLabel(item) { const group = GRADUATION_LABELS[groupKey(item)] || '', title = titleFor(item); return [...new Set(['종강모임', group && !title.includes(group) ? group : '', title].filter(Boolean))].join(' · '); }
  function festivalLabel(item) { const part = FESTIVAL_LABELS[festivalKey(item)], title = titleFor(item); return [...new Set(['비건페스티벌', title.includes(part) ? '' : part, title].filter(Boolean))].join(' · '); }
  function visualLabel(item) { return isFestival(item) ? festivalLabel(item) : graduationLabel(item); }
  function searchText(item) { const graduation = isGraduation(item), festival = isFestival(item), key = groupKey(item); return [titleFor(item), item.original, weekLabel(item), graduation || festival ? '' : LABELS[songKey(item)], CATEGORIES[item.category], isPress(item) ? '강남라이프 촬영' : '', graduation && key ? GRADUATION_LABELS[key] + ' ' + GRADUATION_SEARCH[key] : '', festival ? '비건 페스티벌 vegan festival ' + FESTIVAL_LABELS[festivalKey(item)] : ''].join(' ').toLocaleLowerCase('ko'); }
  function pool(mode = state.mode) { if (mode === 'festival') return FESTIVAL_GROUPS.flatMap(([key]) => state.items.filter(item => isFestival(item) && festivalKey(item) === key)); if (mode === 'press') return state.items.filter(item => !isGraduation(item) && !isFestival(item) && isPress(item)); if (mode === 'song') return state.items.filter(item => item.type === 'video' && isRegular(item)); return state.items.filter(item => isGraduation(item) ? Boolean(groupKey(item)) : item.week && isRegular(item)); }
  function selectedPool() { return pool().filter(item => state.selection === 'all' || (state.mode === 'week' ? (state.selection === 'graduation' ? isGraduation(item) : !isGraduation(item) && String(item.week) === state.selection) : state.mode === 'song' ? songKey(item) === state.selection : true)); }
  function subTabs(choices, prefix, controls, label) {
    const categories = $('category-filters');
    if (!choices.some(([value]) => value === state.category)) state.category = 'all';
    categories.hidden = false; categories.setAttribute('role', 'tablist'); categories.setAttribute('aria-label', label);
    for (const [value, text] of choices) {
      const selected = state.category === value;
      const tab = chip(text, value, selected, next => { state.category = next; render(); });
      tab.id = prefix + value; tab.setAttribute('role', 'tab'); tab.removeAttribute('aria-pressed');
      tab.setAttribute('aria-selected', String(selected)); tab.setAttribute('aria-controls', controls); tab.tabIndex = selected ? 0 : -1;
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const index = choices.findIndex(([key]) => key === state.category);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : choices.length - 1)) % choices.length;
        state.category = choices[next][0]; render(); $(prefix + state.category).focus();
      });
      categories.append(tab);
    }
  }
  function chip(label, value, selected, onClick) { const button = el('button', 'filter-chip', label); button.type = 'button'; button.setAttribute('aria-pressed', String(selected)); button.dataset.value = value; button.addEventListener('click', () => { const group = button.parentElement; onClick(value); const replacement = group && Array.from(group.children).find(candidate => candidate.dataset.value === value); if (replacement) replacement.focus({ preventScroll: true }); }); return button; }
  function renderFilters() {
    const primary = $('primary-filters'); primary.replaceChildren(); primary.hidden = state.mode === 'press' || state.mode === 'festival';
    primary.setAttribute('aria-label', state.mode === 'song' ? '연습곡 선택' : '주차 선택');
    const choices = state.mode === 'week' ? [['all', '전체'], ...Array.from({ length: 10 }, (_, i) => [String(i + 1), (i + 1) + '주차']), ['graduation', '종강모임']] : [['all', '전체'], ...SONGS];
    if (state.mode === 'song') for (const key of ['basic', 'unassigned']) if (pool().some(item => songKey(item) === key)) choices.push([key, LABELS[key]]);
    if (!primary.hidden) for (const [value, label] of choices) primary.append(chip(label, value, state.selection === value, (selection) => { state.selection = selection; state.category = 'all'; render(); }));
    const categories = $('category-filters'); categories.replaceChildren();
    categories.setAttribute('role', 'group'); categories.setAttribute('aria-label', '영상 종류 선택');
    if (state.mode === 'week' && state.selection === 'graduation') { subTabs([['all', '모든기록'], ...GRADUATION_GROUPS], 'graduation-tab-', 'graduation-groups', '종강모임 분류'); return; }
    if (state.mode === 'festival') { subTabs([['all', '모든기록'], ...FESTIVAL_GROUPS], 'festival-tab-', 'media-grid', '비건페스티벌 분류'); return; }
    const available = ['instructor', 'practice'].filter(category => selectedPool().some(item => item.type === 'video' && item.category === category));
    categories.hidden = !available.length || state.mode === 'press';
    if (!available.includes(state.category)) state.category = 'all';
    for (const [value, label] of [['all', '모든 기록'], ...available.map(key => [key, CATEGORIES[key]])]) categories.append(chip(label, value, state.category === value, (category) => { state.category = category; render(); }));
  }
  function makeCard(item, getViewerItems) {
    const button = el('button', 'media-card'); button.type = 'button'; button.setAttribute('aria-label', titleFor(item) + ' · ' + (item.type === 'video' ? '영상 보기' : '사진 보기'));
    const visual = el('span', 'card-visual'), fallback = el('span', 'card-fallback'); fallback.append(icon(item.type === 'video' ? 'play' : 'photo')); visual.append(fallback);
    const thumb = asset(item.thumb) || (item.type === 'image' ? asset(item.src) : '');
    if (thumb) { const image = el('img'); image.src = thumb; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.addEventListener('error', () => image.remove(), { once: true }); visual.append(image); }
    if (item.type === 'video') { const play = el('span', 'card-play'); play.append(icon('play')); visual.append(play); }
    const badge = el('span', 'card-badge'); badge.append(icon(item.type === 'video' ? 'play' : 'photo'), document.createTextNode(item.type === 'video' ? '영상' : '사진')); visual.append(badge);
    if (item.type === 'video' && duration(item.duration)) visual.append(el('span', 'card-duration', duration(item.duration)));
    const meta = el('span', 'card-meta');
    const bits = [weekLabel(item), item.song && LABELS[item.song] ? LABELS[item.song] : '', isPress(item) ? '강남라이프' : CATEGORIES[item.category] || '함께한 기록'].filter(Boolean);
    for (const bit of [...new Set(bits)]) meta.append(el('span', '', bit));
    button.append(visual, meta, el('h4', '', titleFor(item)));
    if (isPress(item)) button.append(el('span', 'card-credit', '강남라이프 촬영'));
    button.addEventListener('click', () => openViewer(item, getViewerItems(), button)); return button;
  }
  function makeGraduationCard(item, getViewerItems) {
    const button = el('button', 'media-card ' + (isFestival(item) ? 'visual-card' : 'graduation-card')); button.type = 'button'; button.setAttribute('aria-label', visualLabel(item) + ' · ' + (item.type === 'video' ? '영상 보기' : '사진 보기'));
    const visual = el('span', 'card-visual'), fallback = el('span', 'card-fallback'); fallback.append(icon(item.type === 'video' ? 'play' : 'photo')); visual.append(fallback);
    const thumb = asset(item.thumb) || (item.type === 'image' ? asset(item.src) : '');
    if (thumb) { const image = el('img'); image.src = thumb; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.addEventListener('error', () => image.remove(), { once: true }); visual.append(image); }
    if (item.type === 'video') { const play = el('span', 'card-play'); play.append(icon('play')); visual.append(play); }
    button.append(visual); button.addEventListener('click', () => openViewer(item, getViewerItems(), button)); return button;
  }
  function renderGraduation(items, show, query) {
    const area = $('graduation-area'), grid = $('graduation-groups'); area.hidden = !show;
    if (!show) { grid.replaceChildren(); return; }
    const focused = state.selection === 'graduation';
    area.classList.toggle('is-focused', focused); $('graduation-heading').hidden = focused;
    area.setAttribute('aria-labelledby', focused ? 'view-title' : 'graduation-title');
    grid.classList.add('media-grid', 'graduation-grid');
    if (focused) { grid.setAttribute('role', 'tabpanel'); grid.setAttribute('aria-labelledby', 'graduation-tab-' + state.category); grid.tabIndex = 0; }
    else { grid.removeAttribute('role'); grid.removeAttribute('aria-labelledby'); grid.removeAttribute('tabindex'); }
    grid.replaceChildren(...items.map(item => makeGraduationCard(item, () => [...items])));
  }
  function renderContext() {
    const selected = state.selection !== 'all', graduation = state.mode === 'week' && state.selection === 'graduation', festival = state.mode === 'festival';
    $('view-title').textContent = festival ? '비건페스티벌' : state.mode === 'press' ? '강남라이프의 시선으로' : state.mode === 'song' ? selected ? LABELS[state.selection] : '네 곡의 이야기, 한 걸음씩' : graduation ? '종강모임' : selected ? state.selection + '주차의 기록' : '열 번의 만남, 우리의 기록';
    $('view-description').textContent = state.mode === 'press' ? '강남라이프 촬영 · 함께한 순간을 담은 기록입니다.' : state.mode === 'song' ? state.selection === 'unassigned' ? '원본 파일에 곡명이 없는 영상입니다. 잘못 분류하지 않도록 따로 모았습니다.' : '강사 영상과 연습 영상을 곡별로 모았습니다. 출석사진 등 사진은 주차별 기록에서 볼 수 있습니다.' : graduation ? '' : '수업 영상부터 사진까지, 그날의 순간들을 함께 살펴보세요.';
    $('view-description').hidden = graduation || festival;
    const note = $('curriculum-note'); note.replaceChildren();
    const plans = state.mode === 'week' && selected ? state.curriculum.filter(row => String(row.week) === state.selection) : [];
    note.hidden = !plans.length;
    for (const plan of plans) { const songs = plan.songs.map(songLabel).filter(Boolean); if (songs.length) note.append(el('strong', '', songs.join(' · '))); if (plan.note) note.append(el('p', '', plan.note)); }
    if (plans.length) note.append(el('p', '', PLAN_NOTICE));
  }
  function render() {
    if (!state.loaded) return;
    renderFilters(); renderContext();
    const query = state.query.trim().toLocaleLowerCase('ko');
    const matches = item => !query || searchText(item).includes(query);
    const showGraduation = state.mode === 'week' && (state.selection === 'graduation' || state.selection === 'all' && state.category === 'all');
    const festival = state.mode === 'festival';
    const records = festival ? pool().filter(item => (state.category === 'all' || festivalKey(item) === state.category) && matches(item)) : selectedPool().filter(item => !isGraduation(item) && (state.category === 'all' || item.type === 'video' && item.category === state.category) && matches(item));
    const graduation = showGraduation ? GRADUATION_GROUPS.flatMap(([key]) => pool().filter(item => isGraduation(item) && groupKey(item) === key && (state.selection !== 'graduation' || state.category === 'all' || groupKey(item) === state.category) && matches(item))) : [];
    state.visible = [...records, ...graduation];
    const grid = $('media-grid'); const fragment = document.createDocumentFragment();
    for (const item of records) fragment.append(festival ? makeGraduationCard(item, () => [...records]) : makeCard(item, () => [...records]));
    grid.classList.toggle('visual-grid', festival);
    if (festival) { grid.setAttribute('role', 'tabpanel'); grid.setAttribute('aria-labelledby', 'festival-tab-' + state.category); grid.tabIndex = 0; }
    else { grid.removeAttribute('role'); grid.removeAttribute('aria-labelledby'); grid.removeAttribute('tabindex'); }
    grid.replaceChildren(fragment); grid.setAttribute('aria-busy', 'false'); grid.hidden = state.mode === 'week' && state.selection === 'graduation';
    renderGraduation(graduation, showGraduation, query);
    $('result-count').textContent = state.visible.length + '개의 기록' + (query ? ' · 검색 결과' : '');
    $('empty-state').hidden = state.visible.length > 0;
    $('empty-title').textContent = query ? '검색 결과가 없어요' : '아직 표시할 기록이 없어요';
    $('empty-message').textContent = query ? '검색어를 바꾸거나 필터를 초기화해 보세요.' : festival ? '다른 분류를 선택해 보세요.' : '다른 주차나 연습곡을 선택해 보세요.';
    $('reset-filters').textContent = '필터 초기화';
  }
  function setMode(mode, reset = true) {
    if (!MODES.includes(mode)) return;
    state.mode = mode; $('press-article').hidden = mode !== 'press';
    if (reset) { state.selection = 'all'; state.category = 'all'; state.query = ''; $('search').value = ''; }
    for (const tab of document.querySelectorAll('[data-mode]')) { const selected = tab.dataset.mode === mode; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; }
    $('archive-panel').setAttribute('aria-labelledby', 'tab-' + mode);
    for (const link of document.querySelectorAll('[data-nav]')) { if (link.dataset.nav === mode) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }
    render();
  }
  const modeHash = { week: '#weeks', song: '#songs', press: '#press', festival: '#festival' };
  function navigate(mode, scroll) { setMode(mode); history.replaceState(null, '', modeHash[mode]); if (scroll) $('archive').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  for (const link of document.querySelectorAll('[data-nav]')) link.addEventListener('click', event => { event.preventDefault(); navigate(link.dataset.nav, true); });
  for (const tab of document.querySelectorAll('[data-mode]')) {
    tab.addEventListener('click', () => navigate(tab.dataset.mode, false));
    tab.addEventListener('keydown', event => { const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']; if (!keys.includes(event.key)) return; event.preventDefault(); const modes = MODES; let next = modes.indexOf(state.mode); if (event.key === 'Home') next = 0; else if (event.key === 'End') next = modes.length - 1; else next = (next + (event.key === 'ArrowRight' ? 1 : modes.length - 1)) % modes.length; navigate(modes[next], false); $('tab-' + modes[next]).focus(); });
  }
  window.addEventListener('hashchange', () => { const entry = Object.entries(modeHash).find(([, hash]) => hash === location.hash); if (entry) { setMode(entry[0]); $('archive').scrollIntoView(); } });
  $('search').addEventListener('input', event => { state.query = event.target.value; render(); });
  $('reset-filters').addEventListener('click', () => { if (state.loadError) { loadData(); return; } state.selection = 'all'; state.category = 'all'; state.query = ''; $('search').value = ''; render(); });
  function stopMedia() { for (const video of $('dialog-stage').querySelectorAll('video')) { video.pause(); try { video.currentTime = 0; } catch (_) {} video.removeAttribute('src'); video.load(); } $('dialog-stage').replaceChildren(); }
  function showCurrent() {
    stopMedia(); const item = viewerItems[viewerIndex]; if (!item) return;
    const visualOnly = isGraduation(item) || isFestival(item), label = visualOnly ? visualLabel(item) : titleFor(item);
    dialog.classList.toggle('is-visual-only', visualOnly);
    $('dialog-title').textContent = label; $('dialog-title').classList.toggle('sr-only', visualOnly); $('dialog-meta').hidden = visualOnly;
    $('dialog-meta').textContent = visualOnly ? '' : [weekLabel(item), item.song && LABELS[item.song] ? LABELS[item.song] : '', item.type === 'video' ? '영상' : '사진', duration(item.duration), isPress(item) ? '강남라이프 촬영' : CATEGORIES[item.category]].filter(Boolean).join(' · ');
    const stage = $('dialog-stage'); let media;
    if (item.type === 'video') { media = el('video'); media.controls = true; media.playsInline = true; media.preload = 'none'; if (asset(item.thumb)) media.poster = asset(item.thumb); media.setAttribute('aria-label', label); media.append(el('p', '', '이 브라우저는 동영상 재생을 지원하지 않습니다.')); }
    else { media = el('img'); media.alt = label + (!visualOnly && isPress(item) ? ' · 강남라이프 촬영' : ''); }
    media.addEventListener('error', () => { if (!stage.querySelector('.media-error')) { const error = el('p', 'media-error', '이 파일을 불러오지 못했어요. 다른 기록을 선택하거나 잠시 후 다시 시도해 주세요.'); stage.replaceChildren(error); } }, { once: true });
    media.src = asset(item.src); stage.append(media);
    $('dialog-position').textContent = (viewerIndex + 1) + ' / ' + viewerItems.length;
    $('dialog-prev').disabled = viewerItems.length < 2; $('dialog-next').disabled = viewerItems.length < 2;
  }
  function openViewer(item, items, trigger) { viewerItems = items; viewerIndex = Math.max(0, items.indexOf(item)); returnFocus = trigger || document.activeElement; showCurrent(); if (!dialog.open) dialog.showModal(); $('dialog-close').focus(); }
  function stepViewer(delta) { if (viewerItems.length < 2) return; viewerIndex = (viewerIndex + delta + viewerItems.length) % viewerItems.length; showCurrent(); }
  $('dialog-close').addEventListener('click', () => dialog.close());
  $('dialog-prev').addEventListener('click', () => stepViewer(-1)); $('dialog-next').addEventListener('click', () => stepViewer(1));
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); });
  dialog.addEventListener('close', () => { stopMedia(); viewerItems = []; if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true }); });
  dialog.addEventListener('keydown', event => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; if (event.target.closest('video, input, textarea, select') || event.altKey || event.ctrlKey || event.metaKey) return; event.preventDefault(); stepViewer(event.key === 'ArrowLeft' ? -1 : 1); });
  $('mv-open').addEventListener('click', () => { const mv = state.items.find(item => item.category === 'mv' && item.type === 'video') || { id: 'celebration-mv', src: 'mv.mp4', thumb: 'mv-poster.jpg', type: 'video', category: 'mv', title: '종강 기념 영상', week: null }; openViewer(mv, [mv], $('mv-open')); });
  function renderCurriculum() {
    const list = $('curriculum-list'); list.replaceChildren(); $('curriculum-details').hidden = !state.curriculum.length;
    if (!state.curriculum.length) return;
    for (const row of state.curriculum) { const article = el('div', 'curriculum-item'); article.append(el('strong', '', row.week + '주차')); const body = el('div'); if (row.songs.length) body.append(el('h4', '', row.songs.map(songLabel).join(' · '))); if (row.note) body.append(el('p', '', row.note)); article.append(body); list.append(article); }
  }
  function renderWorkshop() { const items = state.items.filter(item => item.category === 'workshop' && item.type === 'image'); $('workshop-details').hidden = !items.length; $('workshop-count').textContent = items.length + '장의 사진'; $('workshop-grid').replaceChildren(...items.map(item => makeCard(item, () => items))); }
  async function loadData() {
    state.loadError = false; $('media-grid').setAttribute('aria-busy', 'true'); $('result-count').textContent = '기록을 불러오는 중입니다.'; $('empty-state').hidden = true;
    try {
      const response = await fetch('./media.json?v=vegan-festival-2'); if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json(); if (!data || !Array.isArray(data.items)) throw new Error('Invalid media data');
      state.items = data.items.filter(item => item && ['image', 'video'].includes(item.type) && asset(item.src)).map((item, index) => ({ ...item, id: item.id || 'record-' + index, week: Number.isInteger(item.week) && item.week >= 1 && item.week <= 10 ? item.week : null })).sort((a, b) => (a.week || 99) - (b.week || 99));
      state.curriculum = (Array.isArray(data.curriculum) ? data.curriculum : []).filter(row => row && Number.isInteger(row.week) && row.week >= 1 && row.week <= 10).map(row => ({ week: row.week, songs: Array.isArray(row.songs) ? row.songs.filter(value => typeof value === 'string') : [], note: typeof row.note === 'string' ? row.note : '' })).sort((a, b) => a.week - b.week);
      state.loaded = true; for (const mode of MODES) $('count-' + mode).textContent = pool(mode).length;
      renderCurriculum(); renderWorkshop();
      const entry = Object.entries(modeHash).find(([, hash]) => hash === location.hash); setMode(entry ? entry[0] : state.mode, false);
      if (entry) $('archive').scrollIntoView({ behavior: 'instant' });
    } catch (error) {
      state.loadError = true; state.loaded = false; $('media-grid').setAttribute('aria-busy', 'false'); $('result-count').textContent = '기록을 불러오지 못했습니다.'; $('empty-state').hidden = false; $('empty-title').textContent = '기록을 불러올 수 없어요'; $('empty-message').textContent = '인터넷 연결과 media.json 파일을 확인해 주세요. 로컬에서는 웹 서버로 열어야 합니다.'; $('reset-filters').textContent = '다시 불러오기'; console.error('Media archive could not be loaded:', error);
    }
  }
  loadData();
})();
