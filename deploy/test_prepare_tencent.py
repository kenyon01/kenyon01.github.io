from pathlib import Path
import tempfile
import unittest

import yaml

from prepare_tencent import prepare


class TencentBuildTests(unittest.TestCase):
    def test_excludes_topic_posts_and_chapters_without_changing_sources(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "_config.yml").write_text("exclude: [deploy]\nurl: https://kenyon01.github.io\n", encoding="utf8")
            docs = {
                "_topics/quant.md": "topic_key: quant\npermalink: /quant/",
                "_posts/new.md": "topic: quant",
                "_posts/legacy.md": "tags: [量化交易]",
                "_chapters/quant-chapter.md": "topic: quant",
                "_posts/robot.md": "topic: robotics\ntags: [量化交易]",
                "_posts/legacy-robot.md": "tags: [具身智能, 量化交易]",
                "quant-page.md": "permalink: /quant/intro/",
            }
            for name, front in docs.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(f"---\n{front}\n---\nBody", encoding="utf8")
            originals = {name: (root / name).read_bytes() for name in docs}
            excluded = prepare(root)
            self.assertEqual(set(excluded), set(docs) - {"_posts/robot.md", "_posts/legacy-robot.md"})
            config = yaml.safe_load((root / "_config.yml").read_text(encoding="utf8"))
            self.assertIn("deploy", config["exclude"])
            self.assertIn("quant", config["exclude"])
            self.assertEqual(config["url"], "https://kenyon01.github.io")
            self.assertEqual(originals, {name: (root / name).read_bytes() for name in docs})
            once = (root / "_config.yml").read_bytes()
            prepare(root)
            self.assertEqual(once, (root / "_config.yml").read_bytes())


if __name__ == "__main__":
    unittest.main()
