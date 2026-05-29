from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import ipaddress
import json
import socket
import sys
import threading


PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "database.json"
LOCK = threading.Lock()

DEFAULT_PROJECTS = [
    {"key": "EZ", "name": "Estacionamiento Zumaya"},
    {"key": "AN", "name": "Ampliacion Nave"},
    {"key": "71+780", "name": "Puente KM 71+780"},
    {"key": "66+900", "name": "Puente KM 66+900"},
    {"key": "64+820", "name": "Puente KM 64+820"},
    {"key": "50D", "name": "50 Doctors"},
]


def default_state():
    return {"records": [], "projects": DEFAULT_PROJECTS}


def read_state():
    with LOCK:
        if not DB_PATH.exists():
            write_state(default_state())

        try:
            with DB_PATH.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except (json.JSONDecodeError, OSError):
            data = default_state()

        if not isinstance(data, dict):
            data = default_state()

        records = data.get("records")
        projects = data.get("projects")
        if not isinstance(records, list):
            records = []
        if not isinstance(projects, list) or not projects:
            projects = DEFAULT_PROJECTS

        return {"records": records, "projects": projects}


def write_state(data):
    DB_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


class AppHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.endswith((".html", ".js", ".css", ".webmanifest")) or self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/state":
            self.send_json(200, read_state())
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/state":
            self.send_json(404, {"error": "Ruta no encontrada"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = self.rfile.read(length).decode("utf-8")
            data = json.loads(payload)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "Datos invalidos"})
            return

        records = data.get("records")
        projects = data.get("projects")
        if not isinstance(records, list) or not isinstance(projects, list):
            self.send_json(400, {"error": "Formato invalido"})
            return

        clean_state = {"records": records, "projects": projects or DEFAULT_PROJECTS}
        with LOCK:
            write_state(clean_state)
        self.send_json(200, {"ok": True})

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def local_ips():
    private_ips = []
    other_ips = []
    hostname = socket.gethostname()
    for item in socket.getaddrinfo(hostname, None, socket.AF_INET):
        ip = item[4][0]
        if ip.startswith("127."):
            continue

        try:
            is_private = ipaddress.ip_address(ip).is_private
        except ValueError:
            is_private = False

        if is_private and ip not in private_ips:
            private_ips.append(ip)
        elif ip not in other_ips:
            other_ips.append(ip)

    return private_ips or other_ips


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AppHandler)
    print("\nCONTROL DE INSPECCIONES Y REPARACIONES")
    print("Base compartida activa en database.json\n")
    print("Abra este link en los celulares conectados al mismo Wi-Fi:")
    for ip in local_ips():
        print(f"  http://{ip}:{PORT}/index.html")
    print("\nDeje esta ventana abierta mientras usen la app.\n")
    server.serve_forever()
