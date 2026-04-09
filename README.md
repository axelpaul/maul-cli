# maul

CLI for the [Maularinn](https://app.maul.is) lunch ordering system.

## Install

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/axelpaul/maul-cli.git
cd maul-cli
bun install
bun link
```

This makes the `maul` command available globally.

## Usage

```bash
# Authenticate
maul login <username> <password>

# View next week's menu
maul menu

# View your orders
maul orders

# Place an order
maul order-submit -w 2026-W16 -m '{"1":"item.id.lunch.mon","2":"item.id.lunch.tue"}'

# Cancel a day
maul order-cancel -w 2026-W16 -d 3

# View your profile
maul me

# Check auth status
maul status

# Admin: view all orders for a date
maul admin-orders --date 2026-04-13

# Log out
maul logout
```

## JSON output

All commands support `--json` for machine-readable output:

```bash
maul menu --json
maul orders --json
```

## Build

Compile to a single binary:

```bash
bun run build
```
