#!/bin/sh
# Egress firewall for a Fleet container. Runs as root inside the container, before the server or
# the agent starts (docker-entrypoint.sh, opt-in via FLEET_FIREWALL=1), and needs
# --cap-add NET_ADMIN --cap-add NET_RAW.
#
# WHAT IT CLOSES, and it was measured rather than imagined: a container on this host could reach
# the owner's tailnet. From inside, `curl http://<owner-tailscale-ip>:8790/` answered 200 on the
# live fleet's login page (the API answered 401, so the token gate held — but "protected by a
# token" is weaker than "cannot get there"). The concern is not the container's occupant; it is the
# AGENT running in it, which with --dangerously-skip-permissions and a hostile repository can be
# made to knock on every address it can route to. That is the whole reason a sandboxed agent gets
# a network boundary and not just a filesystem one.
#
# SHAPE: a DENYLIST of the owner's private space, not an allowlist of the internet. That is a
# deliberate trade and the reasoning matters more than the rules:
#
#   * An allowlist (Anthropic's init-firewall.sh does this: DROP by default, permit the Anthropic
#     API, GitHub, npm) is strictly stronger against exfiltration. It also breaks ordinary work —
#     a push to a remote nobody listed in advance just hangs, with no sign of why — and an
#     allowlist that gets disabled the first time it bites protects nothing.
#   * The measured risk was reachability into the owner's network. That is exactly what a denylist
#     of RFC1918 + CGNAT + link-local removes, completely and without maintenance.
#
# SO BE CLEAR ABOUT WHAT THIS DOES NOT DO: it does not stop a compromised agent from sending data
# to the internet. If that is in scope, this file is the wrong tool and the allowlist is the right
# one — see docs/container.md.

set -eu

command -v iptables >/dev/null 2>&1 || { echo "container-firewall: iptables missing" >&2; exit 1; }

# Order matters. ESTABLISHED/RELATED is accepted FIRST, and it is load-bearing rather than
# boilerplate: a reply to an inbound dashboard request is an OUTPUT packet addressed back to the
# client, and the client here is the host, reached through the docker bridge in 172.16.0.0/12 —
# one of the ranges blocked below. Without this rule the published port would answer nothing and
# look like a dead server.
iptables -F OUTPUT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# DNS, to the resolvers this container was actually given, and this rule is why the file reads
# resolv.conf instead of hardcoding anything. The runtime's resolver commonly sits INSIDE one of
# the ranges rejected below — measured here: 192.168.5.1 under colima. Blocking it does not look
# like a DNS failure from the outside; it looks like the whole internet is gone, while a request
# to a bare IP still works. That is the exact symptom this rule prevents.
#
# Derived and narrow on purpose: permitting port 53 to ANY destination (what the reference
# implementation does) would leave a usable path to a resolver inside the owner's tailnet. Only
# the addresses in resolv.conf are opened, and only for DNS.
for ns in $(awk '/^nameserver/ {print $2}' /etc/resolv.conf 2>/dev/null); do
  case "$ns" in *:*) continue ;; esac   # v6 resolvers are handled in the v6 block below
  iptables -A OUTPUT -d "$ns" -p udp --dport 53 -j ACCEPT
  iptables -A OUTPUT -d "$ns" -p tcp --dport 53 -j ACCEPT
done

# The owner's private space. 100.64.0.0/10 is the CGNAT range Tailscale assigns from, so it covers
# the whole tailnet — the fleet, the phone, every other node — not just the address measured.
# 169.254.0.0/16 is link-local and includes the cloud metadata address, which matters the day this
# image runs on a rented box instead of a laptop.
for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16; do
  iptables -A OUTPUT -d "$net" -j REJECT --reject-with icmp-net-unreachable
done

# IPv6, if the stack is there at all. Skipped silently when it is not — a container without IPv6
# needs no IPv6 rules, and failing here would be a false alarm. fd7a:115c:a1e0::/48 is Tailscale's
# own ULA prefix: without it the tailnet stays reachable over v6 and the v4 rules above are theatre.
if command -v ip6tables >/dev/null 2>&1 && ip6tables -L OUTPUT >/dev/null 2>&1; then
  ip6tables -F OUTPUT
  ip6tables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  ip6tables -A OUTPUT -o lo -j ACCEPT
  for net in fd7a:115c:a1e0::/48 fc00::/7 fe80::/10; do
    ip6tables -A OUTPUT -d "$net" -j REJECT 2>/dev/null || true
  done
fi

echo "container-firewall: private ranges rejected (tailnet, RFC1918, link-local); internet open"
