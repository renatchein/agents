import subprocess
import sys
import os
import time
import webbrowser
import signal

BASE = os.path.dirname(os.path.abspath(__file__))
UI_DIR = os.path.join(BASE, "ui")

npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"


def main():
    print("🚀 Iniciando AI Email Agent...")

    api_proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn", "api:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload",
        ],
        cwd=BASE,
    )
    print("✅ API backend rodando em http://localhost:8000")

    ui_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=UI_DIR,
    )
    print("✅ UI frontend iniciando em http://localhost:3000")
    print("⏳ Aguardando Next.js compilar...")

    time.sleep(5)
    webbrowser.open("http://localhost:3000")
    print("🌐 Navegador aberto em http://localhost:3000")
    print("\nPressione Ctrl+C para encerrar.\n")

    def shutdown(_sig, _frame):
        print("\n⏹ Encerrando...")
        api_proc.terminate()
        ui_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    try:
        api_proc.wait()
    except KeyboardInterrupt:
        api_proc.terminate()
        ui_proc.terminate()


if __name__ == "__main__":
    main()
