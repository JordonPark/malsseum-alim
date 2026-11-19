#!/usr/bin/env python3
"""공개 성경 JSON으로 개발용 SQLite 성경 DB를 만든다.

원본: https://github.com/thiagobodruk/bible (json/ko_krv.json, json/en_kjv.json)
출시 판본은 개역개정(대한성서공회 허가 필요)이며, 이 DB는 개발용 임시 데이터다.

사용법:
    python3 scripts/build_bible_db.py            # 원본을 내려받아 data/bible.sqlite 생성
    python3 scripts/build_bible_db.py --src DIR  # 이미 받은 JSON이 있는 폴더 사용
"""
import argparse
import json
import os
import sqlite3
import urllib.request

BASE = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/"
TRANSLATIONS = {
    "ko_krv": ("개역한글", "ko"),
    "en_kjv": ("King James Version", "en"),
}
SCHEMA = """
CREATE TABLE translations(id TEXT PRIMARY KEY, name TEXT, language TEXT);
CREATE TABLE books(translation TEXT, book INTEGER, abbrev TEXT, name TEXT, testament TEXT,
                   PRIMARY KEY(translation, book));
CREATE TABLE verses(translation TEXT, book INTEGER, chapter INTEGER, verse INTEGER, text TEXT,
                    PRIMARY KEY(translation, book, chapter, verse));
CREATE VIRTUAL TABLE verses_fts USING fts5(text, content='verses', content_rowid='rowid',
                                           tokenize='trigram');
"""


def load(tid, src):
    if src:
        path = os.path.join(src, f"{tid}.json")
        with open(path, encoding="utf-8-sig") as f:
            return json.load(f)
    with urllib.request.urlopen(BASE + f"{tid}.json", timeout=60) as r:
        return json.loads(r.read().decode("utf-8-sig"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="ko_krv.json, en_kjv.json이 있는 폴더 (없으면 내려받음)")
    ap.add_argument("--out", default="data/bible.sqlite")
    args = ap.parse_args()

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    if os.path.exists(args.out):
        os.remove(args.out)
    db = sqlite3.connect(args.out)
    db.executescript(SCHEMA)
    for tid, (name, lang) in TRANSLATIONS.items():
        books = load(tid, args.src)
        db.execute("INSERT INTO translations VALUES(?,?,?)", (tid, name, lang))
        for i, bk in enumerate(books, 1):
            db.execute("INSERT INTO books VALUES(?,?,?,?,?)",
                       (tid, i, bk["abbrev"], bk["name"], "OT" if i <= 39 else "NT"))
            db.executemany(
                "INSERT INTO verses VALUES(?,?,?,?,?)",
                [(tid, i, c, v, t.strip())
                 for c, ch in enumerate(bk["chapters"], 1)
                 for v, t in enumerate(ch, 1)])
    db.execute("INSERT INTO verses_fts(verses_fts) VALUES('rebuild')")
    db.commit()
    for tid, n in db.execute("SELECT translation, count(*) FROM verses GROUP BY 1"):
        print(f"{tid}: {n}절")
    db.execute("VACUUM")
    db.close()
    print(f"완료: {args.out} ({os.path.getsize(args.out) // 1024} KB)")


if __name__ == "__main__":
    main()
