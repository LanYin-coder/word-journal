#!/bin/zsh
cd -- "${0:A:h}"
if curl -fsS --max-time 2 http://127.0.0.1:8791/api/state >/dev/null 2>&1; then
  open http://127.0.0.1:8791
  exit 0
fi
(sleep 1; open http://127.0.0.1:8791) &
python3 server.py --port 8791
