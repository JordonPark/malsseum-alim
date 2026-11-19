import {renderChurchContent, setupWordEditor} from './church-content.mjs?v=1';
import {formatReference, officialPassage, parseReference, passageText, readerHref, readReference, samplePassage} from './scripture.mjs?v=1';

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const brand = document.querySelector('.brand');
const brandIcon = brand.querySelector('.brand-icon');
const churchLogo = brand.querySelector('.church-logo');
const denominationBadge = brand.querySelector('.denomination-badge');
const loginLink = document.querySelector('.login-link');
const adminIndicator = document.querySelector('.admin-indicator');
const settingsLink = document.querySelector('.settings-link');
const tabs = document.querySelector('.tabs');
const churchTabs = new Map([...tabs.querySelectorAll('a')].map(link => [link.hash.slice(1), link]));
const adminEntryCode = '002432';
const adminPreviewKey = 'adminPreviewOpen';
let utterance;
let adminPreviewOpen = false;

try { document.documentElement.classList.toggle('large', localStorage.getItem('largeText') === 'true'); } catch {}
try { adminPreviewOpen = sessionStorage.getItem(adminPreviewKey) === 'true'; } catch {}

function setAdminPreview(open) {
  adminPreviewOpen = open;
  // This tab preference controls navigation to a public demo.
  try {
    if (open) sessionStorage.setItem(adminPreviewKey, 'true');
    else sessionStorage.removeItem(adminPreviewKey);
  } catch {}
  location.hash = open ? 'home' : 'entry';
}

function setupSettings(fromEntry) {
  const size = document.querySelector('#size');
  const root = document.documentElement;
  size.setAttribute('aria-pressed', root.classList.contains('large'));
  size.onclick = () => {
    const large = root.classList.toggle('large');
    size.setAttribute('aria-pressed', large);
    try { localStorage.setItem('largeText', large); } catch {}
  };
  const adminLogin = app.querySelector('[data-admin-login]');
  const adminLeave = app.querySelector('[data-admin-leave]');
  adminLogin.hidden = adminPreviewOpen;
  adminLeave.hidden = !adminPreviewOpen;
  adminLeave.onclick = () => setAdminPreview(false);
  if (fromEntry) {
    adminLogin.href = '#login';
    const church = app.querySelector('a[href="#entry"]');
    church.querySelector('strong').textContent = '교회 찾기';
    church.querySelector('small').remove();
  }
}

function setListenState(playing) {
  const button = app.querySelector('[data-listen]');
  if (!button) return;
  button.textContent = playing ? '듣기 중지' : button.dataset.idleLabel || '묵상 듣기';
  button.toggleAttribute('data-playing', playing);
}

function stopSpeech() {
  utterance = undefined;
  window.speechSynthesis?.cancel();
  setListenState(false);
}
function toggleSpeech() {
  status.textContent = '';
  if (!window.speechSynthesis) {
    status.textContent = '이 브라우저에서는 음성 읽기를 사용할 수 없습니다.';
    return;
  }
  if (utterance) { stopSpeech(); return; }
  const title = (app.querySelector('#devotion-title') || app.querySelector('h1')).textContent;
  const paragraphs = app.querySelectorAll('[data-spoken]');
  const speech = new SpeechSynthesisUtterance([title + '.', ...Array.from(paragraphs, p => p.textContent)].join(' '));
  speech.lang = 'ko-KR';
  speech.rate = .85;
  speech.onend = () => { if (utterance === speech) stopSpeech(); };
  speech.onerror = () => {
    if (utterance !== speech) return;
    stopSpeech();
    status.textContent = '음성을 재생할 수 없습니다. 기기의 한국어 음성 설정을 확인해 주세요.';
  };
  utterance = speech;
  setListenState(true);
  window.speechSynthesis.speak(speech);
}

function setupSearch() {
  const input = document.querySelector('#query');
  const result = document.querySelector('#results');
  function update() {
    const q = input.value.trim().replace(/\s+/g, '');
    result.replaceChildren();
    const sampleNames = ['요한복음14장27절', '요한복음14:27', '요14:27'];
    const ref = parseReference(input.value) || (sampleNames.some(label => label.includes(q)) ? samplePassage : null);
    if (!ref) {
      result.textContent = '성경구절을 책 이름, 장, 절로 입력해 주세요.';
      return;
    }
    const link = document.createElement('a');
    link.className = 'button secondary';
    link.href = readerHref(ref, 'search');
    link.textContent = formatReference(ref);
    result.append(link);
  }
  input.oninput = update;
  update();
}
function setupReader(reference, origin) {
  const labels = {bulletin: '주보로 돌아가기', devotion: '이번 주 말씀으로', search: '성경 찾기로'};
  const back = app.querySelector('#reader-back');
  back.href = '#' + origin;
  back.textContent = labels[origin];
  app.querySelector('#chapter-name').textContent = formatReference(reference);
  const text = passageText(reference);
  const quote = app.querySelector('[data-reader-text]');
  quote.textContent = text;
  quote.hidden = !text;
  app.querySelector('[data-listen]').hidden = !text;
  app.querySelector('[data-reader-edition]').textContent = text
    ? '개역한글 · 예시 본문 · 대한성서공회 1961' : '대한성서공회 개역개정 본문';
  app.querySelector('[data-reader-source]').href = officialPassage(reference);
}

let churchBranding;

function renderChurchBranding() {
  const church = tabs.hidden ? null : churchBranding?.exampleChurch;
  const denomination = churchBranding?.denominations?.[church?.denomination];
  const hasDenomination = typeof denomination?.name === 'string' && typeof denomination?.label === 'string';
  const filename = church?.logo;
  const logo = typeof filename === 'string' && /^[a-z0-9][a-z0-9_-]*\.(?:png|jpe?g|webp)$/i.test(filename)
    ? './web/church-logos/' + filename : null;

  denominationBadge.textContent = hasDenomination ? denomination.label : '';
  denominationBadge.title = hasDenomination ? denomination.name : '';
  denominationBadge.dataset.denomination = hasDenomination ? church.denomination : '';
  const affiliation = app.querySelector('.church-denomination');
  if (affiliation) {
    affiliation.textContent = hasDenomination ? denomination.name : '';
    affiliation.hidden = !hasDenomination;
  }

  function showAvailableMark() {
    const hasLogo = Boolean(logo && churchLogo.complete && churchLogo.naturalWidth);
    churchLogo.hidden = !hasLogo;
    denominationBadge.hidden = hasLogo || !hasDenomination;
    brandIcon.hidden = hasLogo || hasDenomination;
  }

  churchLogo.onload = churchLogo.onerror = showAvailableMark;
  if (!logo) churchLogo.removeAttribute('src');
  else if (churchLogo.getAttribute('src') !== logo) churchLogo.src = logo;
  showAvailableMark();
}

function setupCodeEntry(adminOnly) {
  const form = app.querySelector('[data-code-form]');
  const input = form.elements.code;
  const error = form.querySelector('[role="alert"]');
  const keyboard = form.querySelector('[data-code-keyboard]');
  keyboard?.addEventListener('click', () => {
    const letters = input.inputMode === 'numeric';
    input.inputMode = letters ? 'text' : 'numeric';
    keyboard.setAttribute('aria-pressed', String(letters));
    input.focus();
  });
  input.addEventListener('input', () => {
    error.hidden = true;
    input.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const code = input.value.replace(/[\s-]/g, '');
    if (code === adminEntryCode) {
      setAdminPreview(true);
      return;
    }
    const validCode = /^([0-9]{6}|[A-Za-z][0-9]{5})$/.test(code);
    const invalid = adminOnly || !validCode;
    error.textContent = adminOnly ? '관리자 코드 숫자 6자리를 다시 확인해 주세요.'
      : invalid ? '교회 코드 6자리를 다시 확인해 주세요.' : '교회 코드 조회를 준비 중이에요.';
    error.hidden = false;
    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  });
}

function render() {
  stopSpeech();
  status.textContent = '';
  const [route, detail, third, fourth, fifth, sixth] = location.hash.slice(1).split('/');
  const legacyReader = route === 'read' && /^\d+$/u.test(detail);
  const reference = route !== 'read' ? null : legacyReader
    ? readReference('jhn', detail, third || '1') : readReference(detail, third, fourth, fifth);
  const readOrigin = ['bulletin', 'search', 'devotion'].includes(sixth) ? sixth : 'devotion';
  let page;
  if (route === 'bulletin' && detail === 'import') {
    page = adminPreviewOpen ? 'worship-import' : 'bulletin';
    if (!adminPreviewOpen) history.replaceState(null, '', '#bulletin');
  } else if (route === 'admin' || (route === 'login' && adminPreviewOpen)) {
    page = adminPreviewOpen ? 'home' : 'login';
    history.replaceState(null, '', '#' + page);
  } else if (route === 'devotion' && detail === 'edit') {
    page = adminPreviewOpen ? 'word-editor' : 'devotion';
    if (!adminPreviewOpen) history.replaceState(null, '', '#devotion');
  } else {
    page = reference ? 'read' : route === 'read' ? 'search'
      : ['home', 'entry', 'login', 'devotion', 'search', 'bulletin', 'worship', 'settings'].includes(route) ? route : 'entry';
  }
  const fromEntry = page === 'entry' || (page === 'settings' && detail === 'entry') || (page === 'login' && detail !== 'home');
  tabs.hidden = fromEntry || page === 'login';
  document.body.classList.toggle('has-tabs', !tabs.hidden);
  brand.href = fromEntry ? '#entry' : '#home';
  loginLink.hidden = page !== 'entry';
  adminIndicator.hidden = !adminPreviewOpen || tabs.hidden;
  settingsLink.hidden = page === 'login';
  settingsLink.href = fromEntry ? '#settings/entry' : '#settings';
  if (page === 'settings') settingsLink.setAttribute('aria-current', 'page');
  else settingsLink.removeAttribute('aria-current');
  const activeTab = page === 'worship-import' || (page === 'read' && readOrigin === 'bulletin') ? 'bulletin'
    : ['search', 'read', 'word-editor'].includes(page) ? 'devotion' : page;
  for (const [name, link] of churchTabs) {
    if (name === activeTab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  app.replaceChildren(document.getElementById(page).content.cloneNode(true));
  renderChurchBranding();
  if (['home', 'bulletin', 'devotion'].includes(page)) renderChurchContent(app, page, adminPreviewOpen);
  if (adminPreviewOpen && !fromEntry) {
    app.querySelectorAll('[data-admin-action]').forEach(link => { link.hidden = false; });
  }
  if (page === 'word-editor') setupWordEditor(app.querySelector('#word-editor-form'));
  if (adminPreviewOpen && ['home', 'worship', 'bulletin', 'worship-import'].includes(page)) {
    const pageHeader = app.firstElementChild;
    import('./worship-draft.mjs?v=2').then(module => {
      if (!pageHeader.isConnected) return;
      if (page === 'worship-import') {
        const returnTo = third === 'worship' ? 'worship' : 'bulletin';
        const back = app.querySelector('[data-import-back]');
        back.href = '#' + returnTo;
        back.textContent = returnTo === 'worship' ? '예배 안내로 돌아가기' : '주보로 돌아가기';
        module.setupWorshipImport(app.querySelector('.worship-import'), returnTo);
      } else module.renderWorshipPreview(app, page);
    }).catch(() => {
      if (pageHeader.isConnected && page === 'worship-import') {
        status.textContent = '예배시간 가져오기를 열지 못했어요. 새로고침한 뒤 다시 시도해 주세요.';
      }
    });
  }
  if (page === 'entry' || page === 'login') setupCodeEntry(page === 'login');
  if (page === 'search') setupSearch();
  if (page === 'read') setupReader(reference, readOrigin);
  if (page === 'settings') setupSettings(fromEntry);
  if (page === 'login' && !fromEntry) {
    const back = app.querySelector('[data-admin-back]');
    back.href = '#home';
    back.textContent = '교회 홈으로 돌아가기';
  }
  app.querySelectorAll('[data-listen]').forEach(button => { button.onclick = toggleSpeech; });
  const news = app.querySelector('#bulletin-news:not([hidden])');
  return detail === 'news' && news ? news : app;
}
window.addEventListener('hashchange', () => {
  const destination = render();
  if (destination === app) window.scrollTo(0, 0);
  else destination.scrollIntoView({block: 'nearest'});
  destination.focus({preventScroll: true});
});
window.addEventListener('pagehide', stopSpeech);
const destination = render();
if (destination !== app) destination.scrollIntoView({block: 'nearest'});

fetch('./web/church-branding.json', {cache: 'no-cache'})
  .then(response => response.ok ? response.json() : null)
  .then(branding => {
    churchBranding = branding;
    renderChurchBranding();
  })
  .catch(() => {});
