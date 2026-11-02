import socket
import subprocess
import threading
import time

def handle_client(client, port):
    try:
        proc = subprocess.Popen(
            ['wsl', 'nc', '127.0.0.1', str(port)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE
        )
        def forward_sock_to_proc():
            try:
                while True:
                    data = client.recv(65536)
                    if not data:
                        break
                    proc.stdin.write(data)
                    proc.stdin.flush()
            except Exception:
                pass
            finally:
                try:
                    proc.stdin.close()
                except Exception:
                    pass

        def forward_proc_to_sock():
            try:
                while True:
                    data = proc.stdout.read(65536)
                    if not data:
                        break
                    client.sendall(data)
            except Exception:
                pass
            finally:
                try:
                    client.close()
                except Exception:
                    pass

        t1 = threading.Thread(target=forward_sock_to_proc, daemon=True)
        t2 = threading.Thread(target=forward_proc_to_sock, daemon=True)
        t1.start()
        t2.start()
        proc.wait()
    except Exception:
        try:
            client.close()
        except Exception:
            pass

def start_listener(port):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind(('127.0.0.1', port))
    except Exception as e:
        print(f'Bind failed on {port}: {e}', flush=True)
        return
    server.listen(128)
    print(f'Listening on 127.0.0.1:{port} -> WSL nc 127.0.0.1:{port}', flush=True)
    while True:
        try:
            client, _ = server.accept()
            threading.Thread(target=handle_client, args=(client, port), daemon=True).start()
        except Exception:
            break

if __name__ == '__main__':
    print('Starting WSL2 stdio pipe bridge for port 8000...', flush=True)
    threading.Thread(target=start_listener, args=(8000,), daemon=True).start()
    while True:
        time.sleep(1)
