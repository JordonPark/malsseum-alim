import {extractWorshipTimes, formatWorshipTime, validWorshipTime, worshipDays} from './worship-times.mjs?v=1';

const draftKey = 'worshipDraft';
const previewKey = 'worshipPreview';

function readServices(key) {
  try {
    const result = JSON.parse(sessionStorage.getItem(key));
    if (Array.isArray(result)) {
      return result.filter(row => row && typeof row.name === 'string' &&
        (row.day === '' || worshipDays.includes(row.day)) &&
        (row.time === '' || validWorshipTime(row.time)));
    }
  } catch {}
  return [];
}

let draft = readServices(draftKey);
let preview = readServices(previewKey);

function saveServices(key, services) {
  try { sessionStorage.setItem(key, JSON.stringify(services)); } catch {}
}

function serviceKey({name, day, time}) {
  return JSON.stringify([name.trim().replace(/\s/g, ''), day, time]);
}

export function setupWorshipImport(form) {
  const files = form.querySelector('[type="file"]');
  const read = form.querySelector('[data-ocr-read]');
  const messages = form.querySelector('[data-ocr-message]');
  const rows = form.querySelector('[data-worship-rows]');
  const sourcePanel = form.querySelector('[data-ocr-sources]');
  const apply = form.querySelector('[type="submit"]');
  const reset = form.querySelector('[data-worship-reset]');
  const rowTemplate = document.getElementById('worship-draft-row');

  function rowValues(row) {
    return {
      name: row.querySelector('[data-worship-name]').value,
      day: row.querySelector('[data-worship-day]').value,
      time: row.querySelector('[data-worship-time]').value,
    };
  }

  function updateDraft() {
    draft = [...rows.children].map(rowValues);
    saveServices(draftKey, draft);
    apply.disabled = !draft.length || read.disabled;
  }

  function addRow(service = {name: '', day: '', time: ''}) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const name = row.querySelector('[data-worship-name]');
    const day = row.querySelector('[data-worship-day]');
    const time = row.querySelector('[data-worship-time]');
    const source = row.querySelector('[data-worship-source]');
    for (const value of worshipDays) day.add(new Option(value, value));
    name.value = service.name;
    day.value = service.day;
    time.value = service.time;
    if (service.excerpt) {
      source.hidden = false;
      source.textContent = (service.name && service.day && service.time ? '인식 원문 · ' : '확인 필요 · ') + service.excerpt;
    }
    row.addEventListener('input', updateDraft);
    row.querySelector('[data-worship-remove]').onclick = () => {
      row.remove();
      updateDraft();
    };
    rows.append(row);
    return name;
  }

  function appendSource({label, text}) {
    const detail = document.createElement('details');
    const title = document.createElement('summary');
    const body = document.createElement('pre');
    title.textContent = label;
    body.textContent = text || '읽을 수 있는 글자가 없어요.';
    detail.append(title, body);
    sourcePanel.querySelector('[data-ocr-pages]').append(detail);
    sourcePanel.hidden = false;
  }

  for (const service of draft) addRow(service);
  updateDraft();
  reset.hidden = !preview.length;
  form.querySelector('[data-worship-add]').onclick = () => {
    addRow().focus();
    updateDraft();
  };

  read.onclick = async () => {
    const selected = [...files.files];
    if (!selected.length) {
      messages.textContent = '먼저 주보 사진이나 PDF를 선택해 주세요.';
      files.focus();
      return;
    }
    read.disabled = files.disabled = apply.disabled = true;
    messages.textContent = '주보 읽기를 준비 중이에요.';
    sourcePanel.querySelector('[data-ocr-pages]').replaceChildren();
    sourcePanel.hidden = true;
    const active = () => form.isConnected;
    let added = 0;
    const unread = [];
    try {
      const {readBulletinFiles} = await import('./bulletin-ocr.mjs?v=1');
      await readBulletinFiles(selected, {
        active,
        onProgress: text => { messages.textContent = text; },
        onError: label => { unread.push(label); },
        onPage: page => {
          appendSource(page);
          const existing = new Set([...rows.children].map(row => serviceKey(rowValues(row))));
          for (const service of extractWorshipTimes(page.text)) {
            const key = serviceKey(service);
            if (existing.has(key)) continue;
            addRow(service);
            existing.add(key);
            added++;
          }
          updateDraft();
        },
      });
    } catch {
      unread.push('OCR 실행');
    } finally {
      if (active()) {
        read.disabled = files.disabled = false;
        updateDraft();
        messages.textContent = (added ? '예배 ' + added + '건을 초안에 추가했어요. 시간을 원본과 확인해 주세요.'
          : '새로 추가할 예배를 찾지 못했어요. 원문을 확인하거나 직접 추가할 수 있어요.') +
          (unread.length ? ' 읽지 못한 파일 또는 페이지 · ' + unread.join(', ') : '');
      }
    }
  };

  form.onsubmit = event => {
    event.preventDefault();
    if (apply.disabled) return;
    const services = draft.map(service => ({...service, name: service.name.trim()}));
    if (services.some(({name, day, time}) => !name || !worshipDays.includes(day) || !validWorshipTime(time))) {
      messages.textContent = '각 예배의 이름, 요일, 시간을 확인해 주세요.';
      return;
    }
    preview = services;
    saveServices(previewKey, preview);
    location.hash = 'worship';
  };

  reset.onclick = () => {
    preview = [];
    saveServices(previewKey, preview);
    reset.hidden = true;
    messages.textContent = '예배 안내가 예시 일정으로 돌아갔어요.';
  };
}

function fillCard(card, service) {
  const heading = card.querySelector('h2');
  heading.replaceChildren(heading.querySelector('.icon'), document.createTextNode(service.name));
  const time = card.querySelector('time');
  time.dateTime = service.time;
  time.textContent = formatWorshipTime(service.time);
  card.querySelector('.service-details').textContent = service.day;
}

export function renderWorshipPreview(app, page) {
  if (!preview.length) return;
  const primary = preview.find(service => service.day === '일요일') || preview[0];
  if (page === 'home') {
    app.querySelector('[data-worship-summary]').textContent = primary.name + ' · ' + formatWorshipTime(primary.time);
    return;
  }
  app.querySelector('.sample-label').textContent = '이 브라우저 미리보기';
  if (page === 'bulletin') {
    fillCard(app.querySelector('.service-card'), primary);
    return;
  }
  const originals = [...app.querySelectorAll('.service-card')];
  const cards = preview.map((service, index) => {
    const card = originals[service.day === '일요일' ? 0 : 1].cloneNode(true);
    const id = 'preview-service-' + index;
    card.querySelector('h2').id = id;
    card.setAttribute('aria-labelledby', id);
    fillCard(card, service);
    return card;
  });
  originals[0].replaceWith(...cards);
  originals[1].remove();
}
