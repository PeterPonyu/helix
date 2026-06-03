#!/usr/bin/env node
<<<<<<< HEAD
import { APP_NAME } from "../config.js";
=======
import { APP_NAME } from "../config.ts";
>>>>>>> upstream/main

process.title = APP_NAME;
process.emitWarning = (() => {}) as typeof process.emitWarning;

<<<<<<< HEAD
import { restoreSandboxEnv } from "./restore-sandbox-env.js";

restoreSandboxEnv();

await import("./register-bedrock.js");
await import("../cli.js");
=======
import { restoreSandboxEnv } from "./restore-sandbox-env.ts";

restoreSandboxEnv();

await import("./register-bedrock.ts");
await import("../cli.ts");
>>>>>>> upstream/main
