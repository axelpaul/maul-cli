import { expect, test } from "bun:test";

 test("large JSON remains complete through a slow pipe reader", async () => {
 const source = new URL("../src/lib/output.ts", import.meta.url).pathname;
 const child = Bun.spawn([process.execPath, "-e", `import { outputJson } from ${JSON.stringify(source)}; outputJson({text: "á".repeat(200000)});`], { stdout: "pipe", stderr: "pipe" });
 await Bun.sleep(50);
 const output = await new Response(child.stdout).text();
 expect(await child.exited).toBe(0);
 expect(JSON.parse(output).text).toBe("á".repeat(200000));
});
