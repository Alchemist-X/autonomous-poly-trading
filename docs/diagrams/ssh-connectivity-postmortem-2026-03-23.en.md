# SSH Connectivity Postmortem (2026-03-23)

Chinese version: [ssh-connectivity-postmortem-2026-03-23.md](ssh-connectivity-postmortem-2026-03-23.md).

Last updated: 2026-03-23

## Conclusion

The real dividing line in this incident was not "whether the account was configured correctly", but "whether external SSH traffic actually reached the target machine".

Final conclusion:

- SSH itself was healthy inside the Hostinger machine
- but external SSH traffic did not reliably reach that guest VM
- SSH was also healthy inside the Aliyun machine
- once SSH was moved to `443`, external traffic reached the machine and completed public key login

## Why Hostinger Failed

Verified facts:

- `sshd` was healthy inside the host
- the host could reach `127.0.0.1:22` and receive the SSH banner
- the host could also reach `76.13.191.106:22` from inside and receive the SSH banner
- the `AutoPulse` user, public key, `ufw`, and `fail2ban` were all checked and were not the main issue

External behavior:

- local connections to `76.13.191.106:22` appeared to complete TCP setup
- but the SSH client often stalled at `banner exchange timeout`
- and sometimes the connection was closed even earlier

Most important evidence:

- when packet capture was run inside the Hostinger machine for the external source IP, `tcpdump` captured `0 packets`
- and `journalctl -u ssh` showed no matching external SSH log entry

This means:

- external SSH traffic never reliably reached that Ubuntu guest
- the problem was not the in-guest SSH configuration itself
- it was more likely in front of the VM: edge handling, forwarding, or upstream network path

## Why Aliyun Worked

The Aliyun machine had clearer and more controllable conditions:

- healthy `sshd`
- working web terminal
- public key successfully written to the `admin` user
- firewall rules under direct control

Most importantly, Aliyun used a different entry path:

- not `22`
- but `443`

Verified facts:

- `47.85.38.253:443` returned a valid SSH banner
- the SSH handshake completed key exchange
- the server accepted the public key
- login to `admin` succeeded

The success marker was:

- `Authenticated to 47.85.38.253 ([47.85.38.253]:443) using "publickey".`

That means:

- the local key setup was not wrong
- the Aliyun server itself was not broken
- the key difference was that `443` was a working SSH path while `22` was unreliable under the current local network / VPN path

## What Root Cause This Really Exposed

This looks like two factors stacked together:

1. the current local network / VPN path is very unfriendly to SSH over `22`
2. Hostinger's edge path is more opaque, and external traffic did not even reliably reach the guest VM

That also explains why:

- Hostinger `22` failed
- Aliyun `22` also failed
- but Aliyun `443` worked

## Can Hostinger Use 443

Yes, but this needs to be split into "technically possible" and "proven to work here".

Technically possible:

- if Hostinger's `sshd` listens on `443`
- and both in-guest and panel-side firewall rules allow `443`
- then it can use SSH over `443`, just like Aliyun

But this turn did not complete a real Hostinger `443` test, so it is not correct to claim it will definitely work.

Why:

- the core Hostinger problem was not account setup
- the bigger issue was that external SSH traffic did not reliably reach the guest VM
- if that break happens in front of the VM, switching to `443` may still fail

So the accurate statement is:

- Hostinger over `443` is technically feasible
- but whether it fixes this specific problem still requires a real test
- it cannot be assumed from theory alone

## Current Recommendation

If the goal is to keep deployment moving:

- continue with Aliyun first
- use `admin@47.85.38.253:443`
- use the local dedicated key `id_ed25519_autopulse`

If Hostinger needs to be revisited later:

- enter the machine through the Hostinger console
- add `Port 443` to `sshd`
- allow `443`
- then run a separate external validation

## Reusable Takeaways

- "SSH is listening" does not mean "external login must work"
- the most important diagnostic move is verifying whether external traffic really enters the guest VM
- under the current local network / VPN path, `22` should no longer be the default SSH entry
- for this environment, the more reliable default is `SSH over 443`
