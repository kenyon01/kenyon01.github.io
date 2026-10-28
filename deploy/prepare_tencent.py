"""Apply Tencent-only content exclusions in a disposable build checkout."""
from pathlib import Path
import argparse
import re

import yaml


BLOCKED_TOPICS = {"quant"}
LEGACY_TOPICS = (("具身智能", "robotics"), ("模型后训练", "post-training"), ("量化交易", "quant"))


def metadata(path):
    parts = re.split(r"^---[ \t]*\r?$", path.read_text(encoding="utf-8-sig"), maxsplit=2, flags=re.M)
    if len(parts) != 3 or parts[0].strip():
        return {}
    result = yaml.safe_load(parts[1])
    if result is None:
        return {}
    if not isinstance(result, dict):
        raise ValueError(f"Invalid front matter: {path}")
    return result


def topic_key(meta):
    explicit = meta.get("topic_key") or meta.get("topic")
    if explicit:
        return explicit
    tags = meta.get("tags") or []
    return next((key for tag, key in LEGACY_TOPICS if tag in tags), "general")


def prepare(source):
    source = Path(source).resolve()
    config_path = source / "_config.yml"
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    exclusions = set(config.get("exclude") or [])
    added = set()
    # Exclude source documents before Jekyll builds navigation, archives and sitemap.
    # Retain all originals; only the disposable checkout's configuration changes.
    candidates = list(source.glob("*.md")) + list(source.glob("*.html"))
    for collection in ("_posts", "_topics", "_chapters"):
        candidates.extend((source / collection).rglob("*.md"))
        candidates.extend((source / collection).rglob("*.html"))
    for path in candidates:
        meta = metadata(path)
        route = str(meta.get("permalink") or "")
        blocked_route = route.rstrip("/") == "/quant" or route.startswith("/quant/")
        blocked_topic_file = path.parent == source / "_topics" and path.stem in BLOCKED_TOPICS
        if blocked_topic_file or blocked_route or topic_key(meta) in BLOCKED_TOPICS:
            added.add(path.relative_to(source).as_posix())
    config["exclude"] = sorted(exclusions | added | {"quant"})
    config_path.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return sorted(added)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Disposable build checkout, never the authoring repository")
    args = parser.parse_args()
    for excluded in prepare(args.source):
        print(f"Tencent excludes: {excluded}")
