import csv, io, json, os, re, sqlite3, argparse
from pathlib import Path
from datetime import date
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('WORD_JOURNAL_DB', ROOT / 'data/journal.sqlite3'))
# A combined marker may share its final period: v&n., adj&adv., n/v/adj.
POS_ATOM = r'(?:v\.t|v\.i|vt|vi|adj|adv|prep|pron|conj|interj|aux|num|art|det|modal|phr|n|v|a)'
POS = (r'(?<![A-Za-z])(?:' + POS_ATOM + r'\.?\s*[&＆/]\s*'
       + r'(?:' + POS_ATOM + r'\.?\s*[&＆/]\s*)*' + POS_ATOM + r'\.|' + POS_ATOM + r'\.)')
def connect():
    c = sqlite3.connect(DB, timeout=30); c.row_factory = sqlite3.Row; return c
def init():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS dictionary(word TEXT PRIMARY KEY COLLATE NOCASE, meaning TEXT, pos TEXT, phonetic TEXT);
        CREATE TABLE IF NOT EXISTS words(word TEXT PRIMARY KEY COLLATE NOCASE, meaning TEXT NOT NULL, pos TEXT, first_date TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS entries(word TEXT COLLATE NOCASE, day TEXT, PRIMARY KEY(word,day));
        CREATE TABLE IF NOT EXISTS reviews(word TEXT COLLATE NOCASE, day TEXT, direction TEXT, result TEXT, PRIMARY KEY(word,day,direction));''')
def import_dictionary(path):
    with connect() as c, open(path, encoding='utf-8-sig', newline='') as f:
        batch=[]; count=0
        for r in csv.DictReader(f):
            meaning=r.get('translation','').replace('\\n','\n').strip()
            if not meaning: continue
            pos='/'.join(dict.fromkeys(re.findall(POS,meaning))) or '/'.join(re.findall(r'([a-z]+):',r.get('pos','')))
            batch.append((r['word'].strip().lower(), meaning, pos, r.get('phonetic','')))
            if len(batch)>=10000:
                c.executemany('INSERT OR REPLACE INTO dictionary VALUES(?,?,?,?)',batch); count+=len(batch); batch=[]
        c.executemany('INSERT OR REPLACE INTO dictionary VALUES(?,?,?,?)',batch)
        print(f'Dictionary ready: {count+len(batch):,} entries',flush=True)
def valid_day(s):
    date.fromisoformat(s)
    if s > date.today().isoformat(): raise ValueError('不能记录未来日期')
    return s
def parse(text):
    rows=[]
    with connect() as c:
        for i,line in enumerate(text.splitlines(),1):
            line=line.strip().lstrip('\ufeff')
            if not line: continue
            row={'line':i,'raw':line,'word':'','meaning':'','pos':'','source':'手动输入','error':''}
            # CSV and tab exports, plus plain English + whitespace + part of speech/Chinese.
            fields=next(csv.reader([line], delimiter='\t' if '\t' in line else ','))
            if len(fields)>1 and re.fullmatch(r"[A-Za-z][A-Za-z '\-’]*",fields[0].strip()) and not re.search(r'[\u3400-\u9fff]',fields[0]):
                word=fields[0].strip(); rest='，'.join(fields[1:]).strip()
            else:
                m=re.match(r"^([A-Za-z][A-Za-z '\-’]*?)(?:\s+((?:"+POS+r'|[\u3400-\u9fff]).*))?$',line,re.I)
                if not m:
                    row['error']='格式无法识别，请使用：seek v.查找，寻找（英文后留空格）'; rows.append(row); continue
                word=m[1].strip(); rest=(m[2] or '').strip()
            row['word']=word.lower()
            if rest:
                row['pos']='/'.join(dict.fromkeys(re.findall(POS,rest,re.I)))
                row['meaning']=re.sub('^'+POS+r'\s*','',rest,flags=re.I).strip()
                if not re.search(r'[\u3400-\u9fff]',rest): row['error']='请提供中文释义，或只输入英文让本地词库补全'
            else:
                d=c.execute('SELECT * FROM dictionary WHERE word=?',(word,)).fetchone()
                if d: row.update(meaning=d['meaning'],pos=d['pos'],source='ECDICT 本地词库')
                else: row['error']='本地词库未找到，请补充中文释义'
            rows.append(row)
    return rows

def state(day):
    with connect() as c:
        words=[dict(r) for r in c.execute('''SELECT w.*, (SELECT count(DISTINCT day) FROM reviews WHERE word=w.word) study_days,
          (SELECT max(day) FROM reviews WHERE word=w.word) last_studied,
          (SELECT count(*) FROM entries WHERE word=w.word) recorded_days,
          EXISTS(SELECT 1 FROM entries WHERE word=w.word AND day=?) in_today
          FROM words w ORDER BY first_date DESC, word''',(day,))]
        for w in words:
            w['age_days']=(date.fromisoformat(day)-date.fromisoformat(w['first_date'])).days
        return {'words':words,'dates':[dict(r) for r in c.execute('SELECT day,count(*) count FROM entries GROUP BY day ORDER BY day DESC')],
                'entries':[r[0] for r in c.execute('SELECT word FROM entries WHERE day=? ORDER BY rowid',(day,))],
                'reviews':[dict(r) for r in c.execute('SELECT * FROM reviews WHERE day=?',(day,))],
                'dictionary_count':c.execute('SELECT count(*) FROM dictionary').fetchone()[0]}
class Handler(BaseHTTPRequestHandler):
    def send_json(self,obj,status=200):
        data=json.dumps(obj,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        u=urlparse(self.path); q=parse_qs(u.query)
        try:
            if u.path=='/api/state': return self.send_json(state(valid_day(q.get('today',[date.today().isoformat()])[0])))
            if u.path=='/api/search':
                term=q.get('q',[''])[0].strip()
                if not term: return self.send_json([])
                with connect() as c: rows=[dict(r) for r in c.execute('SELECT * FROM dictionary WHERE word=? OR word LIKE ? ORDER BY word=? DESC, length(word), word LIMIT 30',(term,term.replace('%','\\%').replace('_','\\_')+'%',term))]
                return self.send_json(rows)
            if u.path=='/api/export':
                with connect() as c: return self.send_json({'version':1,**{t:[dict(r) for r in c.execute('SELECT * FROM '+t)] for t in ('words','entries','reviews')}})
            paths={**{route:'index.html' for route in ('/','/daily','/review','/vocabulary','/import','/practice','/practice/session')},'/app.js':'app.js','/practice-engine.js':'practice-engine.js','/learning-flow.js':'learning-flow.js','/daily-browser.js':'daily-browser.js','/style.css':'style.css'}
            if u.path not in paths: return self.send_json({'error':'页面不存在'},404)
            p=ROOT/'static'/paths[u.path]; self.send_response(200); self.send_header('Content-Type',{'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'}[p.suffix[1:]]); self.end_headers(); self.wfile.write(p.read_bytes())
        except (ValueError,KeyError) as e: self.send_json({'error':str(e)},400)
    def do_POST(self):
        try:
            if self.headers.get('Origin') and self.headers['Origin'] != 'http://'+self.headers.get('Host',''): raise ValueError('来源不匹配')
            n=int(self.headers.get('Content-Length',0))
            if n>5_000_000: raise ValueError('文件过大，请分批导入（5MB 以内）')
            body=json.loads(self.rfile.read(n)); path=urlparse(self.path).path
            if path=='/api/preview': return self.send_json(parse(body['text']))
            if path=='/api/import':
                day=valid_day(body['day']); rows=parse(body['text']); good=[r for r in rows if not r['error']]
                if not good: raise ValueError('没有可导入的词汇')
                with connect() as c:
                    for r in good:
                        c.execute('INSERT INTO words VALUES(?,?,?,?) ON CONFLICT(word) DO UPDATE SET first_date=min(first_date,excluded.first_date)',(r['word'],r['meaning'],r['pos'],day))
                        c.execute('INSERT OR IGNORE INTO entries VALUES(?,?)',(r['word'],day))
                return self.send_json({'count':len(set(r['word'] for r in good)),'skipped':len(rows)-len(good)})
            if path=='/api/review':
                day=valid_day(body['day']); word=body['word']; direction=body['direction']; result=body['result']
                if direction not in ('zh','en','none','dictation_en','dictation_zh','listening') or result not in ('known','again'): raise ValueError('无效学习记录')
                with connect() as c:
                    if not c.execute('SELECT 1 FROM words WHERE word=?',(word,)).fetchone(): raise ValueError('词汇未记录')
                    c.execute('INSERT OR REPLACE INTO reviews VALUES(?,?,?,?)',(word,day,direction,result))
                return self.send_json({'ok':True})
            if path=='/api/restore':
                data=body['data']
                if data.get('version')!=1: raise ValueError('不支持的备份格式')
                with connect() as c:
                    for r in data['words']:
                        valid_day(r['first_date'])
                        if not isinstance(r['word'],str) or not r['word'] or not isinstance(r['meaning'],str): raise ValueError('备份词汇无效')
                        c.execute('INSERT OR IGNORE INTO words VALUES(?,?,?,?)',(r['word'],r['meaning'],r.get('pos',''),r['first_date']))
                    for r in data['entries']:
                        valid_day(r['day']); c.execute('INSERT OR IGNORE INTO entries VALUES(?,?)',(r['word'],r['day']))
                    for r in data['reviews']:
                        valid_day(r['day']); c.execute('INSERT OR IGNORE INTO reviews VALUES(?,?,?,?)',(r['word'],r['day'],r['direction'],r['result']))
                return self.send_json({'ok':True})
            self.send_json({'error':'接口不存在'},404)
        except (ValueError,KeyError,TypeError,sqlite3.Error) as e: self.send_json({'error':str(e)},400)
if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--port',type=int,default=8765); p.add_argument('--dictionary'); a=p.parse_args(); init()
    if a.dictionary: import_dictionary(a.dictionary)
    else:
        print(f'Word Journal: http://127.0.0.1:{a.port}',flush=True); ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
