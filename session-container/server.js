/**
 * Azure Container Apps Dynamic Sessions — Session Executor Server
 *
 * Runs inside an isolated Hyper-V container and accepts code/command
 * execution requests via HTTP. Used by the azure session strategy.
 */

import { createServer } from "node:http";
import { execFile, exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const PORT = 8080;

function jsonResponse(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function handleExecute(req, res) {
  if (req.method === "GET") {
    return jsonResponse(res, 200, { message: "Execute endpoint is working" });
  }

  let data;
  try {
    data = await parseBody(req);
  } catch {
    return jsonResponse(res, 400, { error: "Invalid JSON" });
  }

  // Support both nested properties and top-level fields
  const props = data.properties ?? {};
  const code = props.code ?? data.code ?? "";
  const shellCommand = props.shellCommand ?? data.shellCommand ?? data.command ?? "";
  const language = props.language ?? data.language ?? "bash";
  const timeout = (props.timeoutInSeconds ?? data.timeoutInSeconds ?? data.timeout ?? 30) * 1000;

  if (!code && !shellCommand) {
    return jsonResponse(res, 400, { error: "No code or command provided" });
  }

  try {
    let stdout = "";
    let stderr = "";
    let returnCode = 0;

    if (shellCommand) {
      const result = await execAsync(shellCommand, {
        timeout,
        cwd: "/workspace",
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } else if (language === "bash" || language === "sh") {
      const result = await execFileAsync("bash", ["-c", code], {
        timeout,
        cwd: "/workspace",
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } else if (language === "javascript" || language === "js") {
      const tmpFile = join(tmpdir(), `exec-${Date.now()}.js`);
      await writeFile(tmpFile, code);
      try {
        const result = await execFileAsync("node", [tmpFile], {
          timeout,
          cwd: "/workspace",
        });
        stdout = result.stdout;
        stderr = result.stderr;
      } finally {
        await unlink(tmpFile).catch(() => {});
      }
    } else if (language === "python") {
      const result = await execFileAsync("python3", ["-c", code], {
        timeout,
        cwd: "/workspace",
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } else {
      return jsonResponse(res, 400, { error: `Unsupported language: ${language}` });
    }

    return jsonResponse(res, 200, {
      properties: {
        status: "Success",
        stdout,
        stderr,
        returnCode,
      },
    });
  } catch (err) {
    const isTimeout = err.killed || err.code === "ERR_CHILD_PROCESS_TIMEOUT";
    return jsonResponse(res, isTimeout ? 408 : 200, {
      properties: {
        status: "Failed",
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.message ?? "Unknown error",
        returnCode: err.code ?? 1,
      },
    });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/health" && req.method === "GET") {
    return jsonResponse(res, 200, {
      status: "healthy",
      message: "Dynamic session container is ready",
    });
  }

  if (url.pathname === "/execute" || (url.pathname === "/" && req.method === "POST")) {
    return handleExecute(req, res);
  }

  if (url.pathname === "/" && req.method === "GET") {
    return jsonResponse(res, 200, {
      message: "Azure Container Apps Dynamic Session Container",
      status: "healthy",
      endpoints: {
        "POST /execute": "Execute code or shell commands",
        "GET /health": "Health check",
      },
    });
  }

  jsonResponse(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Session executor listening on port ${PORT}`);
});
