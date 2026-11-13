#!/usr/bin/env python3
"""Bounded HTTP transport for Google Apps Script ContentService responses.

Apps Script ContentService sends a 302 to script.googleusercontent.com. This
client keeps the authenticated POST on /exec, follows only trusted Google
response-host redirects with GET, retries the same response URL briefly, and
retries the original POST when the redirect chain is unusable.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlparse

REDIRECT_CODES = {301, 302, 303, 307, 308}
RETRYABLE_HTTP = {408, 429, 500, 502, 503, 504}
REDIRECT_FETCH_RETRIES = 2
REDIRECT_FETCH_TIMEOUT_SECONDS = 30
MAX_REDIRECT_HOPS = 5


class ReceiverTransportError(RuntimeError):
    """The receiver's HTTP response could not be retrieved safely."""


class _RetryOriginalPost(Exception):
    """A new /exec request is needed to obtain a fresh ContentService URL."""


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def open_no_redirect(request: urllib.request.Request, timeout: float):
    """Open one HTTP hop without automatically forwarding POST bodies or methods."""
    opener = urllib.request.build_opener(_NoRedirectHandler)
    return opener.open(request, timeout=timeout)


def _request_once(request: urllib.request.Request, timeout: float):
    try:
        with open_no_redirect(request, timeout=timeout) as response:
            return response.getcode(), response.headers, response.read()
    except urllib.error.HTTPError as exc:
        # A redirect is represented by urllib as HTTPError when auto-follow is off.
        status, headers = exc.code, exc.headers
        exc.close()
        return status, headers, b""


def _remaining_timeout(timeout: float, deadline: float | None) -> float:
    if deadline is None:
        return timeout
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise ReceiverTransportError("The receiver request exceeded its time budget.")
    return min(timeout, remaining)


def _safe_content_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname == "script.googleusercontent.com"


def _fetch_content_response(location: str, endpoint: str, deadline: float | None) -> bytes:
    current_url = location
    for _hop in range(MAX_REDIRECT_HOPS):
        if not _safe_content_url(current_url):
            raise _RetryOriginalPost("ContentService returned an untrusted response URL.")

        moved_to_next_hop = False
        for response_attempt in range(REDIRECT_FETCH_RETRIES + 1):
            request = urllib.request.Request(current_url, method="GET")
            try:
                status, headers, raw = _request_once(
                    request,
                    _remaining_timeout(REDIRECT_FETCH_TIMEOUT_SECONDS, deadline),
                )
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                if response_attempt >= REDIRECT_FETCH_RETRIES:
                    raise _RetryOriginalPost(
                        "The Google ContentService response URL timed out or was unavailable."
                    ) from None
                delay = 2 ** (response_attempt + 1)
                print(
                    f"Apps Script response GET attempt {response_attempt + 1}/"
                    f"{REDIRECT_FETCH_RETRIES + 1} failed ({type(exc).__name__}); "
                    f"retrying the same response URL after {delay}s.",
                    flush=True,
                )
                time.sleep(min(delay, _remaining_timeout(delay, deadline)))
                continue

            if status == 200:
                return raw

            if status in REDIRECT_CODES:
                next_location = headers.get("Location")
                if not next_location:
                    raise _RetryOriginalPost("Google response host returned a redirect without Location.")
                next_url = urljoin(current_url, next_location)
                next_parsed = urlparse(next_url)
                endpoint_parsed = urlparse(endpoint)
                if (next_parsed.scheme, next_parsed.hostname, next_parsed.path) == (
                    endpoint_parsed.scheme, endpoint_parsed.hostname, endpoint_parsed.path
                ):
                    raise _RetryOriginalPost("ContentService response redirected back to the Apps Script /exec endpoint.")
                if not _safe_content_url(next_url):
                    raise ReceiverTransportError("ContentService redirected outside Google's response host.")
                current_url = next_url
                moved_to_next_hop = True
                break

            if status == 404 or status in RETRYABLE_HTTP:
                if response_attempt >= REDIRECT_FETCH_RETRIES:
                    raise _RetryOriginalPost(
                        f"Google ContentService response host returned HTTP {status} after bounded retries."
                    )
                delay = 2 ** (response_attempt + 1)
                print(
                    f"Apps Script response GET attempt {response_attempt + 1}/"
                    f"{REDIRECT_FETCH_RETRIES + 1} returned HTTP {status}; "
                    f"retrying the same response URL after {delay}s.",
                    flush=True,
                )
                time.sleep(min(delay, _remaining_timeout(delay, deadline)))
                continue

            if status == 405:
                raise _RetryOriginalPost("Google ContentService response host returned HTTP 405.")
            raise ReceiverTransportError(f"Google ContentService response host returned HTTP {status}.")

        if moved_to_next_hop:
            continue

        raise _RetryOriginalPost("Google ContentService response URL did not become available.")

    raise _RetryOriginalPost("Google ContentService redirect chain exceeded its hop limit.")


def post_json(
    endpoint: str,
    token: str,
    payload: dict,
    timeout: float,
    deadline: float | None = None,
    retries: int = 2,
) -> dict:
    """POST JSON to Apps Script and safely retrieve its redirected JSON response."""
    body = json.dumps({**payload, "token": token}, separators=(",", ":")).encode("utf-8")

    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(
                endpoint,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            status, headers, raw = _request_once(
                request,
                _remaining_timeout(timeout, deadline),
            )

            if status in REDIRECT_CODES:
                location = headers.get("Location")
                if not location:
                    raise _RetryOriginalPost("Apps Script returned a redirect without Location.")
                raw = _fetch_content_response(urljoin(endpoint, location), endpoint, deadline)
                status = 200
            elif status in RETRYABLE_HTTP:
                raise _RetryOriginalPost(f"Apps Script returned temporary HTTP {status}.")
            elif status != 200:
                raise ReceiverTransportError(f"Apps Script receiver returned HTTP {status}.")

            try:
                result = json.loads(raw.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise _RetryOriginalPost("Apps Script response was not valid JSON.") from None

            if not isinstance(result, dict):
                raise _RetryOriginalPost("Apps Script response was not a JSON object.")
            return result

        except _RetryOriginalPost as exc:
            if attempt >= retries:
                raise ReceiverTransportError(
                    f"Apps Script response failed after {retries + 1} bounded attempts: {exc}"
                ) from None
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            if attempt >= retries:
                raise ReceiverTransportError(
                    f"Apps Script request failed after {retries + 1} bounded attempts ({type(exc).__name__})."
                ) from None

        delay = min(2 ** attempt, 4, _remaining_timeout(4, deadline))
        print(
            f"Retrying the original Apps Script POST ({attempt + 2}/{retries + 1}) "
            f"after {delay}s to obtain a fresh response URL.",
            flush=True,
        )
        time.sleep(delay)

    raise ReceiverTransportError("Apps Script response could not be retrieved.")
