#!/bin/sh
# Run one verification command with the Git distribution qualified for the amd64 CI image.
set -eu

test "$#" -gt 0
test "$(dpkg --print-architecture)" = amd64
root=$(mktemp -d "${RUNNER_TEMP:?}/qualified-git.XXXXXXXX")
trap 'rm -rf -- "$root"' 0
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

(
  umask 077
  cd "$root"
  mkdir bin
  snapshot=https://snapshot.debian.org/archive/debian/20261030T000000Z/pool/main/g/git
  git_deb=git_2.47.3-0+deb13u1_amd64.deb
  man_deb=git-man_2.47.3-0+deb13u1_all.deb
  fetch_package() {
    curl -q --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
      --max-time 90 --max-filesize "$2" --output "$1" "$snapshot/$1"
    printf '%s  %s\n' "$3" "$1" | sha256sum --check --strict
  }
  fetch_package "$git_deb" 8861572 3e35662fd5c46add561703e54031a1d8ad9df45811927689f0a51122b13be722
  fetch_package "$man_deb" 2204692 b58306b60e1dff920e1e18bc7e1e499f2ef75184190ab3d98657b165969bf7c9
  dpkg-deb --extract "$git_deb" payload
  dpkg-deb --extract "$man_deb" payload

  cat >bin/git <<'SH'
#!/bin/sh
set -eu
bin=$(CDPATH= cd -P "$(dirname "$0")" && pwd)
prefix="$bin/../payload/usr"
export GIT_EXEC_PATH="$prefix/lib/git-core" GIT_TEMPLATE_DIR="$prefix/share/git-core/templates" PERL5LIB="$prefix/share/perl5"
exec "$prefix/bin/git" "$@"
SH
  chmod 700 bin/git
)

PATH="$root/bin:$root/payload/usr/bin:$PATH"
export PATH
test "$(command -v git)" = "$root/bin/git"
test "$(git --no-optional-locks --no-replace-objects --no-lazy-fetch -c core.fsmonitor=false -c core.untrackedCache=false version)" = 'git version 2.47.3'
"$@"
