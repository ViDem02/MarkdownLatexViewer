import http.server
import socketserver
import os

PORT = 4000
MAX_PORT_TRIES = 20
DIRECTORY = "public"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    desired_port = int(os.environ.get("PORT", PORT))
    httpd = None
    active_port = desired_port

    for offset in range(MAX_PORT_TRIES + 1):
        candidate_port = desired_port + offset
        try:
            httpd = socketserver.TCPServer(("", candidate_port), Handler)
            active_port = candidate_port
            break
        except OSError as e:
            if e.errno != 48 or offset == MAX_PORT_TRIES:
                raise

    if active_port != desired_port:
        print(f"Port {desired_port} in use, switched to {active_port}.")

    with httpd:
        print(f"Serving at http://localhost:{active_port}")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            httpd.shutdown()
