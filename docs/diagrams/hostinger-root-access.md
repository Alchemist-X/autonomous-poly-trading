# Hostinger Root 访问方法

英文版见 [hostinger-root-access.en.md](hostinger-root-access.en.md)。

最后更新：2026-03-23

## 目标

这份文档记录本地如何安全地连接这台 Hostinger 主机，并明确凭据存放位置。

当前主机：

- Hostinger
- IP：`76.13.191.106`
- Hostname：`srv1383970.hstgr.cloud`
- 登录用户：`root`

## 本地存放方式

敏感信息单独放在本地环境文件：

- [deploy/hostinger/.env.hostinger-76.13.191.106](../deploy/hostinger/.env.hostinger-76.13.191.106)

说明：

- 该文件名以 `.env.` 开头，已被仓库根目录 `.gitignore` 规则忽略
- 该文件不应提交、不应上传、不应出现在公开文档里
- 建议权限保持 `600`

## 连接脚本

本地已准备连接脚本：

- [deploy/hostinger/ssh-root.expect](../deploy/hostinger/ssh-root.expect)

功能：

- 自动读取本地环境文件
- 自动接受首次 host key
- 使用 `expect` 自动输入密码
- 可选通过本地代理转发 SSH
- 支持交互登录
- 支持单条远程命令执行

## 使用方法

交互登录：

```bash
expect deploy/hostinger/ssh-root.expect
```

单条命令执行：

```bash
expect deploy/hostinger/ssh-root.expect "pwd"
expect deploy/hostinger/ssh-root.expect "ls -la /root"
```

如果本地开了代理，可以在环境文件里配置：

- `HOSTINGER_PROXY_TYPE=socks5`
- `HOSTINGER_PROXY_HOST=127.0.0.1`
- `HOSTINGER_PROXY_PORT=7890`

脚本会自动转成：

```bash
ssh -o "ProxyCommand=nc -X 5 -x 127.0.0.1:7890 %h %p" ...
```

## 已执行的测试范围

这份文档对应的操作目标包括：

1. 验证是否能成功登录
2. 验证是否能查看远程目录
3. 测试是否能创建新用户 `AutoPulse`

## 当前测试结果

截至 `2026-03-23`，本地已完成以下验证：

- `ping 76.13.191.106` 可通
- `nc -vz 76.13.191.106 22` 表示 TCP 22 端口可建立连接
- 但 `ssh` 和 `expect + ssh` 都在 `banner exchange` 阶段超时
- 本地当前公网出口 IP：`66.90.99.210`
- 通过本地 `socks5://127.0.0.1:7890` 代理后，公网出口 IP 变为 `50.7.158.234`
- 但代理后的 SSH 仍然在 `banner exchange` 阶段超时

当前实际结论：

- 不是密码错误
- 不是 IP 写错
- 不是本地脚本缺少 SSH 客户端
- 更像是远端 `sshd` 没有正常返回 SSH banner，或者被远端策略 / 中间层卡住

额外发现：

- `srv1383970.hstgr.cloud` 当前解析到 `28.0.2.63`
- 这与已知 IPv4 `76.13.191.106` 不一致
- 因此当前更可信的连接目标仍然是 IPv4 直连，而不是 hostname

因此当前还不能完成：

- 查看远程文件夹
- 创建 `AutoPulse` 用户

这说明：

- 问题不只是本地原始出口 IP
- 即使换了代理出口，远端入口仍然没有把 SSH banner 正常回给客户端

## 远端需要先检查的点

如果你能通过 Hostinger 控制台或 VNC 进入机器，优先检查：

```bash
systemctl status ssh
systemctl status sshd
ss -lntp | grep ':22'
journalctl -u ssh --no-pager -n 100
journalctl -u sshd --no-pager -n 100
```

同时建议在主机控制台内确认：

```bash
hostnamectl
ip addr
ss -lntp | grep ':22'
grep -n 'ListenAddress\\|Banner' /etc/ssh/sshd_config
```

再继续检查是否有规则针对 `66.90.99.210` 或当前入口链路做了拦截：

```bash
ufw status verbose
nft list ruleset
iptables -S
fail2ban-client status
grep -R "66.90.99.210" /var/log 2>/dev/null | tail -n 50
journalctl --since "30 min ago" | grep "66.90.99.210"
```

如果远端 SSH 服务正常，下一步应再次尝试：

```bash
expect deploy/hostinger/ssh-root.expect "pwd"
```

## AutoPulse 初始化

本地已准备一个控制台可执行脚本：

- [deploy/hostinger/bootstrap-autopulse.sh](../deploy/hostinger/bootstrap-autopulse.sh)

它会做这些事：

- 创建用户 `AutoPulse`
- 把 `AutoPulse` 加进 `sudo` 组
- 初始化 `/home/AutoPulse/.ssh`
- 创建空的 `authorized_keys`

如果你现在要在 Hostinger 控制台里直接做，复制这段即可：

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

执行完成后，再回传这几条输出：

```bash
id AutoPulse
getent passwd AutoPulse
ls -ld /home/AutoPulse /home/AutoPulse/.ssh
```

## 安全约束

- 不在文档中重复写明密码明文
- 不把环境文件改成可提交路径
- 不把远程凭据放进 Markdown、脚本参数、提交记录或公开日志
