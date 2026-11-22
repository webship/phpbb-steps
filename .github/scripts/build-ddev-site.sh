#!/usr/bin/env bash
# Builds the site the suite runs against, in a DDEV project: a phpBB board (GPL-2.0) from its release package,
# installed with its own command-line installer (install/phpbbcli.php install) on the project's database, with
# its default style, and the accounts of the test users and the test content:
#
#   - https://<project>.ddev.site/        the board (the release in phpbb/, the docroot), served by Apache with
#                                          the release's own rules (.htaccess);
#   - https://<project>.ddev.site:8026    the project's mail catcher (Mailpit), which the board sends its mail to.
#
# The board is set up for testing with site/phpbb-site.php, run by PHP in the web container with the board's
# own code: the same script the Webship Workspace's plugin runs. It takes the waiting times between posts and
# searches away, the limit of failed logins and the visual confirmation of the registration form (every request
# of a run comes from one address), sends mail at once, and keeps a new member's posts waiting for approval.
# The folder of the installer is removed after the install, as the board asks. The extension the release
# bundles and its installer turns on (a link service of a company) is turned off and removed from the database:
# the suite runs on the board itself.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME          the DDEV project name                          (default phpbbsteps)
#   SITE_DIR              the project folder                             (default a new temporary folder)
#   PHPBB_VERSION         the release                                    (default 3.3.19)
#   PHP_VERSION           the PHP of the web container                   (default 8.3)
#   ACCOUNT_PASSWORD      the password of the accounts below            (default dD.123123ddd)
#   BUILD_ADMIN           the administrator the installer makes, for the build only   (default admin)
#   BUILD_ADMIN_PASSWORD  its password                                   (default ACCOUNT_PASSWORD)
#   ACCOUNTS_ONLY         1: build nothing, give the accounts of the board in SITE_DIR back their password,
#                         address, kind and groups (after a run that was stopped half way)
#   TIDY_ONLY             1: build nothing, remove what a run that was stopped half way left on the board in
#                         SITE_DIR (the topics and messages titled "Webship test …", open reports, the drafts,
#                         bookmarks, votes and signatures of the accounts)
#
# The accounts are configuration: this script makes them and cucumber.js names them; the features never create
# or delete one. Each logs in with its user name.
#   administrator  administrator@example.com  a founder: the administration control panel, and a moderator
#   moderator      moderator@example.com      a global moderator: the moderator control panel, in every forum
#   member         member@example.com         a registered user
#   newmember      newmember@example.com      a newly registered user: its posts wait for approval
#
# No hosted service, no account anywhere, nothing that is not open source.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-phpbbsteps}"
PHPBB_VERSION="${PHPBB_VERSION:-3.3.19}"
PHP_VERSION="${PHP_VERSION:-8.3}"
ACCOUNT_PASSWORD="${ACCOUNT_PASSWORD:-dD.123123ddd}"
BUILD_ADMIN="${BUILD_ADMIN:-admin}"
BUILD_ADMIN_PASSWORD="${BUILD_ADMIN_PASSWORD:-$ACCOUNT_PASSWORD}"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../site" && pwd)/phpbb-site.php"
ROOT=/var/www/html
BOARD="${ROOT}/phpbb"
HOST="${PROJECT_NAME}.ddev.site"
SITE_URL="https://${HOST}"

# The release line of a version: 3.3 for 3.3.19.
LINE="$(printf '%s' "$PHPBB_VERSION" | cut -d. -f1,2)"
PACKAGE="https://download.phpbb.com/pub/release/${LINE}/${PHPBB_VERSION}/phpBB-${PHPBB_VERSION}.tar.bz2"

# site/phpbb-site.php with the board's PHP, in the board's folder. The accounts travel as base64 of a JSON object,
# in a first line before the script on PHP's standard input: never on a command line, never in a file.
site_script() {
  local accounts
  accounts="$(ACCOUNT_PASSWORD="$ACCOUNT_PASSWORD" python3 -c '
import base64, json, os
p = os.environ["ACCOUNT_PASSWORD"]
print(base64.b64encode(json.dumps({"accounts": [
    {"name": "administrator", "email": "administrator@example.com", "password": p, "role": "founder"},
    {"name": "moderator", "email": "moderator@example.com", "password": p, "role": "moderator"},
    {"name": "member", "email": "member@example.com", "password": p, "role": "member"},
    {"name": "newmember", "email": "newmember@example.com", "password": p, "role": "newmember"},
]}).encode()).decode())')"
  { printf '<?php $SITE_PAYLOAD = "%s"; ?>' "$accounts"; cat "$SCRIPT"; } | ddev exec -d "$BOARD" "php -- $*"
}

# The board's own command-line tool.
board_cli() {
  ddev exec -d "$BOARD" "php bin/phpbbcli.php --no-ansi $*" < /dev/null
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  site_script accounts
  exit 0
fi
if [ "${TIDY_ONLY:-}" = "1" ]; then
  site_script tidy
  exit 0
fi

# A project of this name from an earlier build goes first, with its database.
if ddev describe "$PROJECT_NAME" > /dev/null 2>&1; then
  ddev delete -Oy "$PROJECT_NAME" < /dev/null
fi
rm -rf phpbb .ddev

# A PHP project served by Apache (the release's .htaccess rules), from phpbb/, with the project's database
# (MariaDB) and Node.js 24 for a test suite run in the web container (the board itself needs none).
ddev config --project-type=php --docroot=phpbb --webserver-type=apache-fpm --php-version="$PHP_VERSION" \
  --project-name="$PROJECT_NAME" --nodejs-version=24 < /dev/null

cat > .ddev/config.phpbb.yaml <<YAMLEOF
# The board of this project (written by the build script of the step pack): its release.
web_environment:
  - PHPBB_VERSION=${PHPBB_VERSION}
YAMLEOF

ddev start -y < /dev/null

# The release package, checked against the sum its publisher gives beside it.
echo "Getting phpBB ${PHPBB_VERSION}."
ddev exec "set -e; cd /tmp && curl -sSfL -o phpbb.tar.bz2 '${PACKAGE}' && curl -sSfL -o phpbb.sha256 '${PACKAGE}.sha256' \
  && echo \"\$(cut -d' ' -f1 phpbb.sha256)  phpbb.tar.bz2\" | sha256sum -c - \
  && mkdir -p ${BOARD} && tar -xjf phpbb.tar.bz2 --strip-components=1 -C ${BOARD} && rm -f phpbb.tar.bz2 phpbb.sha256" < /dev/null

# The settings of the installer: the project's database, the project's address, mail over SMTP to the mail
# catcher of the web container. The file holds the password of the build's administrator, so it is written
# with the folder of the installer, which goes after the install.
ddev exec "cat > ${BOARD}/install/install-config.yml" <<CONFIGEOF
installer:
    admin:
        name: ${BUILD_ADMIN}
        password: ${BUILD_ADMIN_PASSWORD}
        email: ${BUILD_ADMIN}@example.com
    board:
        lang: en
        name: Webship test board
        description: A board for the step definitions
    database:
        dbms: mysqli
        dbhost: db
        dbport: 3306
        dbuser: db
        dbpasswd: db
        dbname: db
        table_prefix: phpbb_
    email:
        enabled: true
        smtp_delivery: true
        smtp_host: localhost
        smtp_port: 1025
        smtp_auth: PLAIN
        smtp_user: ~
        smtp_pass: ~
    server:
        cookie_secure: true
        server_protocol: https://
        force_server_vars: true
        server_name: ${HOST}
        server_port: 443
        script_path: /
    extensions: []
CONFIGEOF

ddev exec -d "$BOARD" "php install/phpbbcli.php install install/install-config.yml --no-ansi --quiet" < /dev/null
# The board refuses to work for anyone but its administrators while the folder of the installer is there.
ddev exec "rm -rf ${BOARD}/install" < /dev/null

# The extension the release bundles: off, and out of the database.
if board_cli extension:show | grep -q 'phpbb/viglink'; then
  board_cli extension:disable phpbb/viglink > /dev/null || true
  board_cli extension:purge phpbb/viglink > /dev/null || true
fi

# The settings of a test run, the accounts, the test content.
site_script settings accounts content

code=""
for attempt in $(seq 1 30); do
  code="$(ddev exec "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/index.php" < /dev/null 2>/dev/null | tr -d '\r' || true)"
  [ "$code" = "200" ] && break
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "The board did not answer (${code}); the end of the web container's log:" >&2
  ddev logs -s web --tail 60 < /dev/null >&2 || true
  exit 1
fi

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
RELEASE="$(site_script version < /dev/null | tr -d '\r' | tail -n 1)"
echo "Built ${RELEASE} at ${SITE_URL}, its mail at ${SITE_URL}:8026"
