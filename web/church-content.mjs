import {findReferences, formatReference, parseReference, passageText, readerHref, samplePassage} from './scripture.mjs?v=1';

export const bulletinFields = ['title', 'reference', 'order', 'news'];
const wordFields = ['title', 'reference', 'meditation', 'application', 'prayer'];
const notes = wordFields.slice(2);
const example = {
  title: '평안한 하루',
  reference: formatReference(samplePassage),
  order: '찬송\n대표기도\n성경 봉독\n설교\n축도',
  news: '새가족 환영 모임\n예배 후 본당에서 모입니다.',
  meditation: '오늘은 잠시 멈추고 마음을 돌봅니다. 서두르지 않고 지금 할 수 있는 작은 일부터 시작해 봅니다.',
  application: '오늘 만나는 한 사람에게 따뜻한 인사를 건네 봅니다.',
  prayer: '오늘도 평안한 마음을 주세요. 주변 사람들에게도 그 평안을 나누게 해 주세요.',
};

const previewKey = 'churchContentPreview';
const drafts = new Map();

function storedFields(key, fields) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(key));
    if (stored && typeof stored === 'object') {
      return Object.fromEntries(fields.filter(key => typeof stored[key] === 'string').map(key => [key, stored[key]]));
    }
  } catch {}
  return null;
}

function save(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

let preview = storedFields(previewKey, Object.keys(example));

export function hasContentPreview() {
  return preview !== null;
}

export function clearContentPreview() {
  preview = null;
  save(previewKey, null);
}

export function setupFields(form, draftKey, fieldNames, initial = {}) {
  const values = drafts.get(draftKey) ?? storedFields(draftKey, fieldNames) ?? initial;
  for (const field of fieldNames) form.elements.namedItem(field).value = values[field] ?? '';
  return () => {
    const draft = Object.fromEntries(fieldNames.map(field => [field, form.elements.namedItem(field).value.trim()]));
    drafts.set(draftKey, draft);
    save(draftKey, draft);
    return draft;
  };
}

export function checkReference(form, reference, message) {
  const input = form.elements.namedItem('reference');
  if (reference && !parseReference(reference)) {
    input.setAttribute('aria-invalid', 'true');
    message.textContent = '성경구절을 확인해 주세요. 예를 들어 요한복음 14:27로 입력할 수 있어요.';
    input.focus();
    return false;
  }
  input.removeAttribute('aria-invalid');
  return true;
}

export function applyContent(values) {
  const current = preview ?? example;
  preview = {...current, ...values};
  const previousRef = parseReference(current.reference ?? '');
  const nextRef = parseReference(preview.reference ?? '');
  preview.reference = nextRef ? formatReference(nextRef) : '';
  if (!Object.hasOwn(values, 'meditation') && current.reference !== preview.reference &&
      (!previousRef || !nextRef || readerHref(previousRef) !== readerHref(nextRef))) {
    for (const note of notes) preview[note] = '';
  }
  save(previewKey, preview);
}

export function setupWordEditor(form) {
  const saveDraft = setupFields(form, 'wordDraft', wordFields, preview ?? example);
  const message = form.querySelector('[role="status"]');
  form.oninput = () => {
    saveDraft();
    form.elements.namedItem('reference').removeAttribute('aria-invalid');
    message.textContent = '초안을 이 탭에 저장했어요.';
  };
  form.onsubmit = event => {
    event.preventDefault();
    const values = saveDraft();
    if (!values.title || !values.reference) {
      message.textContent = '말씀 제목과 성경구절을 모두 입력해 주세요.';
      return;
    }
    if (!checkReference(form, values.reference, message)) return;
    applyContent(values);
    location.hash = 'devotion';
  };
}

const headings = {
  order: /^예\s*배\s*순\s*서(?:\s*[:：-]\s*|\s+|$)/u,
  news: /^(?:교\s*회\s*소\s*식|광\s*고|공\s*지(?:사항)?)(?:\s*[:：-]\s*|\s+|$)/u,
  title: /^(?:설\s*교\s*제\s*목|말\s*씀\s*제\s*목|설교|오늘의 말씀)(?:\s*[:：-]\s*|\s+|$)/u,
  reference: /^(?:성\s*경\s*봉\s*독|성\s*경\s*본\s*문|설\s*교\s*본\s*문|오늘의 성경구절|성경구절|본\s*문)(?:\s*[:：-]\s*|\s+|$)/u,
};
const otherHeading = /^(?:예\s*배\s*안\s*내|예\s*배\s*시\s*간|모임 안내|정기 모임|교인 명단|새가족 명단|연락처|기도 제목|헌금 내역|안내위원)(?:\s*[:：-]|\s*$)/u;
const contact = /(?:01[016789]|0[2-6]\d?)[ .-]?\d{3,4}[ .-]?\d{4}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu;

export function extractBulletinContent(text) {
  const result = {title: '', reference: '', order: [], news: []};
  const references = new Set();
  let section = '';
  let pending = '';
  for (const raw of text.normalize('NFKC').split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || contact.test(line)) continue;
    if (otherHeading.test(line)) {
      section = pending = '';
      continue;
    }
    const heading = Object.keys(headings).find(key => headings[key].test(line));
    const value = heading ? line.replace(headings[heading], '').trim() : line;
    if (heading === 'order' || heading === 'news') {
      section = heading;
      pending = '';
    }
    const field = heading ?? (pending || section);
    if (!value) {
      pending = field;
      if (section === 'order' && field === 'reference') result.order.push(line);
      continue;
    }
    if (field === 'reference') {
      for (const ref of findReferences(value)) references.add(formatReference(ref));
    } else if (field === 'title' && !result.title && !findReferences(value).length) {
      result.title = value;
    }
    if (field === 'order' || field === 'news') {
      result[field].push(value);
    } else if (section === 'order' && heading) {
      result.order.push(line);
    }
    pending = '';
  }
  result.reference = references.size === 1 ? [...references][0] : '';
  return {
    title: result.title, reference: result.reference,
    order: result.order.join('\n'), news: result.news.join('\n'),
    references: [...references],
  };
}

function setPassage(app, selector, reference, source) {
  const link = app.querySelector(selector);
  link.hidden = !reference;
  if (reference) link.href = readerHref(reference, source);
}

export function renderChurchContent(app, page, admin) {
  const content = admin && preview ? preview : example;
  const ref = parseReference(content.reference ?? '');
  const reference = ref ? formatReference(ref) : '';
  if (page === 'home') {
    app.querySelector('#weekly-word').textContent = content.title || '이번 주 말씀';
    app.querySelector('.feature-label').hidden = !content.title;
    app.querySelector('.feature-reference').textContent = reference;
    const news = app.querySelector('[data-home-news]');
    news.textContent = content.news?.split('\n')[0] ?? '';
    news.hidden = !news.textContent;
    return;
  }
  if (admin && preview) app.querySelector('.sample-label').textContent = '이 브라우저 미리보기';
  if (page === 'bulletin') {
    const passage = ref ? passageText(ref) : '';
    app.querySelector('[data-bulletin-reference]').textContent = reference || '등록된 성경구절이 없어요.';
    const quote = app.querySelector('[data-bulletin-quote]');
    quote.textContent = passage;
    quote.hidden = !passage;
    app.querySelector('[data-bulletin-edition]').hidden = !passage;
    setPassage(app, '[data-scripture-link]', ref, 'bulletin');
    const sermon = app.querySelector('.bulletin-sermon');
    sermon.hidden = !content.title;
    sermon.querySelector('h3').textContent = content.title ?? '';
    const order = app.querySelector('.bulletin-order');
    const items = (content.order ?? '').split('\n').map(item => item.trim()).filter(Boolean);
    order.hidden = !items.length;
    order.querySelector('ol').replaceChildren(...items.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    const news = app.querySelector('#bulletin-news');
    news.hidden = !content.news;
    const [headline, ...body] = (content.news ?? '').split('\n');
    news.querySelector('h3').textContent = headline;
    news.querySelector('p').textContent = body.join('\n');
    return;
  }
  app.querySelector('#devotion-title').textContent = content.title || '이번 주 말씀';
  app.querySelector('[data-devotion-reference]').textContent = reference;
  setPassage(app, '.devotion-reference', ref, 'devotion');
  for (const key of notes) {
    const card = app.querySelector('[data-note="' + key + '"]');
    card.hidden = !content[key];
    card.querySelector('[data-spoken]').textContent = content[key] ?? '';
  }
  app.querySelector('[data-listen]').hidden = !notes.some(key => content[key]);
}
