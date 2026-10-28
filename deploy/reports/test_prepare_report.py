import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from prepare_report import prepare_report


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        self.output = self.root / 'output'

    def html(self, body):
        raw = '<html><head><title>实验报告</title></head><body>' + body + '</body></html>'
        (self.source / 'index.html').write_text(raw, encoding='utf8')
        return raw

    def test_packages_only_referenced_files_deterministically_without_changing_original(self):
        raw = self.html('<video src="rollout.mp4"></video><a href="summary.json">data</a>')
        (self.source / 'rollout.mp4').write_bytes(b'video')
        (self.source / 'summary.json').write_text('{"success":false}')
        (self.source / 'not-referenced.txt').write_text('PRIVATE')
        result = prepare_report(self.source, self.output)
        self.assertEqual(result, prepare_report(self.source, self.output))
        package = self.output / result['id']
        self.assertEqual(set(p.name for p in package.iterdir()), {'index.html', 'rollout.mp4', 'summary.json'})
        self.assertIn('blog-report-relay', (package / 'index.html').read_text(encoding='utf8'))
        self.assertEqual((self.source / 'index.html').read_text(encoding='utf8'), raw)
        self.assertEqual(len(result['id']), 64)

    def test_rejects_traversal_external_resources_redirects_and_missing_files(self):
        for body in ('<img src="../secret.png">', '<script src="https://example.com/code.js"></script>', '<video src="missing.mp4"></video>', '<base href="https://example.com">', '<meta http-equiv="refresh" content="0;url=https://example.com">'):
            with self.subTest(body=body):
                self.html(body)
                with self.assertRaises(ValueError):
                    prepare_report(self.source, self.output)

    def test_checks_referenced_text_for_credentials_and_allows_embedded_images(self):
        self.html('<img src="data:image/png;base64,eA=="><a href="data.txt">data</a>')
        (self.source / 'data.txt').write_text('ghp_' + 'a' * 36)
        with self.assertRaises(ValueError):
            prepare_report(self.source, self.output)
        (self.source / 'data.txt').write_text('public statistics')
        self.assertEqual(prepare_report(self.source, self.output)['files'], 2)

    def test_rejects_a_dangling_output_symlink_even_when_exists_is_false(self):
        self.html('report')
        result = prepare_report(self.source, self.output)
        output = self.output / result['id'] / 'index.html'
        output.unlink()
        # Windows may not grant symlink creation; model the same filesystem predicates.
        with patch.object(Path, 'is_symlink', lambda path: path == output):
            self.assertFalse(output.exists())
            with self.assertRaises(ValueError):
                prepare_report(self.source, self.output)
        self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
