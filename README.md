# maul-cli

A small CLI for [Maul](https://app.maul.is) — the lunch ordering system. Browse the weekly menu, pick your meals, and submit orders without leaving the terminal.

## Getting started

You'll need [Bun](https://bun.sh) installed.

```bash
git clone https://github.com/axelpaul/maul-cli.git
cd maul-cli
bun install
bun link
```

That's it — `maul` is now available globally.

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
