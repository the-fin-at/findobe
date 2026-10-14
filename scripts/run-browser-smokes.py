"""Run CLI browser smokes in isolated Chromium sessions with an owned UI server."""
import argparse
import functools
import http.server
import json
import pathlib
import subprocess
import threading
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--ui', type=pathlib.Path, default=ROOT / 'ui')
parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'test-results/browser-smokes')
parser.add_argument('tests', nargs='*', default=['editor', 'preview', 'markdown', 'usability', 'tabs', 'pdf', 'review-fixes', 'pdf-cache', 'document'])
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

# Refuse to reuse an unknown server. All existing test URLs use this loopback port.
server = http.server.ThreadingHTTPServer(('127.0.0.1', 17893), functools.partial(QuietHandler, directory=str(args.ui)))
threading.Thread(target=server.serve_forever, daemon=True).start()
results = {}
try:
    for name in args.tests:
        session = f'findobe-smoke-{time.time_ns()}'
        command = ['playwright-cli', '-s=' + session]
        log = ''
        try:
            for step in [['open', '--browser=chromium', 'http://127.0.0.1:17893/'],
                         ['run-code', '--filename=' + str(ROOT / 'tests' / f'{name}-smoke.js')]]:
                result = subprocess.run(command + step, capture_output=True, text=True, timeout=240)
                log += result.stdout + result.stderr
                if result.returncode or '### Error' in result.stdout or '### Error' in result.stderr:
                    raise RuntimeError(f'{step[0]} failed (exit {result.returncode}); see log')
            results[name] = {'passed': True}
        except (RuntimeError, subprocess.TimeoutExpired, OSError) as err:
            log += '\n' + str(err)
            results[name] = {'passed': False, 'error': str(err)}
            diagnostic = subprocess.run(command + ['snapshot'], capture_output=True, text=True, timeout=30)
            log += '\n' + diagnostic.stdout + diagnostic.stderr
            subprocess.run(command + ['screenshot', '--filename=' + str(args.output.resolve() / f'{name}-failure.png')],
                           capture_output=True, text=True, timeout=30)
        finally:
            subprocess.run(command + ['close'], capture_output=True, text=True, timeout=30)
            (args.output / f'{name}-smoke.log').write_text(log)
        print(name + ': ' + ('PASS' if results[name]['passed'] else 'FAIL'), flush=True)
finally:
    server.shutdown()
    server.server_close()
    (args.output / 'summary.json').write_text(json.dumps(results, indent=2) + '\n')
raise SystemExit(0 if all(r['passed'] for r in results.values()) else 1)
