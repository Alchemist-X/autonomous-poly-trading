# Hostinger Root Access Method

Chinese version: [hostinger-root-access.md](hostinger-root-access.md).

Last updated: 2026-03-23

## Goal

This document records how to connect locally to this Hostinger host in a controlled way and where the credentials are stored.

Current host:

- Hostinger
- IP: `76.13.191.106`
- hostname: `srv1383970.hstgr.cloud`
- login user: `root`

## Local storage

Sensitive values are stored in a separate local environment file:

- [deploy/hostinger/.env.hostinger-76.13.191.106](../deploy/hostinger/.env.hostinger-76.13.191.106)

Notes:

- the filename starts with `.env.` and is ignored by the repository-level `.gitignore`
- this file must not be committed, uploaded, or copied into public docs
- the recommended file mode is `600`

## Connection script

A local connection script is prepared:

- [deploy/hostinger/ssh-root.expect](../deploy/hostinger/ssh-root.expect)

It does the following:

- reads the local environment file
- accepts the host key on first connect
- uses `expect` to send the password
- can optionally route SSH through a local proxy
- supports interactive login
- supports one-shot remote commands

## Usage

Interactive login:

```bash
expect deploy/hostinger/ssh-root.expect
```

Run a single remote command:

```bash
expect deploy/hostinger/ssh-root.expect "pwd"
expect deploy/hostinger/ssh-root.expect "ls -la /root"
```

If a local proxy is enabled, the environment file can include:

- `HOSTINGER_PROXY_TYPE=socks5`
- `HOSTINGER_PROXY_HOST=127.0.0.1`
- `HOSTINGER_PROXY_PORT=7890`

The script will translate that into:

```bash
ssh -o "ProxyCommand=nc -X 5 -x 127.0.0.1:7890 %h %p" ...
```

## Intended test scope

The operations tied to this document include:

1. verify login works
2. verify remote directories can be listed
3. test whether a new user `AutoPulse` can be created

## Current test result

As of `2026-03-23`, the local machine has confirmed:

- `ping 76.13.191.106` succeeds
- `nc -vz 76.13.191.106 22` confirms TCP port 22 accepts a connection
- but both `ssh` and `expect + ssh` time out during the `banner exchange`
- current public egress IP from this local environment: `66.90.99.210`
- after routing through the local `socks5://127.0.0.1:7890` proxy, the public egress IP becomes `50.7.158.234`
- but SSH still times out during the `banner exchange` even through the proxy

Current conclusion:

- this is not a bad password
- this is not the wrong IP
- this is not a missing local SSH client
- it is more consistent with a remote `sshd` that is not returning a proper SSH banner, or an upstream policy / middle layer stalling the handshake

Additional finding:

- `srv1383970.hstgr.cloud` currently resolves to `28.0.2.63`
- that does not match the known IPv4 `76.13.191.106`
- for now, the IPv4 address is the more trustworthy SSH target than the hostname

Because of that, the following could not be completed yet:

- listing remote folders
- creating the `AutoPulse` user

This means:

- the issue is not limited to the original local egress IP
- even after changing the egress path through a proxy, the remote side still does not return a usable SSH banner to the client

## Remote checks required first

If you can reach the machine through the Hostinger console or VNC, check these first:

```bash
systemctl status ssh
systemctl status sshd
ss -lntp | grep ':22'
journalctl -u ssh --no-pager -n 100
journalctl -u sshd --no-pager -n 100
```

Also confirm this directly inside the server console:

```bash
hostnamectl
ip addr
ss -lntp | grep ':22'
grep -n 'ListenAddress\\|Banner' /etc/ssh/sshd_config
```

Then check whether any rule is blocking `66.90.99.210` or the current SSH ingress path:

```bash
ufw status verbose
nft list ruleset
iptables -S
fail2ban-client status
grep -R "66.90.99.210" /var/log 2>/dev/null | tail -n 50
journalctl --since "30 min ago" | grep "66.90.99.210"
```

If remote SSH service is healthy after that, retry with:

```bash
expect deploy/hostinger/ssh-root.expect "pwd"
```

## AutoPulse bootstrap

A console-ready local script is prepared:

- [deploy/hostinger/bootstrap-autopulse.sh](../deploy/hostinger/bootstrap-autopulse.sh)

It does the following:

- creates the `AutoPulse` user
- adds `AutoPulse` to the `sudo` group
- initializes `/home/AutoPulse/.ssh`
- creates an empty `authorized_keys`

If you want to do it directly in the Hostinger console now, paste this:

```bash
cat >/root/bootstrap-autopulse.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

USERNAME="${1:-AutoPulse}"
USER_HOME="/home/${USERNAME}"

echo "[INFO] stage=user-check user=${USERNAME}"
if id -u "${USERNAME}" >/dev/null 2>&1; then
  echo "[WARN] user already exists: ${USERNAME}"
else
  useradd -m -s /bin/bash "${USERNAME}"
  echo "[OK] created user: ${USERNAME}"
fi

echo "[INFO] stage=sudo-check user=${USERNAME}"
if id -nG "${USERNAME}" | tr ' ' '\n' | grep -qx sudo; then
  echo "[WARN] user already in sudo group: ${USERNAME}"
else
  usermod -aG sudo "${USERNAME}"
  echo "[OK] added user to sudo group: ${USERNAME}"
fi

echo "[INFO] stage=ssh-dir user=${USERNAME}"
install -d -m 700 -o "${USERNAME}" -g "${USERNAME}" "${USER_HOME}/.ssh"
touch "${USER_HOME}/.ssh/authorized_keys"
chown "${USERNAME}:${USERNAME}" "${USER_HOME}/.ssh/authorized_keys"
chmod 600 "${USER_HOME}/.ssh/authorized_keys"
echo "[OK] initialized ${USER_HOME}/.ssh"

echo "[INFO] stage=verify user=${USERNAME}"
id "${USERNAME}"
getent passwd "${USERNAME}"
ls -ld "${USER_HOME}"
ls -ld "${USER_HOME}/.ssh"
ls -l "${USER_HOME}/.ssh/authorized_keys"
EOF

chmod 700 /root/bootstrap-autopulse.sh
/root/bootstrap-autopulse.sh
```

After it finishes, send back the output of:

```bash
id AutoPulse
getent passwd AutoPulse
ls -ld /home/AutoPulse /home/AutoPulse/.ssh
```

## Safety constraints

- do not restate the plaintext password in Markdown
- do not move the environment file into a tracked path
- do not place remote credentials into public docs, script arguments, commit history, or shared logs
