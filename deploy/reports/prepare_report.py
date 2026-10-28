"""Package an HTML report and referenced local assets for isolated static hosting."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
from urllib.parse import unquote, urlsplit

PUBLIC_BASE = 'https://www.nlearn.net/robot-media/reports/'
ALLOWED = {'.mp4', '.json', '.jsonl', '.csv', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.css', '.js', '.woff', '.woff2'}
RELAY = '''<script id="blog-report-relay">
(() => {
  const send = () => {
    const body = document.body;
    const style = getComputedStyle(body);
    const height = Math.ceil(body.getBoundingClientRect().height + parseFloat(style.marginTop || 0) + parseFloat(style.marginBottom || 0));
    parent.postMessage({type: 'robot-report-size', height}, '*');
  };
  document.body.style.minHeight = '0';
  new ResizeObserver(send).observe(document.body);
  addEventListener('load', send);
  addEventListener('resize', send);
  document.addEventListener('toggle', send, true);
  send();
})();
</script>'''


class ReportParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.title = ''
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'base' or (tag == 'meta' and values.get('http-equiv', '').lower() == 'refresh'):
            raise ValueError('Report redirects and base URL overrides are unsupported')
        self.in_title = self.in_title or tag == 'title'
        for key, value in attrs:
            if key not in ('src', 'href', 'poster') or not value:
                continue
            parts = urlsplit(value)
            if parts.scheme == 'data' and key in ('src', 'poster') and value.startswith('data:image/'):
                continue
            if parts.scheme or parts.netloc:
                if tag == 'a' and parts.scheme in ('http', 'https'):
                    continue
                raise ValueError('External report resources are unsupported')
            if parts.path:
                self.refs.append(unquote(parts.path))

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def check_text(data):
    """Refuse likely credentials without printing their values."""
    patterns = [r'\b(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{20,}',
                r'(?i)authorization["\s:]+bearer\s+[A-Za-z0-9._-]{16,}',
                r'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----']
    if any(re.search(pattern, data) for pattern in patterns):
        raise ValueError('Potential credential found; review the report before publishing')


def prepare_report(source, destination):
    source, destination = Path(source), Path(destination)
    if source.is_symlink() or not source.is_dir():
        raise ValueError('Expected a real report directory')
    source = source.resolve()
    index = source / 'index.html'
    if index.is_symlink() or index.stat().st_size > 25 * 1024 ** 2:
        raise ValueError('Unsafe or oversized report HTML')
    html = index.read_text(encoding='utf8')
    parser = ReportParser()
    parser.feed(html)
    if not parser.title.strip() or not re.search(r'</body\s*>', html, re.I):
        raise ValueError('Expected a complete HTML report with a title')
    check_text(html)
    html = re.sub(r'</body\s*>', lambda _: RELAY + '\n</body>', html, count=1, flags=re.I)
    files = {'index.html': html.encode('utf8')}
    if len(set(parser.refs)) > 499:
        raise ValueError('Report contains too many resources')
    for name in sorted(set(parser.refs)):
        path = PurePosixPath(name)
        if (path.is_absolute() or '..' in path.parts or '\\' in name
                or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]{0,199}', name)
                or path.suffix.lower() not in ALLOWED):
            raise ValueError('Unsafe or unsupported report resource')
        asset = source.joinpath(*path.parts)
        if (not asset.resolve().is_relative_to(source) or not asset.is_file()
                or any(p.is_symlink() for p in [asset, *asset.parents] if p != source)):
            raise ValueError('Missing or unsafe report resource')
        if sum(map(len, files.values())) + asset.stat().st_size > 200 * 1024 ** 2:
            raise ValueError('Report resource exceeds 200MB')
        data = asset.read_bytes()
        if path.suffix.lower() in {'.json', '.jsonl', '.csv', '.txt', '.css', '.js'}:
            check_text(data.decode('utf8'))
        files[name] = data
    if len(files) > 500 or sum(map(len, files.values())) > 200 * 1024 ** 2:
        raise ValueError('Report package exceeds its size limit')
    digest = hashlib.sha256()
    for name, data in sorted(files.items()):
        digest.update(name.encode() + b'\0' + hashlib.sha256(data).digest())
    identity = digest.hexdigest()
    if destination.is_symlink():
        raise ValueError('Unsafe package destination')
    target = destination / identity
    if target.is_symlink():
        raise ValueError('Unsafe package destination')
    for name, data in files.items():
        output = target / name
        if any(p.is_symlink() for p in output.parents):
            raise ValueError('Unsafe package destination')
        if output.is_symlink() or (output.exists() and output.read_bytes() != data):
            raise ValueError('Refusing to replace existing report content')
    for name, data in files.items():
        output = target / name
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
    return {'id': identity, 'title': parser.title.strip(), 'url': f'{PUBLIC_BASE}{identity}/index.html',
            'files': len(files), 'bytes': sum(map(len, files.values()))}


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('source', type=Path)
    cli.add_argument('destination', type=Path)
    args = cli.parse_args()
    print(json.dumps(prepare_report(args.source, args.destination), ensure_ascii=True))
