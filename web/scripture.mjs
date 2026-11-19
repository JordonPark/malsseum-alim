const books = {
  gen: ['창세기', '창', 50], exo: ['출애굽기', '출', 40], lev: ['레위기', '레', 27], num: ['민수기', '민', 36], deu: ['신명기', '신', 34],
  jos: ['여호수아', '수', 24], jdg: ['사사기', '삿', 21], rut: ['룻기', '룻', 4], '1sa': ['사무엘상', '삼상', 31], '2sa': ['사무엘하', '삼하', 24],
  '1ki': ['열왕기상', '왕상', 22], '2ki': ['열왕기하', '왕하', 25], '1ch': ['역대상', '대상', 29], '2ch': ['역대하', '대하', 36],
  ezr: ['에스라', '스', 10], neh: ['느헤미야', '느', 13], est: ['에스더', '에', 10], job: ['욥기', '욥', 42], psa: ['시편', '시', 150],
  pro: ['잠언', '잠', 31], ecc: ['전도서', '전', 12], sng: ['아가', '아', 8], isa: ['이사야', '사', 66], jer: ['예레미야', '렘', 52],
  lam: ['예레미야애가', '애', 5], ezk: ['에스겔', '겔', 48], dan: ['다니엘', '단', 12], hos: ['호세아', '호', 14], jol: ['요엘', '욜', 3],
  amo: ['아모스', '암', 9], oba: ['오바댜', '옵', 1], jnh: ['요나', '욘', 4], mic: ['미가', '미', 7], nam: ['나훔', '나', 3],
  hab: ['하박국', '합', 3], zep: ['스바냐', '습', 3], hag: ['학개', '학', 2], zec: ['스가랴', '슥', 14], mal: ['말라기', '말', 4],
  mat: ['마태복음', '마', 28], mrk: ['마가복음', '막', 16], luk: ['누가복음', '눅', 24], jhn: ['요한복음', '요', 21], act: ['사도행전', '행', 28],
  rom: ['로마서', '롬', 16], '1co': ['고린도전서', '고전', 16], '2co': ['고린도후서', '고후', 13], gal: ['갈라디아서', '갈', 6],
  eph: ['에베소서', '엡', 6], php: ['빌립보서', '빌', 4], col: ['골로새서', '골', 4], '1th': ['데살로니가전서', '살전', 5],
  '2th': ['데살로니가후서', '살후', 3], '1ti': ['디모데전서', '딤전', 6], '2ti': ['디모데후서', '딤후', 4],
  tit: ['디도서', '딛', 3], phm: ['빌레몬서', '몬', 1], heb: ['히브리서', '히', 13], jas: ['야고보서', '약', 5],
  '1pe': ['베드로전서', '벧전', 5], '2pe': ['베드로후서', '벧후', 3], '1jn': ['요한일서', '요일', 5], '2jn': ['요한이서', '요이', 1],
  '3jn': ['요한삼서', '요삼', 1], jud: ['유다서', '유', 1], rev: ['요한계시록', '계', 22],
};

const names = new Map(Object.entries(books).flatMap(([book, [title, alias]]) => [[title, book], [alias, book]]));
const bookName = [...names.keys()].sort((first, second) => second.length - first.length).join('|');
const referencePattern = new RegExp(
  String.raw`(?<![가-힣])(?:${bookName})[ \t]*[1-9]\d{0,2}[ \t]*(?::|장|편)[ \t]*[1-9]\d{0,2}(?:[ \t]*절)?(?:[ \t]*[-–~∼][ \t]*[1-9]\d{0,2}(?:[ \t]*절)?)?(?![\d:])`,
  'gu',
);
const referenceParts = new RegExp(
  String.raw`^(${bookName})[ \t]*([1-9]\d{0,2})[ \t]*(?::|장|편)[ \t]*([1-9]\d{0,2})(?:[ \t]*절)?(?:[ \t]*[-–~∼][ \t]*([1-9]\d{0,2})(?:[ \t]*절)?)?$`,
  'u',
);

// Korean Revised Version (1961), Korean Bible Society, John 14:27.
// https://www.bskorea.or.kr/bible/korbibReadpage.php?version=HAN&book=jhn&chap=14&sec=27
export const samplePassage = {
  book: 'jhn', chapter: 14, first: 27, last: 27,
  text: '평안을 너희에게 끼치노니 곧 나의 평안을 너희에게 주노라 내가 너희에게 주는 것은 세상이 주는 것 같지 아니하니라 너희는 마음에 근심도 말고 두려워하지도 말라',
};

export function readReference(book, chapter, first, last = first) {
  if (!Object.hasOwn(books, book)) return null;
  if (![chapter, first, last].every(value => /^[1-9]\d{0,2}$/u.test(value))) return null;
  chapter = Number(chapter);
  first = Number(first);
  last = Number(last);
  if (chapter > books[book][2] || first > last || last > 176) return null;
  return {book, chapter, first, last};
}

export function parseReference(value) {
  const match = value.normalize('NFKC').trim().match(referenceParts);
  if (!match) return null;
  const [, name, chapter, first, last] = match;
  return readReference(names.get(name), chapter, first, last);
}

export function findReferences(line) {
  return [...line.normalize('NFKC').matchAll(referencePattern)]
    .map(match => parseReference(match[0])).filter(Boolean);
}

export function formatReference({book, chapter, first, last}) {
  const chapterUnit = book === 'psa' ? '편' : '장';
  return books[book][0] + ' ' + chapter + chapterUnit + ' ' + (first === last ? first : first + '–' + last) + '절';
}

export function readerHref({book, chapter, first, last}, from = 'devotion') {
  return ['#read', book, chapter, first, last, from].join('/');
}

export function passageText(reference) {
  return ['book', 'chapter', 'first', 'last'].every(key => samplePassage[key] === reference[key])
    ? samplePassage.text : '';
}

export function officialPassage({book, chapter, first}) {
  const url = new URL('https://www.bskorea.or.kr/bible/korbibReadpage.php');
  url.search = new URLSearchParams({version: 'GAE', book, chap: chapter, sec: first, fontSize: '18px'});
  return url.href;
}
