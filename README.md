# maul-cli

## MCP (local stdio pilot)

Run the compiled `maul` binary with `serve` to expose read-only `menu` and
`orders` tools. Both use the existing Maul client and locally cached CLI login.
An `order_submit` tool appears only when `MAUL_MCP_ENABLE_WRITES=1` is set at
startup. It requires an exact menu item ID and matching confirmation, and
refuses to replace an existing order for that weekday. The MCP server does not
offer login, cancellation, or admin tools. Register the binary's absolute path
and `serve` argument with your MCP client. Menu descriptions and your order
history are sent to that client when those tools are called. This is a local
pilot, not a published installer yet. Do not enable write tools without a
client-side user approval step.

A small CLI for [Maul](https://app.maul.is) the lunch ordering system. Browse the weekly menu, pick your meals, and submit orders without leaving the terminal, or have your agent do it for you. 

## Getting started

You'll need [Bun](https://bun.sh) installed.

```bash
git clone https://github.com/axelpaul/maul-cli.git
cd maul-cli
bun install
bun link
```

That's it `maul` is now available globally.

## Commands

```bash
maul login <username> <password>    # log in with your Maul credentials
maul menu                           # see next week's menu
maul orders                         # see what you've ordered
maul order-submit -w 2026-W16 -m '{"1":"item.id.lunch.mon"}'  # place an order
maul order-cancel -w 2026-W16 -d 3  # cancel Wednesday
maul me                             # your profile
maul status                         # check if you're logged in
maul logout                         # log out
```

Admin:
```bash
maul admin-orders --date 2026-04-13
```

All commands support `--json` for machine-readable output, handy if you're wiring this up to something else.

## Building a binary

```bash
bun run build    # produces a standalone ./maul binary
```
