#!/usr/bin/env python3
"""Test Google Apps Script ContentService redirect recovery and retry safety."""
import io
import json
import urllib.error
from email.message import Message
from unittest.mock import patch

import apps_script_transport as transport


class FakeResponse:
    def __init__(self, body, status=200):
        self._body = body
        self.status = status
        self.headers = Message()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def getcode(self):
        return self.status

    def read(self):
        return self._body


def http_error(request, status, location=None):
    headers = Message()
    if location:
        headers["Location"] = location
    return urllib.error.HTTPError(
        request.full_url, status, "simulated response", headers, io.BytesIO(b"")
    )


endpoint = "https://script.google.com/macros/s/test-deployment/exec"
response_url = "https://script.googleusercontent.com/macros/echo?user_content_key=test-key"
payload = {"action": "list_upload_parts", "backup_id": "system-20261113T000000Z-a1b2c3d4"}
success = json.dumps({"ok": True, "backup_id": payload["backup_id"], "parts": []}).encode()


# A transient 404 on Google's one-time response URL is retried at that exact
# URL; the authenticated POST is not repeated while that URL is recovering.
queue = [
    ("http", 302, response_url),
    ("http", 404, None),
    ("ok", 200, success),
]
requests = []
def open_same_url(request, timeout):
    requests.append((request.get_method(), request.full_url, request.data, timeout))
    item = queue.pop(0)
    if item[0] == "http":
        raise http_error(request, item[1], item[2])
    return FakeResponse(item[2], item[1])

sleeps = []
with patch.object(transport, "open_no_redirect", open_same_url), patch.object(transport.time, "sleep", sleeps.append):
    result = transport.post_json(endpoint, "t" * 48, payload, timeout=60)

assert result["ok"] is True
assert [item[0] for item in requests] == ["POST", "GET", "GET"]
assert requests[1][1] == requests[2][1] == response_url
assert requests[0][2] is not None and b'"token":"' in requests[0][2]
assert requests[1][2] is None and requests[2][2] is None
assert sleeps == [2]


# If Google sends the response URL back to /exec, retry the original POST to
# obtain a fresh one-time response URL rather than following a redirect loop.
second_response_url = "https://script.googleusercontent.com/macros/echo?user_content_key=fresh-key"
queue = [
    ("http", 302, response_url),
    ("http", 302, endpoint),
    ("http", 302, second_response_url),
    ("ok", 200, success),
]
requests = []
def open_after_bounce(request, timeout):
    requests.append((request.get_method(), request.full_url, request.data))
    item = queue.pop(0)
    if item[0] == "http":
        raise http_error(request, item[1], item[2])
    return FakeResponse(item[2], item[1])

sleeps = []
with patch.object(transport, "open_no_redirect", open_after_bounce), patch.object(transport.time, "sleep", sleeps.append):
    result = transport.post_json(endpoint, "t" * 48, payload, timeout=60)

assert result["ok"] is True
assert [item[0] for item in requests] == ["POST", "GET", "POST", "GET"]
assert requests[1][1] == response_url
assert requests[3][1] == second_response_url
assert sleeps == [1]


# A timed-out GET is retried against the same response URL before retrying /exec.
queue = [
    ("http", 302, response_url),
    ("timeout", 0, None),
    ("ok", 200, success),
]
requests = []
def open_after_timeout(request, timeout):
    requests.append((request.get_method(), request.full_url, request.data))
    item = queue.pop(0)
    if item[0] == "http":
        raise http_error(request, item[1], item[2])
    if item[0] == "timeout":
        raise TimeoutError("simulated ContentService response timeout")
    return FakeResponse(item[2], item[1])

sleeps = []
with patch.object(transport, "open_no_redirect", open_after_timeout), patch.object(transport.time, "sleep", sleeps.append):
    result = transport.post_json(endpoint, "t" * 48, payload, timeout=60)

assert result["ok"] is True
assert [item[0] for item in requests] == ["POST", "GET", "GET"]
assert requests[1][1] == requests[2][1] == response_url
assert sleeps == [2]


# Never forward the authenticated payload to a non-Google response host.
queue = [("http", 302, "https://attacker.invalid/collect")]
requests = []
def open_untrusted(request, timeout):
    requests.append((request.get_method(), request.full_url, request.data))
    item = queue.pop(0)
    raise http_error(request, item[1], item[2])

with patch.object(transport, "open_no_redirect", open_untrusted), patch.object(transport.time, "sleep", lambda _: None):
    try:
        transport.post_json(endpoint, "t" * 48, payload, timeout=60)
    except transport.ReceiverTransportError as exc:
        assert "outside Google's response host" in str(exc)
    else:
        raise AssertionError("An untrusted redirect host must be rejected.")
assert len(requests) == 1 and requests[0][0] == "POST"

print("Apps Script ContentService redirect transport tests passed.")
