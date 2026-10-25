if [[ -t 0 && "$(tty)" == /dev/tty2 && -z "${SLQ_SHELL_STARTED:-}" ]]; then
  export SLQ_SHELL_STARTED=1
  exec /usr/local/bin/slq-os
fi
