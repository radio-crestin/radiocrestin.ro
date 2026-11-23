"""Repairs song text that a station server encoded twice."""


def undo_double_utf8(text: str) -> str:
    """Text whose UTF-8 bytes were decoded as Latin-1 and encoded again, repaired.

    Some RVE servers send their ICY titles that way ("GÃ¢ndiÈ\x9bi-vÄ\x83" for
    "Gândiți-vă"). Real text never round-trips: Romanian letters are not
    Latin-1, and a Latin-1 letter on its own is not valid UTF-8.
    """
    try:
        return text.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return text
