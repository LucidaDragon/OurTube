const logElem = exports.logElem = document.querySelector(".log");
const logHeading = document.querySelector("#logHeading");
const speed = document.querySelector(".speed");
exports.hostedContent = document.querySelector(".hostedContent");

exports.log = function log(item, unsafe)
{
	logHeading.style.display = "block";

	const p = document.createElement("p");
	if (unsafe) p.innerHTML = item;
	else p.textContent = item;
	logElem.appendChild(p);
	return p;
};

exports.unsafeLog = function unsafeLog(item)
{
	return exports.log(item, true);
};

exports.appendElemToLog = function append(item)
{
	logHeading.style.display = "block";

	logElem.appendChild(item);
	exports.lineBreak();
	return item;
};

exports.lineBreak = function lineBreak()
{
	logElem.appendChild(document.createElement("br"));
};

// replace the last P in the log
exports.updateSpeed = function updateSpeed(str)
{
	speed.innerHTML = str;
};

exports.warning = function warning(err)
{
	console.error(err.stack || err.message || err);
	return exports.log(err.message || err);
};

exports.error = function error(err)
{
	console.error(err.stack || err.message || err);
	const p = exports.log(err.message || err);
	p.style.color = "red";
	p.style.fontWeight = "bold";
	return p;
};

exports.escapeHtml = function escapeHtml(value)
{
	return value.replace("&", "&amp;").replace("\"", "&quot;").replace("'", "&#39;").replace("<", "&lt;").replace(">", "&gt;");
};

exports.getMetricBytes = function getMetricBytes(value)
{
	const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	let index = 0;

	for (; index < (units.length - 1) && value > 1000; index++, value /= 1000);

	return `${value.toFixed(1)} ${units[index]}`;
};