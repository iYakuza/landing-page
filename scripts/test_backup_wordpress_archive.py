#!/usr/bin/env python3
"""Focused safety and normalization tests for the WordPress archive exporter."""
from __future__ import annotations

import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).with_name("backup_wordpress_archive.py")
SPEC = importlib.util.spec_from_file_location("backup_wordpress_archive", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class WordPressArchiveTests(unittest.TestCase):
    def test_post_normalization_decodes_title_and_keeps_published_content(self):
        post = {
            "id": 3014,
            "status": "publish",
            "slug": "the-god-beneath-the-noise",
            "date": "2026-11-07T00:41:57",
            "modified": "2026-11-07T00:42:00",
            "link": "https://emanuelstefancu.wordpress.com/2026/11/07/the-god-beneath-the-noise/",
            "title": {"rendered": "The God Beneath the&nbsp;Noise"},
            "content": {"rendered": "<p>Published body</p>"},
            "excerpt": {"rendered": "<p>Short excerpt</p>"},
            "featured_media": 3017,
            "format": "standard",
            "categories": [2],
            "tags": [8, 9],
        }
        result = MODULE.normalize_post(post, {2: "Poetry"})
        self.assertEqual(result["title"], "The God Beneath the\u00a0Noise")
        self.assertEqual(result["content_html"], "<p>Published body</p>")
        self.assertEqual(result["categories"], ["Poetry"])
        self.assertEqual(result["featured_media"], 3017)

    def test_rejects_non_wordpress_or_non_https_post_links(self):
        with self.assertRaises(RuntimeError):
            MODULE.safe_wordpress_url("https://evil.example/post")
        with self.assertRaises(RuntimeError):
            MODULE.safe_wordpress_url("javascript:alert(1)")
        with self.assertRaises(RuntimeError):
            MODULE.safe_wordpress_url("http://emanuelstefancu.wordpress.com/post")

    def test_media_normalization_restricts_uploads_directory(self):
        item = {
            "id": 1710,
            "date": "2026-07-01T00:00:00",
            "mime_type": "audio/mpeg",
            "source_url": "https://emanuelstefancu.wordpress.com/wp-content/uploads/2026/07/fall-in-eden.mp3",
            "media_details": {"filesize": 11281546},
            "post": 1706,
            "title": {"rendered": "Fall in Eden"},
            "alt_text": "",
            "caption": {"rendered": ""},
            "description": {"rendered": ""},
        }
        result = MODULE.normalize_media(item)
        self.assertEqual(result["local_path"], "media/1710-fall-in-eden.mp3")
        self.assertEqual(result["expected_bytes"], 11281546)
        self.assertEqual(result["mime_type"], "audio/mpeg")

    def test_rejects_untrusted_media_hosts_and_paths(self):
        with self.assertRaises(RuntimeError):
            MODULE.normalize_media({
                "id": 1,
                "source_url": "https://evil.example/wp-content/uploads/song.mp3",
                "media_details": {},
            })
        with self.assertRaises(RuntimeError):
            MODULE.normalize_media({
                "id": 2,
                "source_url": "https://emanuelstefancu.wordpress.com/private/song.mp3",
                "media_details": {},
            })

    def test_rejects_oversized_media(self):
        with self.assertRaises(RuntimeError):
            MODULE.normalize_media({
                "id": 3,
                "source_url": "https://emanuelstefancu.wordpress.com/wp-content/uploads/huge.bin",
                "media_details": {"filesize": MODULE.MAX_FILE_BYTES + 1},
            })


if __name__ == "__main__":
    unittest.main()
