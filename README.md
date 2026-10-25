# maul-cli

Command-line tool and MCP server for [Maul](https://app.maul.is) (máltíðir), the Icelandic workplace lunch-ordering service. Browse the weekly menu, see and place your orders, and cancel days, from the terminal or through an AI assistant.

> Unofficial — not affiliated with Maul. It talks to the same API the Maul web app uses, which is undocumented and may change without notice.

## Install

Requires [Bun](https://bun.sh) ≥ 1.1.

```sh
bun add -g github:axelpaul/maul-cli     # install
bun add -g github:axelpaul/maul-cli     # update (re-run; pulls the latest default branch)
bun remove -g maul-cli                  # uninstall
```

This installs the `maul` command into `~/.bun/bin`.

Prefer a single file without Bun? Download a prebuilt binary (`maul-linux-x64`, `maul-darwin-arm64`, `maul-windows-x64.exe`, …) from the [Releases page](https://github.com/axelpaul/maul-cli/releases), check it against `SHA256SUMS`, make it executable and put it on your `PATH`. On macOS you may need `xattr -d com.apple.quarantine maul-darwin-*` the first time.

## Authentication

Maul accounts are created by your employer. Log in with the same email and password you use at app.maul.is:

```sh
maul login you@example.com      # prompts for the password (not echoed)
maul status                     # check the cached session
maul logout                     # delete the cached session
```

For non-interactive use, set `MAUL_USERNAME` and `MAUL_PASSWORD` and run `maul login`. Passing the password as a second argument (`maul login <email> <password>`) also works but leaves it in your shell history.

Login uses AWS Cognito (SRP, so the password is never sent in clear). The access token, a refresh token and your user/location IDs are cached in `~/.config/maul-cli/token.json` (mode 600). Expired access tokens are refreshed automatically, so you normally only log in once until the refresh token expires.

Your employer's location is read from your Maul profile at login; nothing company-specific is built into the tool.

## CLI usage

```sh
maul menu                                   # next week's menu, with item IDs
maul menu -w 2026-W44                       # a specific ISO week
maul orders                                 # your orders for next week
maul orders -w 2026-W44
maul order-submit -w 2026-W44 -m '{"1":"pad thai chicken","3":"fish"}'
maul order-cancel -w 2026-W44 -d 3          # cancel Wednesday
maul me                                     # your profile
maul admin-orders --date 2026-10-26         # everyone's orders at your location (admin accounts only)
maul serve                                  # MCP server on stdio
maul --version
```

`order-submit` takes a JSON map of weekday (1 = Monday … 5 = Friday) to either an exact menu item ID (from `maul menu`) or free text. Free text is fuzzy-matched against that day's menu (English and Icelandic names, descriptions, restaurant); a low-confidence match is refused rather than guessed.

Output is human-readable in a terminal and JSON when piped. Force either with `--json` or `--pretty`. `maul --help --json` prints a machine-readable command list.

## MCP server

`maul serve` runs an MCP server over stdio. It uses the same client code and the same cached login as the CLI, so run `maul login` once first. Login itself is not exposed as a tool (it would mean handing your password to the model); `logout` is a local file operation and is also CLI-only.

| Tool | Access | Description |
| --- | --- | --- |
| `auth_status` | read | Whether a login is cached, for which email/location, and token expiry |
| `me` | read | Your Maul profile |
| `menu` | read | Menu items for an ISO week (optionally one weekday), with item IDs |
| `orders` | read | Your orders for an ISO week |
| `admin_orders` | read | All orders at your location for a date. Only works for Maul admin accounts and returns colleagues' names/emails |
| `order_submit` | write | Order one weekday by exact menu item ID; `confirmItemId` must repeat the ID. Refuses if that day already has an order |
| `order_cancel` | write | Cancel one weekday's order; `confirmItemId` must equal the ID of the order being cancelled |

Write tools are hidden unless the server is started with `MAUL_MCP_ENABLE_WRITES=1`. Even then each call needs the explicit confirmation argument. The MCP `order_submit` deliberately takes exact item IDs for one day at a time; the CLI's fuzzy, multi-day `order-submit` is not exposed so the model cannot order something it guessed. Only enable writes in a client that asks you before running tool calls.

Menu text and your order history are sent to the MCP client when those tools are called.

**Claude Code**

```sh
claude mcp add maul -- maul serve
# with write tools:
claude mcp add maul -e MAUL_MCP_ENABLE_WRITES=1 -- maul serve
```

**Claude Desktop, Cursor and other JSON-configured clients**

```json
{
  "mcpServers": {
    "maul": {
      "command": "maul",
      "args": ["serve"],
      "env": { "MAUL_MCP_ENABLE_WRITES": "1" }
    }
  }
}
```

Leave out `env` for read-only access. GUI apps often don't have `~/.bun/bin` on their `PATH`; if the server fails to start, use the absolute path printed by `which maul` as `command`.

## Configuration

| Variable | Description |
| --- | --- |
| `MAUL_USERNAME`, `MAUL_PASSWORD` | Credentials for non-interactive `maul login` |
| `MAUL_MCP_ENABLE_WRITES` | Set to `1` to expose `order_submit` and `order_cancel` in `maul serve` |
| `MAUL_API_URL` | API base URL. Default `https://dev-api.maul.is` (the host the Maul web app calls) |
| `MAUL_COGNITO_USER_POOL_ID` | Cognito user pool. Default `eu-west-1_KkkgJsbfo` |
| `MAUL_COGNITO_CLIENT_ID` | Cognito app client. Default `2qavs2k3odmgef85si7bv02qjb` |
| `MAUL_CONFIG_DIR` | Where the session is cached. Default `$XDG_CONFIG_HOME/maul-cli` or `~/.config/maul-cli` |

The Cognito pool and client IDs are the public ones built into the Maul web app and shared by every Maul user. They are only overridable in case Maul changes them. The older variable names `USER_POOL_ID`, `CLIENT_ID`, `SERVICE_ACCOUNT_USERNAME` and `SERVICE_ACCOUNT_PASSWORD` are still read as fallbacks, and a session cached by earlier versions in `~/.maularinn/token.json` is still picked up.

## Development

```sh
git clone https://github.com/axelpaul/maul-cli.git
cd maul-cli
bun install
bun link                 # puts a development `maul` on your PATH
bun run check            # biome lint + tsc + bun test
bun run build            # standalone binary in dist/maul
```

Source layout: `src/lib/maul-client.ts` is the HTTP client, `src/lib/actions.ts` holds operations shared by `src/commands/*` (CLI) and `src/mcp/server.ts` (MCP). Releases are built by `.github/workflows/release.yml` when a `v*` tag is pushed.

API notes:

- Menus: `GET /location/{locationId}/menus/{isoWeek}?fspId=maul`
- Orders: `GET /users/{userId}/orders/{isoWeek}/v2` (404 means no orders)
- Submit: `POST /orders` with `{UserId, OrderItems[]}`
- Cancel: `POST /users/{userId}/orders/cancel` with `{mealTime, menuItemId, orderDate, restaurantId}`
- Admin: `GET /locations/{locationId}/orders/{date}`

## License

MIT
