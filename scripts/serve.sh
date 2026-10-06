#!/bin/sh
# reinicia o servidor de produção na porta 3100
fuser -k 3100/tcp >/dev/null 2>&1
sleep 1
nohup npx next start -p 3100 > /tmp/claude-0/next.log 2>&1 &
sleep 3
