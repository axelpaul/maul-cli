/** Read one line from the terminal (prompt goes to stderr). With hidden, input is not echoed. */
export function promptLine(question: string, opts: { hidden?: boolean } = {}): Promise<string> {
	return new Promise((resolve, reject) => {
		const stdin = process.stdin;
		process.stderr.write(question);
		const wasRaw = stdin.isRaw;
		if (stdin.isTTY) stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding("utf8");
		let value = "";

		const finish = (err?: Error) => {
			stdin.off("data", onData);
			if (stdin.isTTY) stdin.setRawMode(wasRaw);
			stdin.pause();
			process.stderr.write("\n");
			if (err) reject(err);
			else resolve(value);
		};

		const onData = (chunk: string) => {
			for (const ch of chunk) {
				if (ch === "\r" || ch === "\n" || ch === "\u0004") return finish();
				if (ch === "\u0003") return finish(new Error("Cancelled"));
				if (ch === "\u007f" || ch === "\b") {
					if (value.length > 0) {
						value = value.slice(0, -1);
						if (!opts.hidden) process.stderr.write("\b \b");
					}
					continue;
				}
				value += ch;
				if (!opts.hidden) process.stderr.write(ch);
			}
		};
		stdin.on("data", onData);
	});
}
