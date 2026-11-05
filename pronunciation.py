"""Fetch dictionary recordings, recover Commons originals, and cache locally."""
import hashlib
import json
import re
import threading
from pathlib import Path
from urllib.parse import urlparse, parse_qs, quote
from urllib.request import Request, urlopen

CACHE = Path(__file__).resolve().parent / 'data' / 'audio'
_lock = threading.Lock()


def fetch(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in {'api.dictionaryapi.dev', 'commons.wikimedia.org', 'upload.wikimedia.org', 'ssl.gstatic.com'}:
        raise ValueError('不支持的音频来源')
    with urlopen(Request(url, headers={'User-Agent': 'WordJournal/1.0 (local vocabulary learning app)'}), timeout=6) as response:
        data = response.read(3_000_001)
        if len(data) > 3_000_000:
            raise ValueError('录音文件过大')
        return data, response.headers.get_content_type()


def recording(word):
    word = word.strip().lower()
    if not re.fullmatch(r"[a-z][a-z '\-’]{0,99}", word):
        raise ValueError('请输入英文单词或短语')
    key = hashlib.sha256(word.encode()).hexdigest()
    with _lock:
        CACHE.mkdir(parents=True, exist_ok=True)
        meta = CACHE / (key + '.json')
        if meta.exists():
            info = json.loads(meta.read_text())
            if (CACHE / (key + '.audio')).exists():
                return info
        entries = json.loads(fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + quote(word, safe=''))[0])
        clips = [p for e in entries for p in e.get('phonetics', []) if p.get('audio')]
        clips.sort(key=lambda p: '-us.' not in p['audio'])
        for clip in clips:
            candidates = []
            source = clip.get('sourceUrl', '')
            if urlparse(source).hostname == 'commons.wikimedia.org':
                try:
                    query = parse_qs(urlparse(source).query)
                    selector = ('pageids=' + quote(query['curid'][0], safe='')) if 'curid' in query else ('titles=' + quote(urlparse(source).path.removeprefix('/wiki/'), safe=''))
                    pages = json.loads(fetch('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&' + selector)[0])['query']['pages']
                    original = next(iter(pages.values()))['imageinfo'][0]['url'].split('?')[0]
                    if original.endswith('.ogg'):
                        candidates.append(original.replace('/commons/', '/commons/transcoded/', 1) + '/' + original.rsplit('/', 1)[1] + '.mp3')
                    candidates.append(original)
                except Exception:
                    pass
            candidates.append('https:' + clip['audio'] if clip['audio'].startswith('//') else clip['audio'])
            for url in candidates:
                try:
                    data, mime = fetch(url)
                    # Reject HTML/error bodies even when upstream claims success.
                    valid = data.startswith((b'ID3', b'OggS', b'RIFF')) or (len(data) > 2 and data[0] == 255 and data[1] & 224 == 224)
                    if not valid or mime not in {'audio/mpeg', 'audio/mp3', 'audio/ogg', 'application/ogg', 'audio/wav', 'audio/x-wav'}:
                        continue
                    info = {'audio': '/api/pronunciation/audio?word=' + quote(word, safe=''), 'sourceUrl': source, 'license': clip.get('license'), 'mime': mime}
                    (CACHE / (key + '.audio')).write_bytes(data)
                    meta.write_text(json.dumps(info, ensure_ascii=False))
                    return info
                except Exception:
                    continue
    raise ValueError('词典录音暂不可用')


def audio_file(word):
    info = recording(word)
    key = hashlib.sha256(word.strip().lower().encode()).hexdigest()
    return (CACHE / (key + '.audio')).read_bytes(), info['mime']
