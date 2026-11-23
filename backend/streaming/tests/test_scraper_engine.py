"""
Unit tests for scraper_engine GraphQL response parsing.

Reproduces PostHog issue 019ed33d / 019edb54: JSONDecodeError
"Expecting value: line 1 column 1 (char 0)" raised by `_graphql_request` when
Django (behind nginx) returns a non-JSON body — e.g. an HTML 502/503 page
during a restart/deploy. The parser must degrade to {} instead of raising.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "live_streaming", "scripts",
))

import scraper_engine  # noqa: E402

parse = scraper_engine._parse_graphql_response


class TestParseGraphqlResponse:
    def test_valid_json_returns_data_payload(self):
        raw = b'{"data": {"streaming_station_configs": [{"station_id": 1}]}}'
        assert parse(200, raw) == {"streaming_station_configs": [{"station_id": 1}]}

    def test_html_503_body_returns_empty_dict_not_raises(self):
        raw = (
            b"<html>\r\n<head><title>503 Service Temporarily Unavailable</title>"
            b"</head>\r\n<body>\r\n<center><h1>503</h1></center>\r\n</body>\r\n</html>\r\n"
        )
        assert parse(503, raw) == {}

    def test_html_with_200_status_returns_empty_dict(self):
        # proxy / captive-portal HTML returned with a 200 status
        assert parse(200, b"<html>not json</html>") == {}

    def test_empty_body_returns_empty_dict(self):
        assert parse(200, b"") == {}
        assert parse(200, b"   \r\n  ") == {}

    def test_graphql_null_data_returns_empty_dict(self):
        # GraphQL error shape: {"data": null, "errors": [...]}
        raw = b'{"data": null, "errors": [{"message": "boom"}]}'
        assert parse(200, raw) == {}

    def test_4xx_status_returns_empty_dict(self):
        assert parse(404, b'{"data": {"x": 1}}') == {}

    def test_non_object_json_returns_empty_dict(self):
        assert parse(200, b"[1, 2, 3]") == {}

    def test_the_exact_reported_jsondecodeerror_input_is_handled(self):
        # "Expecting value: line 1 column 1 (char 0)" originates from parsing an
        # empty / non-JSON first byte. Confirm we degrade instead of raising.
        try:
            result = parse(200, b"")
        except Exception as e:  # pragma: no cover
            pytest.fail(f"parser raised instead of degrading: {e!r}")
        assert result == {}


ART = "https://radio.example.com/api/station/demo/art"


def _serve(monkeypatch, body: dict):
    monkeypatch.setattr(scraper_engine, "_http_get", lambda url, timeout=None: __import__("json").dumps(body))


class TestSeparateArtistField:
    def test_icecast_uses_the_artist_field_and_keeps_the_title_whole(self, monkeypatch):
        _serve(monkeypatch, {"icestats": {"source": {
            "artist": "Cuvântul la vremea potrivită", "title": "Chivotul - Valentin Popovici", "listeners": 6}}})
        merged = scraper_engine._run_scrapers([{"category_slug": "icecast", "url": "u", "priority": 1}])
        assert (merged["artist"], merged["title"]) == ("Cuvântul la vremea potrivită", "Chivotul - Valentin Popovici")
        assert merged["listeners"] == 6

    def test_icecast_without_an_artist_still_splits_the_title(self, monkeypatch):
        _serve(monkeypatch, {"icestats": {"source": {"title": "Familia Pascal - Ce bucurie"}}})
        merged = scraper_engine._run_scrapers([{"category_slug": "icecast", "url": "u", "priority": 1}])
        assert (merged["artist"], merged["title"]) == ("Familia Pascal", "Ce bucurie")

    def test_azuracast_gives_artist_title_cover_and_listeners(self, monkeypatch):
        _serve(monkeypatch, {"listeners": {"current": 5}, "now_playing": {"song": {
            "text": "Familia Pascal - Ce bucurie", "artist": "Familia Pascal", "title": "Ce bucurie",
            "art": f"{ART}/d18e52d2edcb1926b598bd60-1794732263.jpg"}}})
        merged = scraper_engine._run_scrapers([{"category_slug": "azuracast", "url": "u", "priority": 2}])
        assert (merged["artist"], merged["title"]) == ("Familia Pascal", "Ce bucurie")
        assert merged["thumbnail_url"] == f"{ART}/d18e52d2edcb1926b598bd60-1794732263.jpg"
        assert merged["listeners"] == 5

    def test_azuracast_fallback_art_is_not_a_cover(self):
        assert scraper_engine.azuracast_cover(f"{ART}/eb8ec63fdf67c94c71f5a91b") is None
        assert scraper_engine.azuracast_cover(None) is None


class TestIcyTitleUsesTheFetcherSettings:
    def test_without_settings_it_is_artist_then_title(self, monkeypatch):
        monkeypatch.setattr(scraper_engine, "_config", {"scrapers": []})
        result = scraper_engine._icy_result("Ana Rogojan - De cand am aflat calea Ta")
        assert (result["artist"], result["title"]) == ("Ana Rogojan", "De cand am aflat calea Ta")

    def test_the_stream_id3_regexes_swap_title_and_artist(self, monkeypatch):
        monkeypatch.setattr(scraper_engine, "_config", {"scrapers": [{
            "category_slug": "stream_id3", "split_character": " - ",
            "artist_regex": r"^.+ - (.+)$", "title_regex": r"^(.+?) - .+$"}]})
        result = scraper_engine._icy_result("Nu judecati - Lavinia Stan")
        assert (result["artist"], result["title"]) == ("Lavinia Stan", "Nu judecati")

    def test_the_station_name_regex_strips_a_prefix(self, monkeypatch):
        monkeypatch.setattr(scraper_engine, "_config", {"scrapers": [{
            "category_slug": "stream_id3", "split_character": " - ",
            "station_name_regex": r"^\d{1,2}:\d{2} - \d{4}\.\d{2}\.\d{2} - "}]})
        result = scraper_engine._icy_result("23:00 - 2026.11.23 - Duh_&_Adevar (34:09)")
        assert (result["artist"], result["title"]) == ("", "Duh_&_Adevar (34:09)")
