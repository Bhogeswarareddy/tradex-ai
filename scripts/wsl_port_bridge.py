import socket
import threading
import subprocess
import time
import sys

def get_wsl_ip():
    try:
        out = subprocess.check_output(['wsl', 'hostname', '-I'], text=True)
        return out.strip().split()[0]
    except Exception:
        return '172.17.82.210'

def forward_stream(src, dst):
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass
    finally:
        for s in (src, dst):
            try:
                s.close()
            except Exception:
                pass

def handle_client(client, target_ip, target_port):
    try:
        remote = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        remote.connect((target_ip, target_port))
        threading.Thread(target=forward_stream, args=(client, remote), daemon=True).start()
        threading.Thread(target=forward_stream, args=(remote, client), daemon=True).start()
    except Exception:
        try:
            client.close()
        except Exception:
            pass

def start_listener(port, target_ip):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind(('0.0.0.0', port))
    except Exception as e:
        print(f'Bind failed on {port}: {e}', flush=True)
        return
    server.listen(128)
    print(f'Listening on 0.0.0.0:{port} -> {target_ip}:{port}', flush=True)
    while True:
        try:
            client, _ = server.accept()
            threading.Thread(target=handle_client, args=(client, target_ip, port), daemon=True).start()
        except Exception:
            break

if __name__ == '__main__':
    wsl_ip = get_wsl_ip()
    print(f'WSL2 Port Forwarder running for {wsl_ip}', flush=True)
    threading.Thread(target=start_listener, args=(80, wsl_ip), daemon=True).start()
    threading.Thread(target=start_listener, args=(443, wsl_ip), daemon=True).start()
    while True:
        time.sleep(1)
