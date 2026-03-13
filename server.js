const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const DEFAULT_PORT = Number(process.env.PORT) || 3000;

let submittedName = "";

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPage(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main>
      ${content}
    </main>
  </body>
</html>`;
}

function parseFormBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      const params = new URLSearchParams(body);
      resolve(params);
    });

    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const currentUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && currentUrl.pathname === "/styles.css") {
    try {
      const cssPath = path.join(__dirname, "public", "styles.css");
      const css = await fs.readFile(cssPath, "utf8");
      response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      response.end(css);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Unable to load styles.");
    }
    return;
  }

  if (request.method === "GET" && currentUrl.pathname === "/") {
    const html = renderPage(
      "Welcome",
      `
        <section class="hero">
          <h1>Welcome</h1>
          <p class="lead">Enter your name.</p>
        </section>
        <section class="panel">
          <form action="/submit-name" method="POST" class="form-card">
            <label class="field-label" for="username">Name</label>
            <input id="username" type="text" name="username" placeholder="Enter your name" required />
            <button type="submit">Get Greeting</button>
          </form>
        </section>
      `
    );

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  if (request.method === "POST" && currentUrl.pathname === "/submit-name") {
    try {
      const formData = await parseFormBody(request);
      submittedName = (formData.get("username") || "").trim();

      response.writeHead(303, { Location: "/greeting" });
      response.end();
    } catch (error) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Unable to process the form submission.");
    }
    return;
  }

  if (request.method === "GET" && currentUrl.pathname === "/greeting") {
    if (!submittedName) {
      response.writeHead(302, { Location: "/" });
      response.end();
      return;
    }

    const safeName = escapeHtml(submittedName);
    const html = renderPage(
      "Greeting",
      `
        <section class="hero">
          <h1>Hello, ${safeName}!</h1>
        </section>
        <section class="panel panel-center">
          <a class="link-button" href="/">Go Back</a>
        </section>
      `
    );

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Page not found.");
});

function startServer(port) {
  server
    .listen(port)
    .on("listening", () => {
      console.log(`Server running on http://localhost:${port}`);
    })
    .on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        const nextPort = port + 1;
        console.log(`Port ${port} is busy. Trying http://localhost:${nextPort} instead...`);
        server.removeAllListeners("error");
        server.removeAllListeners("listening");
        startServer(nextPort);
        return;
      }

      throw error;
    });
}

startServer(DEFAULT_PORT);
