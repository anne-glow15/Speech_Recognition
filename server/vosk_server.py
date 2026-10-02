#!/usr/bin/env python3
"""
VoxNova — Vosk WebSocket ASR Server

A lightweight Python WebSocket server that uses Vosk for offline, real-time
speech recognition.  The frontend (asrClient.ts) already speaks the Vosk
WebSocket protocol, so no changes are needed on the JS side.

Protocol
--------
Client → Server:
  1. JSON  {"config": {"sample_rate": 16000}}   — start a new stream
  2. Binary  <pcm16 chunks>                      — raw 16-bit little-endian PCM
  3. JSON  {"eof": 1}                            — end of stream

Server → Client:
  • {"partial": "hello wor"}                     — ongoing hypothesis
  • {"text": "hello world", "result": [...]}     — final result with word-level timestamps

Usage
-----
    python vosk_server.py                        # uses default model in ./model/
    python vosk_server.py --model ./vosk-model-small-en-us-0.15
    python vosk_server.py --port 2700 --host 0.0.0.0
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
from pathlib import Path

try:
    from vosk import Model, KaldiRecognizer, SetLogLevel
except ImportError:
    print(
        "\n[ERROR] 'vosk' is not installed.\n"
        "  Run:  pip install vosk\n"
        "  Then download a model from https://alphacephei.com/vosk/models\n"
    )
    sys.exit(1)

try:
    import websockets
    try:
        # websockets >= 13
        from websockets.asyncio.server import serve
    except ImportError:  # websockets 12.x
        from websockets.server import serve
except ImportError:
    print("\n[ERROR] 'websockets' is not installed.\n  Run:  pip install websockets\n")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("vosk-server")


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------
def load_model(model_path: str) -> Model:
    """Load the Vosk model from disk."""
    p = Path(model_path)
    required = (p / "am", p / "conf", p / "graph")
    if not p.is_dir() or not all(part.is_dir() for part in required):
        log.error("Model path does not exist: %s", p.resolve())
        log.info(
            "Download a model from https://alphacephei.com/vosk/models\n"
            "and extract it into the 'server/' directory, e.g.:\n"
            "  server/model/            (rename the extracted folder to 'model')\n"
            "  server/vosk-model-small-en-us-0.15/\n"
        )
        sys.exit(1)

    log.info("Loading Vosk model from %s ...", p.resolve())
    model = Model(str(p.resolve()))
    log.info("Model loaded successfully")
    return model


# ---------------------------------------------------------------------------
# WebSocket handler
# ---------------------------------------------------------------------------
async def send_json(ws, payload: str):
    """Send a result without letting a disconnect obscure the real error."""
    try:
        await ws.send(payload)
    except websockets.exceptions.ConnectionClosed:
        raise


async def handle_client(ws, model: Model, sample_rate: int):
    """Handle a single WebSocket connection."""
    client = ws.remote_address
    log.info("Client connected: %s", client)

    rec: KaldiRecognizer | None = None
    rate = sample_rate  # default; overridden by client config

    try:
        async for message in ws:
            # ── JSON messages ──────────────────────────────────────────
            if isinstance(message, str):
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    log.warning("Malformed JSON from %s: %s", client, message[:120])
                    continue

                # {"config": {"sample_rate": 16000}}
                if "config" in data:
                    requested_rate = int(data["config"].get("sample_rate", sample_rate))
                    # Vosk accepts arbitrary rates, but browser audio should be
                    # normalized to a sane speech rate.  Rejecting bad values
                    # avoids silently producing unusable recognizers.
                    if not 8000 <= requested_rate <= 48000:
                        await send_json(ws, json.dumps({"error": "sample_rate must be between 8000 and 48000"}))
                        continue
                    rate = requested_rate
                    rec = KaldiRecognizer(model, rate)
                    rec.SetWords(True)
                    rec.SetPartialWords(False)
                    log.info("Stream started — sample_rate=%d  client=%s", rate, client)
                    continue

                # {"eof": 1}
                if "eof" in data:
                    if rec is not None:
                        final = rec.FinalResult()
                        await send_json(ws, final)
                        log.info("EOF — sent final result to %s", client)
                    rec = None
                    continue

            # ── Binary audio ──────────────────────────────────────────
            elif isinstance(message, (bytes, bytearray)):
                if len(message) < 2:
                    continue
                if len(message) % 2 != 0:
                    message = message[: len(message) - 1]

                if rec is None:
                    # Auto-create recogniser if client skipped config
                    rec = KaldiRecognizer(model, rate)
                    rec.SetWords(True)

                try:
                    if rec.AcceptWaveform(bytes(message)):
                        # Full utterance ready
                        result = rec.Result()
                        await send_json(ws, result)
                    else:
                        # Partial hypothesis
                        partial = rec.PartialResult()
                        await send_json(ws, partial)
                except Exception as err:
                    log.warning("Waveform processing error for %s: %s", client, err)

    except websockets.exceptions.ConnectionClosed:
        log.info("Client disconnected: %s", client)
    except Exception:
        log.exception("Error handling client %s", client)
    finally:
        log.info("Connection closed: %s", client)


# ---------------------------------------------------------------------------
# Server entry-point
# ---------------------------------------------------------------------------
async def main(host: str, port: int, model_path: str, sample_rate: int):
    SetLogLevel(-1)  # suppress Vosk/Kaldi internal logs
    model = load_model(model_path)

    log.info("Starting Vosk WebSocket server on ws://%s:%d", host, port)
    log.info("Press Ctrl+C to stop.\n")

    stop = asyncio.get_event_loop().create_future()

    # Graceful shutdown on Ctrl+C
    if sys.platform != "win32":
        loop = asyncio.get_event_loop()
        loop.add_signal_handler(signal.SIGINT, stop.set_result, None)
        loop.add_signal_handler(signal.SIGTERM, stop.set_result, None)

    async with serve(
        lambda ws, *args: handle_client(ws, model, sample_rate),
        host,
        port,
        # large audio chunks need generous limits
        max_size=2**24,            # 16 MB
        ping_interval=30,
        ping_timeout=60,
    ):
        log.info(
            "══════════════════════════════════════════════════════\n"
            "  VoxNova Vosk Server is READY\n"
            "  Listening on ws://%s:%d\n"
            "  Model: %s\n"
            "══════════════════════════════════════════════════════",
            host, port, model_path,
        )

        if sys.platform == "win32":
            # On Windows, asyncio signal handlers aren't supported.
            # Keep running until the process is killed.
            while True:
                await asyncio.sleep(3600)
        else:
            await stop


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def cli():
    here = Path(__file__).parent

    # Auto-detect a model directory: prefer 'model' symlink/junction, then any vosk-model directory
    if (here / "model").exists():
        default_model = str(here / "model")
    else:
        default_model = str(here / "model")
        for candidate in sorted(here.iterdir()):
            if candidate.is_dir() and candidate.name.startswith("vosk-model"):
                default_model = str(candidate)
                break

    parser = argparse.ArgumentParser(
        description="VoxNova — Vosk offline ASR WebSocket server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python vosk_server.py\n"
            "  python vosk_server.py --model vosk-model-small-en-us-0.15\n"
            "  python vosk_server.py --port 2700 --host 0.0.0.0\n"
        ),
    )
    parser.add_argument(
        "--model", "-m",
        default=default_model,
        help="Path to the Vosk model directory (default: %(default)s)",
    )
    parser.add_argument(
        "--port", "-p",
        type=int, default=2700,
        help="WebSocket port (default: %(default)s)",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Bind address (default: %(default)s)",
    )
    parser.add_argument(
        "--sample-rate", "-r",
        type=int, default=16000,
        help="Default sample rate if client doesn't specify (default: %(default)s)",
    )
    args = parser.parse_args()

    try:
        asyncio.run(main(args.host, args.port, args.model, args.sample_rate))
    except KeyboardInterrupt:
        log.info("\nServer stopped.")


if __name__ == "__main__":
    cli()
