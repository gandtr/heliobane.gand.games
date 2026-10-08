"""Validate all page VideoObjects and the trailer's evidenced publication instant.

Run: python3 -m unittest discover -s tests
Google: https://developers.google.com/search/docs/appearance/structured-data/video
Publication source: https://github.com/gandtr/heliobane.gand.games/actions/runs/36074813360
First successful Pages deployment of trailer (commit bea22355f2e0d124f2d216eb0b90ef43496f9db4), Deploy to GitHub Pages step completed_at. Equivalent to September 25 in Japan (+09:00).
"""
import datetime as dt
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
VIDEO_URL = 'https://heliobane.gand.games/public/trailer.mp4'
PUBLISHED_AT = '2026-09-24T23:52:11Z'


class StructuredData(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.chunks = []
        self.documents = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("type") == "application/ld+json":
            self.active = True
            self.chunks = []

    def handle_data(self, data):
        if self.active:
            self.chunks.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.active:
            self.documents.append(json.loads("".join(self.chunks)))
            self.active = False


def videos(value):
    if isinstance(value, dict):
        kind = value.get("@type", [])
        if kind == "VideoObject" or isinstance(kind, list) and "VideoObject" in kind:
            yield value
        for child in value.values():
            yield from videos(child)
    elif isinstance(value, list):
        for child in value:
            yield from videos(child)


def timestamp(value):
    if not isinstance(value, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})", value
    ):
        raise ValueError("uploadDate requires an ISO 8601 date, time and timezone")
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


class VideoMetadataTests(unittest.TestCase):
    def test_every_video_has_valid_evidenced_publication_time(self):
        found = []
        for page in ROOT.rglob("*.html"):
            if any(part in {".git", "node_modules", "_site"} for part in page.relative_to(ROOT).parts):
                continue
            parser = StructuredData()
            parser.feed(page.read_text())
            for document in parser.documents:
                for video in videos(document):
                    with self.subTest(page=str(page), video=video.get("name")):
                        published = timestamp(video.get("uploadDate"))
                        self.assertLess(published, dt.datetime.now(dt.timezone.utc))
                        if VIDEO_URL in (video.get("embedUrl"), video.get("contentUrl")):
                            self.assertEqual(published, timestamp(PUBLISHED_AT))
                            found.append(video)
        self.assertEqual(len(found), 1, "Expected the evidenced trailer exactly once")

    def test_rejects_original_warning_and_invalid_calendar_dates(self):
        for value in ("2026-09-28", "2026-09-28T10:51:43", "2026-02-30T10:51:43Z", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                timestamp(value)


if __name__ == "__main__":
    unittest.main()
