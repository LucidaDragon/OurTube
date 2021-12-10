const compress = require("compression");
const express = require("express");
const http = require("http");
const path = require("path");

const config = require("../config");

const PORT = Number(process.argv[2]) || 8080;

const app = express();
const server = http.createServer(app);

// Trust "X-Forwarded-For" and "X-Forwarded-Proto" nginx headers
app.enable("trust proxy");

// Disable "powered by express" header
app.set("x-powered-by", false);

// Pretty print JSON
app.set("json spaces", 4);

// Use GZIP
app.use(compress());

app.use(function (req, res, next)
{
	// Use HTTP Strict Transport Security
	// Lasts 1 year, incl. subdomains, allow browser preload list
	if (config.isProd)
	{
		res.header(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains; preload"
		);
	}

	// Add cross-domain header for fonts, required by spec, Firefox, and IE.
	const extname = path.extname(req.url);
	if ([".eot", ".ttf", ".otf", ".woff", ".woff2"].indexOf(extname) >= 0)
	{
		res.header("Access-Control-Allow-Origin", "*");
	}

	// Prevents IE and Chrome from MIME-sniffing a response. Reduces exposure to
	// drive-by download attacks on sites serving user uploaded content.
	res.header("X-Content-Type-Options", "nosniff");

	// Prevent rendering of site within a frame.
	res.header("X-Frame-Options", "DENY");

	// Enable the XSS filter built into most recent web browsers. It's usually
	// enabled by default anyway, so role of this headers is to re-enable for this
	// particular website if it was disabled by the user.
	res.header("X-XSS-Protection", "1; mode=block");

	// Force IE to use latest rendering engine or Chrome Frame
	res.header("X-UA-Compatible", "IE=Edge,chrome=1");

	next();
});

app.use(express.static(path.join(__dirname, "../static")));

app.get("/", function ()
{
	express.static(path.join(__dirname, "../static/index.html"));
});

server.listen(PORT, "127.0.0.1", function ()
{
	console.log("Listening on port %s", server.address().port);
});