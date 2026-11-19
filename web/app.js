const app = document.querySelector('#app');
const status = document.querySelector('#status');
const brand = document.querySelector('.brand');
const brandIcon = brand.querySelector('.brand-icon');
const churchLogo = brand.querySelector('.church-logo');
const denominationBadge = brand.querySelector('.denomination-badge');
const loginLink = document.querySelector('.login-link');
const settingsLink = document.querySelector('.settings-link');
const tabs = document.querySelector('.tabs');
const churchTabs = new Map([...tabs.querySelectorAll('a')].map(link => [link.hash.slice(1), link]));
const chapters = {
  13: [[1, '13장 본문이 여기에 표시됩니다.']],
  14: [[26, '앞 절의 본문이 여기에 표시됩니다.'], [27, '선택한 구절의 본문이 여기에 표시됩니다.'], [28, '다음 절의 본문이 여기에 표시됩니다.']],
  15: [[1, '15장 본문이 여기에 표시됩니다.']],
};
let utterance;

try { document.documentElement.classList.toggle('large', localStorage.getItem('largeText') === 'true'); } catch {}

function setupSettings(fromEntry) {
  const size = document.querySelector('#size');
  const root = document.documentElement;
  size.setAttribute('aria-pressed', root.classList.contains('large'));
  size.onclick = () => {
    const large = root.classList.toggle('large');
    size.setAttribute('aria-pressed', large);
    try { localStorage.setItem('largeText', large); } catch {}
  };
  if (fromEntry) {
    app.querySelector('[data-admin-login]').href = '#login';
    const church = app.querySelector('a[href="#entry"]');
    church.querySelector('strong').textContent = '교회 찾기';
    church.querySelector('small').remove();
  }
}

function setListenState(playing) {
  const button = app.querySelector('[data-listen]');
  if (!button) return;
  button.textContent = playing ? '듣기 중지' : '묵상 듣기';
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
  const title = app.querySelector('#devotion-title').textContent;
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
    for (const chapter of Object.keys(chapters)) {
      const aliases = ['요한복음' + chapter + '장', '요' + chapter];
      if (chapter === '14') aliases.push('요14:27', '요한복음14:27', '요한복음14장27절');
      if (!aliases.some(alias => alias.includes(q))) continue;
      const verse = chapter === '14' && /27$|27절$/.test(q);
      const link = document.createElement('a');
      link.className = 'button secondary';
      link.href = '#read/' + chapter + (verse ? '/27' : '');
      link.textContent = '요한복음 ' + chapter + '장' + (verse ? ' 27절' : '');
      result.append(link);
    }
    if (!result.childElementCount) result.textContent = '일치하는 예시 구절이 없습니다.';
  }
  input.oninput = update;
  update();
}
function setupReader(chapter, selected) {
  document.querySelector('#chapter-name').textContent = '요한복음 ' + chapter + '장';
  if (selected === 27) {
    const back = document.querySelector('#reader-back');
    back.href = '#devotion';
    back.textContent = '이번 주 말씀으로';
  }
  for (const [number, text] of chapters[chapter]) {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = number;
    item.append(label, document.createTextNode(text));
    if (number === selected) {
      item.className = 'active';
      item.setAttribute('aria-current', 'true');
    }
    document.querySelector('#verses').append(item);
  }
  for (const [name, target] of [['previous', chapter - 1], ['next', chapter + 1]]) {
    const link = document.getElementById(name);
    if (chapters[target]) link.href = '#read/' + target;
    else link.setAttribute('aria-disabled', 'true');
  }
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

function setupEntry() {
  const form = document.querySelector('#church-form');
  const input = document.querySelector('#church-code');
  const error = document.querySelector('#church-error');
  input.addEventListener('input', () => {
    error.hidden = true;
    input.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const code = input.value.replace(/[\s-]/g, '');
    // This public shortcut opens the same screen as the login link.
    if (code === '002432') {
      location.hash = loginLink.hash;
      return;
    }
    const validCode = /^[0-9]{6}$/.test(code);
    error.textContent = validCode ? '교회 코드 조회를 준비 중이에요.' : '교회 코드 숫자 6자리를 다시 확인해 주세요.';
    error.hidden = false;
    if (!validCode) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  });
}

function render() {
  stopSpeech();
  status.textContent = '';
  const [route, detail, verse] = location.hash.slice(1).split('/');
  const page = route === 'read' && Object.hasOwn(chapters, detail) ? 'read'
    : ['home', 'entry', 'login', 'devotion', 'search', 'bulletin', 'worship', 'settings'].includes(route) ? route : 'entry';
  const fromEntry = page === 'entry' || (page === 'settings' && detail === 'entry') || (page === 'login' && detail !== 'home');
  tabs.hidden = fromEntry || page === 'login';
  document.body.classList.toggle('has-tabs', !tabs.hidden);
  brand.href = fromEntry ? '#entry' : '#home';
  loginLink.hidden = page !== 'entry';
  settingsLink.hidden = page === 'login';
  settingsLink.href = fromEntry ? '#settings/entry' : '#settings';
  if (page === 'settings') settingsLink.setAttribute('aria-current', 'page');
  else settingsLink.removeAttribute('aria-current');
  const activeTab = ['search', 'read'].includes(page) ? 'devotion' : page;
  for (const [name, link] of churchTabs) {
    if (name === activeTab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  app.replaceChildren(document.getElementById(page).content.cloneNode(true));
  renderChurchBranding();
  if (page === 'entry') setupEntry();
  if (page === 'search') setupSearch();
  if (page === 'read') setupReader(Number(detail), Number(verse));
  if (page === 'settings') setupSettings(fromEntry);
  if (page === 'login' && !fromEntry) {
    const back = app.querySelector('a');
    back.href = '#home';
    back.textContent = '교회 홈으로 돌아가기';
  }
  app.querySelectorAll('[data-listen]').forEach(button => { button.onclick = toggleSpeech; });
  return page === 'bulletin' && detail === 'news' ? document.getElementById('bulletin-news') : app;
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
