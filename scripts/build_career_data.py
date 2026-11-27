"""Build the portfolio's licensed, traceable subsets. Requires curl, Pillow and ffmpeg."""
import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'downloads' / 'career-data'
MEDIA = DEST / 'media'
CMA = 'https://openaccess-api.clevelandart.org/api/artworks/'
DIFFUSION = 'https://huggingface.co/datasets/poloclub/diffusiondb/resolve/refs%2Fheads%2Fmain/images/part-000001.zip'
ULTRA = 'https://huggingface.co/datasets/openbmb/UltraFeedback'
COMMUNITY = 'https://huggingface.co/datasets/facebook/community-alignment-dataset'
ULTRA_REVISION = '40b436560ca83a8dba36114c22ab3c66e43f6d5e'
VIDEO_SOURCES = [
    ('bunny', 'Big Buck Bunny', 'https://media.w3.org/2010/05/bunny/trailer.mp4', 'https://peach.blender.org/about/', [(3, 6), (9, 12), (13, 16), (23, 25)]),
    ('sintel', 'Sintel', 'https://media.w3.org/2010/05/sintel/trailer.mp4', 'https://studio.blender.org/projects/sintel/', [(7, 11), (16, 20), (26, 30), (38, 42)]),
]
MUSEUM_QUERIES = [('书法与文字','calligraphy'), ('山水','landscape'), ('肖像','portrait'), ('器物','ceramic'), ('建筑与空间','architecture'), ('多主体场景','figures'), ('摄影','photograph'), ('插画与版画','woodblock')]
GENERATED_TOPICS = [('商品与静物', r'product|perfume|bottle|teapot|still life|coffee'), ('建筑与空间', r'architecture|interior|building|cabin|castle'), ('生成肖像', r'portrait|face of'), ('生成风景', r'landscape|mountain|forest|island|lake'), ('插画与动物', r'owl|fox|cat |bird|robot|illustration')]
TEXT_TOPICS = [('摘要',r'summar(?:ize|ise|y)|main idea'), ('提取与格式',r'extract|classify|format|list of|json'), ('基础数学',r'percent|calculate|triangle|equation|average|probab'), ('经济商业',r'econom|market|business|customers?|inflation|supply|revenue'), ('写作与表达',r'write a|creative|compose|poem|grammar|translate'), ('文化艺术',r'literature|paint|history|artwork|music|shakespeare|culture'), ('一般问答',r'explain|what is|how does|why |difference|compare')]
EXCLUDE = re.compile(r'\b(?:nude|nudity|nsfw|blood|gore|naked|sexual|porn|erotic|fetish|sex|sexy|rape|weapon|glock|bioweapon|bomb|explosive|suicide|self.harm|malware|ransomware|phishing|exploit|bypass|poison|riot|terror|cocaine|methamphetamine|heroin|kill|murder|violent|jailbreak|password|steal|hack|dox)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}', re.I)


def curl(url, *args):
    return subprocess.run(['curl.exe', '-fsSL', '--retry', '1', '--max-time', '28', *args, url], capture_output=True, check=True).stdout


def download(url, cache):
    key = hashlib.sha256(url.encode()).hexdigest()
    file = cache / key
    if not file.exists():
        file.write_bytes(curl(url))
    return file.read_bytes()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def save_image(content, name):
    file = MEDIA / f'{name}.webp'
    with Image.open(io.BytesIO(content)) as image:
        image = image.convert('RGB')
        image.thumbnail((960, 750))
        image.save(file, 'WEBP', quality=86)
    return asset(file)


def asset(file):
    return {'media': f'downloads/career-data/media/{file.name}', 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}


def museum_rows(cache):
    selected = set()
    planned = []
    for category, query in MUSEUM_QUERIES:
        url = CMA + '?' + urlencode({'q': query, 'cc0': '1', 'has_image': '1', 'limit': '36'})
        rows = json.loads(download(url, cache))['data']
        accepted = 0
        for row in rows:
            if not row.get('images') or not row['images'].get('web') or row.get('share_license_status') != 'CC0' or row['id'] in selected or EXCLUDE.search(row['title']):
                continue
            selected.add(row['id'])
            planned.append((category, row))
            accepted += 1
            if accepted == 20:
                break

    def fetch(item):
        category, row = item
        key = f'CMA-{row["id"]}'
        link = row['images']['web']['url']
        try:
            media = save_image(download(link, cache), key)
        except (subprocess.CalledProcessError, OSError):
            print(f'Image unavailable: {key}', flush=True)
            return None
        return {'sample_id': key, 'title': row['title'], 'source': 'Cleveland Museum of Art', 'source_url': row['url'], 'asset_url': link,
                'license': 'CC0-1.0', 'attribution': '; '.join(r['description'] for r in row['creators'] if r.get('description')) or 'Cleveland Museum of Art',
                'category': category, 'modality': 'image', 'media_kind': 'museum', 'source_type': row['type'], 'catalog_date': row['creation_date'], **media}
    with ThreadPoolExecutor(max_workers=4) as pool:
        return [row for row in pool.map(fetch, planned) if row]


class RemoteZip:
    """Read only selected entries from a public ZIP supporting byte ranges."""
    def __init__(self, url, size, cache):
        self.url, self.size, self.cache, self.pos = url, size, cache, 0

    def seek(self, offset, whence=0):
        self.pos = (0, self.pos, self.size)[whence] + offset
        return self.pos

    def tell(self):
        return self.pos

    def seekable(self):
        return True

    def read(self, length=-1):
        end = self.size if length < 0 else min(self.pos + length, self.size)
        start = self.pos
        if end <= start:
            return b''
        file = self.cache / f'diffusion-{start}-{end}'
        if not file.exists():
            result = curl(self.url, '-r', f'{start}-{end-1}', '--max-filesize', str(end-start+64))
            if len(result) != end-start:
                raise OSError(f'Unexpected range {start}:{end}: {len(result)}')
            file.write_bytes(result)
        self.pos = end
        return file.read_bytes()


def diffusion_rows(cache):
    url = DIFFUSION.replace('refs%2Fheads%2Fmain', 'main')
    with zipfile.ZipFile(RemoteZip(url, 632762470, cache)) as archive:
        entries = {Path(n).name: n for n in archive.namelist()}
        meta = json.loads(archive.read(entries['part-000001.json']))
    selected = []
    used = set()
    for category, pattern in GENERATED_TOPICS:
        by_prompt = {}
        for name, row in meta.items():
            prompt = row.get('p', '').strip()
            if name in entries and 14 < len(prompt) < 160 and re.search(pattern, prompt, re.I) and not EXCLUDE.search(prompt) and not re.search(r'\b(?:twin towers|haribo|trending|artstation|by [A-Z]|celebrity|gigantic|sexy|woman|girl|man|boy|human)\b', prompt, re.I):
                by_prompt.setdefault(prompt.casefold(), []).append((name, row, prompt))
        options = sorted(by_prompt.values(), key=lambda g: (len(g)<2, len(g[0][2])))
        for group in options[:4]:
            if group[0][2].casefold() in used:
                continue
            used.add(group[0][2].casefold())
            selected.extend((category, name, meta_row, prompt) for name, meta_row, prompt in group[:2])

    def fetch(item):
        category, name, meta_row, prompt = item
        try:
            with zipfile.ZipFile(RemoteZip(url, 632762470, cache)) as archive:
                data = archive.read(entries[name])
            media = save_image(data, f'DB-{Path(name).stem}')
        except (subprocess.CalledProcessError, OSError, zipfile.BadZipFile):
            return None
        return {'sample_id': f'DB-{Path(name).stem}', 'title': prompt, 'source': 'Polo Club of Data Science · DiffusionDB',
                'source_url': 'https://huggingface.co/datasets/poloclub/diffusiondb/tree/main/images', 'asset_url': url, 'source_id': name,
                'license': 'CC0-1.0（发布方数据许可）', 'attribution': 'DiffusionDB · Stable Diffusion', 'category': category,
                'modality': 'image', 'media_kind': 'generated', 'prompt': prompt, 'generation': {k: meta_row.get(k) for k in ('se','c','st','sa')}, **media}
    with ThreadPoolExecutor(max_workers=3) as pool:
        return [row for row in pool.map(fetch, selected) if row]


def videos(ffmpeg, cache):
    rows = []
    for prefix, title, media_url, source_url, intervals in VIDEO_SOURCES:
        source = cache / f'{prefix}.mp4'
        if not source.exists():
            source.write_bytes(download(media_url, cache))
        for index, (start, end) in enumerate(intervals, 1):
            key = f'VID-{prefix}-{index}'
            file = MEDIA / f'{key}.mp4'
            subprocess.run([ffmpeg, '-nostdin','-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(source),
                            '-t',str(end-start),'-vf','scale=640:-2','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',str(file)], check=True)
            poster = MEDIA / f'{key}.jpg'
            subprocess.run([ffmpeg, '-nostdin','-loglevel','error','-y','-ss','1','-i',str(file),'-frames:v','1',str(poster)], check=True)
            rows.append({'sample_id': key,'title': f'{title} · {start}–{end}s','source': title + ' · Trailer','source_url': source_url, 'asset_url': media_url,
                         'license': 'CC-BY-3.0' if prefix == 'bunny' else 'CC-BY（Blender 开放电影）', 'attribution': '© Blender Foundation',
                         'category': '动画片段','modality':'video','media_kind':'animation','interval_seconds':[start,end],
                         'changes':'截取、缩放、去音轨', 'poster':asset(poster)['media'], **asset(file)})
    return rows


def text_rows(cache):
    candidates = []
    seen = set()
    for offset in [0, 100, 200, 300, 400, 500, 600]:
        params = urlencode({'dataset':'openbmb/UltraFeedback','config':'default','split':'train','offset':offset,'length':100})
        rows = json.loads(download('https://datasets-server.huggingface.co/rows?' + params, cache))['rows']
        for entry in rows:
            row = entry['row']
            prompt = row['instruction'].strip()
            if not 18 <= len(prompt) <= 1350 or EXCLUDE.search(prompt) or prompt.casefold() in seen or re.search(r'\d{3}[- ]\d{3}[- ]\d{4}|https?://', prompt):
                continue
            matches = [group for group, pattern in TEXT_TOPICS if re.search(pattern, prompt, re.I)]
            if not matches:
                continue
            usable = [c for c in row['completions'] if 24 <= len(c['response'].strip()) <= 2200 and not EXCLUDE.search(c['response']) and not re.search(r'\d{3}[- ]\d{3}[- ]\d{4}', c['response'])]
            if len(usable) < 2:
                continue
            usable.sort(key=lambda c: c.get('overall_score') or 0)
            a, b = usable[0], usable[-1]
            if a['response'].strip() == b['response'].strip() or a['model'] == b['model']:
                continue
            if entry['row_idx'] % 2:
                a, b = b, a
            seen.add(prompt.casefold())
            category = '多轮与上下文' if re.search(r'\b(?:user:|assistant:|previous message|previous answer|dialogue)\b', prompt, re.I) else matches[0]
            candidates.append({'sample_id': f'UF-{entry["row_idx"]:05}', 'title': prompt.split('\n')[0][:125], 'source': 'OpenBMB UltraFeedback', 'source_url': ULTRA,
                'source_revision':ULTRA_REVISION,
                'source_row':entry['row_idx'], 'source_split':'train', 'source_subset':row['source'], 'license':'MIT（发布方数据许可）',
                'category':category, 'modality':'text','prompt':prompt, 'public_reference':[s for s in row.get('correct_answers') or [] if s and s != 'None' and not EXCLUDE.search(s)],
                'public_incorrect_reference':[s for s in row.get('incorrect_answers') or [] if s and s != 'None' and not EXCLUDE.search(s)],
                'answers':[{'model':c['model'],'text':c['response'],'source_score':c.get('overall_score')} for c in (a,b)]})
    selected = []
    for category in [t[0] for t in TEXT_TOPICS] + ['多轮与上下文']:
        selected += [row for row in candidates if row['category'] == category][:20]
    return selected + community_rows(cache)


def community_rows(cache):
    params = urlencode({'dataset':'facebook/community-alignment-dataset','config':'default','split':'train','offset':0,'length':100})
    rows = json.loads(download('https://datasets-server.huggingface.co/rows?' + params, cache))['rows']
    selected = []
    for item in rows:
        index = item['row_idx']
        if index not in (17, 20, 56, 64, 79, 86, 87):
            continue
        record = item['row']
        if record['assigned_lang'] != 'en' or not record['is_pregenerated_first_prompt']:
            continue
        preferred = record['second_turn_preferred_response']
        previous = record.get('first_turn_' + record['first_turn_preferred_response'])
        if not previous or preferred not in ('response_a','response_b','response_c','response_d'):
            continue
        alternatives = [k for k in ('response_a','response_b','response_c','response_d') if k != preferred and record.get('second_turn_' + k)]
        if not alternatives:
            continue
        selected_ids = [preferred, alternatives[0]] if index % 2 else [alternatives[0], preferred]
        prompt = f'User: {record["first_turn_prompt"]}\n\nAssistant: {previous}\n\nUser: {record["second_turn_prompt"]}'
        answers = [record['second_turn_' + key] for key in selected_ids]
        if not all(24 <= len(x) <= 2400 and not EXCLUDE.search(x) for x in [prompt,*answers]) or answers[0] == answers[1]:
            continue
        selected.append({'sample_id':f'CA-{index:05}','title':record['second_turn_prompt'][:125], 'source':'Meta Community Alignment',
            'source_url':COMMUNITY, 'source_row':index, 'source_split':'train', 'source_subset':'turn 2',
            'license':'CC-BY-4.0', 'attribution':'Meta · Zhang et al. · selected turns and response pairs', 'category':'多轮与上下文',
            'modality':'text', 'prompt':prompt, 'source_human_preference':'AB'[selected_ids.index(preferred)],
            'answers':[{'model':'发布方此字段未给出模型名','text':answer,'source_slot':key} for key,answer in zip(selected_ids,answers)]})
    return selected


def unique(rows, key):
    return list({r[key]:r for r in rows}.values())


def export(name, rows):
    write_json(DEST / f'{name}.json', rows)
    fields = list(dict.fromkeys(key for row in rows for key in row))
    with (DEST / f'{name}.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            flattened = {k: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v for k,v in row.items()}
            writer.writerow({k: "'"+v if isinstance(v,str) and re.match(r'^\s*[=+@\-]', v) else v for k,v in flattened.items()})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', required=True, type=Path)
    parser.add_argument('--ffmpeg', required=True)
    parser.add_argument('--group', choices=('visual','text','all'), default='all')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    MEDIA.mkdir(parents=True, exist_ok=True)
    if args.group in ('visual','all'):
        museum = unique(museum_rows(args.cache), 'sha256')
        video = videos(args.ffmpeg, args.cache)
        try:
            generated = unique(diffusion_rows(args.cache), 'sha256')
        except (subprocess.CalledProcessError, OSError, zipfile.BadZipFile) as err:
            print(f'DiffusionDB range retrieval unavailable: {err}', flush=True)
            generated = []
        print(f'museum={len(museum)} generated={len(generated)} video={len(video)}', flush=True)
        export('aesthetic', generated + [r for i,r in enumerate(museum) if i%2 == 0] + video)
        export('caption', video + museum + generated)
    if args.group in ('text','all'):
        texts = text_rows(args.cache)
        print(f'modelbench={len(texts)}', flush=True)
        export('modelbench', texts)


if __name__ == '__main__':
    main()
