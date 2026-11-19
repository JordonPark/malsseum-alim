const serviceName = /(?:주[ \t]*일|수[ \t]*요|금[ \t]*요|토[ \t]*요|새[ \t]*벽|청[ \t]*년|청소년|어린이|초등부|중고등부|유치부|저녁|찬양|온가족)[ \t]*(?:(?:\d+[ \t]*부|낮|오전|오후|저녁|대)[ \t]*)?(?:예[ \t]*배|기[ \t]*도[ \t]*회)|주[ \t]*일[ \t]*\d+[ \t]*부|새[ \t]*벽[ \t]*기[ \t]*도/gu;
const weekday = /([일월화수목금토])[ \t]*요[ \t]*일/u;
const clock = /(?<![\d:])(?:(오[ \t]*[전후]|[ap]\.?m\.?)[ \t]*)?(\d{1,2})[ \t]*(?:[:][ \t]*(\d{2})(?!\d)|시(?!간)[ \t]*(?:(\d{1,2})[ \t]*분|(?![ \t]*\d)))(?:[ \t]*(오[ \t]*[전후]|[ap]\.?m\.?)(?![ \t]*\d))?/giu;
const partialClock = /(?:오[ \t]*[전후]|[ap]\.?m\.?)\s*\d/iu;
const continuation = /^[\s|·•–-]*(?:(?:매주[ \t]*)?[일월화수목금토][ \t]*요[ \t]*일|매일|평일|오[ \t]*[전후]|[ap]\.?m\.?|[0-9]{1,2}[ \t]*[:시])/iu;
const otherBulletinContent = /성경[ \t]*(?:봉독|본문|구절)|설교[ \t]*(?:본문|제목|말씀)|본문|찬송(?:가)?|(?:복음|서신)[ \t]*\d/u;
const impliedDays = {주일: '일요일', 수요: '수요일', 금요: '금요일', 토요: '토요일'};

export const worshipDays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '평일', '매일'];

function readTime(match) {
  const [, prefix, hourText, colonMinutes, koreanMinutes, suffix] = match;
  const meridiem = (prefix || suffix || '').toLowerCase().replace(/[.\s]/g, '');
  let hour = Number(hourText);
  const minutes = Number(colonMinutes ?? koreanMinutes ?? 0);
  if (minutes > 59 || hour > 23) return '';
  if (meridiem) {
    if (hour < 1 || hour > 12) return '';
    hour = hour % 12 + (meridiem === '오후' || meridiem === 'pm' ? 12 : 0);
  } else if (!colonMinutes && hour >= 1 && hour <= 12) {
    return '';
  }
  return [hour, minutes].map(part => String(part).padStart(2, '0')).join(':');
}

function readDay(text, name) {
  const day = text.match(weekday);
  return day ? day[1] + '요일' : text.match(/매일|평일/u)?.[0] || impliedDays[name.slice(0, 2)] || '';
}

function collectCandidates(text, name, result) {
  const schedule = text.split(otherBulletinContent, 1)[0];
  if (!name && !weekday.test(schedule) && !/매일|평일/u.test(schedule)) return;
  const day = readDay(schedule, name);
  const excerpt = (name + ' ' + schedule).trim();
  const matches = [...schedule.matchAll(clock)];
  for (const match of matches) {
    result.push({name, day, time: readTime(match), excerpt});
  }
  if (!matches.length && partialClock.test(schedule)) result.push({name, day, time: '', excerpt});
}

export function extractWorshipTimes(text) {
  const lines = text.normalize('NFKC').split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  const result = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const names = [...line.matchAll(serviceName)];
    if (!names.length) {
      collectCandidates(line, '', result);
      continue;
    }
    for (let part = 0; part < names.length; part++) {
      const match = names[part];
      const name = match[0].replace(/[ \t]+/g, '');
      const nextName = names[part + 1];
      let schedule = line.slice(match.index + match[0].length, nextName?.index);
      if (!nextName && ![...schedule.matchAll(clock)].length) {
        for (let extra = 0; extra < 2; extra++) {
          const next = lines[index + 1];
          if (!next || !continuation.test(next) || [...next.matchAll(serviceName)].length) break;
          schedule += ' ' + next;
          index++;
          if ([...next.matchAll(clock)].length) break;
        }
      }
      collectCandidates(schedule, name, result);
    }
  }
  return result;
}

export function validWorshipTime(time) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(time);
}

export function formatWorshipTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  return (hour < 12 ? '오전 ' : '오후 ') + (hour % 12 || 12) + '시' + (minute ? ' ' + minute + '분' : '');
}
