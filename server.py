import os
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from supabase import create_client, Client

# --- 1. CONFIGURACIÓN PARA LA NUBE ---
# --- 1. CONFIGURACIÓN PARA LA NUBE ---
PORT = int(os.environ.get("PORT", 8766))

# Forzamos los datos directamente en el código
SUPABASE_URL = "https://bjfezwyciknhpihiwoxu.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZmV6d3ljaWtuaHBpaGl3b3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzIyMDUsImV4cCI6MjA5NTY0ODIwNX0.q2jKJaGuR-zpG_sbw7mA02bN7LocCtbac0ACNnuDsBE"

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None
    print("ADVERTENCIA: Iniciando sin base de datos remota conectada.")

# --- 2. DATOS POR DEFECTO ---
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

# --- 3. FUNCIONES DE LECTURA Y ESCRITURA EN SUPABASE ---
def read_state():
    if not supabase: return default_state()
    try:
        response = supabase.table("app_data").select("data").eq("id", 1).execute()
        if response.data:
            data = response.data[0].get("data", {})
            records = data.get("records", [])
            projects = data.get("projects", DEFAULT_PROJECTS)
            return {"records": records, "projects": projects or DEFAULT_PROJECTS}
    except Exception as e:
        print(f"Error leyendo de Supabase: {e}")
    return default_state()

def write_state(data):
    if not supabase: return
    try:
        supabase.table("app_data").upsert({"id": 1, "data": data}).execute()
    except Exception as e:
        print(f"Error escribiendo en Supabase: {e}")

# --- 4. MANEJADOR HTTP ORIGINAL ---
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
        write_state(clean_state)
        self.send_json(200, {"ok": True})

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AppHandler)
    print(f"\nServidor en la nube iniciado en el puerto {PORT}")
    server.serve_forever()
