const createTorrent = require("create-torrent");
const dragDrop = require("drag-drop");
const formatDistance = require("date-fns/formatDistance");
const path = require("path");
const uploadElement = require("upload-element");
const WebTorrent = require("webtorrent");
const JSZip = require("jszip");
const SimplePeer = require("simple-peer");

const util = require("./util");

globalThis.WEBTORRENT_ANNOUNCE = createTorrent.announceList.map(function (arr)
{
	return arr[0];
}).filter(function (url)
{
	return url.indexOf("wss://") === 0 || url.indexOf("ws://") === 0;
});

const client = new WebTorrent({
	tracker: {
		rtcConfig: {
			...SimplePeer.config
		}
	}
});

client.on("warning", util.warning);
client.on("error", util.error);

init();

function init()
{
	if (!WebTorrent.WEBRTC_SUPPORT)
	{
		util.error("This browser is unsupported. Please use a browser with WebRTC support.");
	}

	// Seed via upload input element
	const upload = document.querySelector("input[name=upload]");
	if (upload)
	{
		uploadElement(upload, function (err, files)
		{
			if (err) return util.error(err);
			files = files.map(function (file)
			{
				return file.file;
			});
			onFiles(files);
		});
	}

	// Seed via drag-and-drop
	dragDrop("body", onFiles);

	// Download via input element
	const form = document.querySelector("form");
	if (form)
	{
		form.addEventListener("submit", function (e)
		{
			e.preventDefault();
			downloadTorrent(document.querySelector("form input[name=torrentId]").value.trim());
		});
	}

	// Download by URL hash
	onHashChange();
	window.addEventListener("hashchange", onHashChange);
	function onHashChange()
	{
		const hash = decodeURIComponent(window.location.hash.substring(1)).trim();
		if (hash !== "") downloadTorrent(hash);
	}
}

function onFiles(files)
{
	// .torrent file = start downloading the torrent
	files.filter(isTorrentFile).forEach(downloadTorrentFile);

	// everything else = seed these files
	seed(files.filter(isNotTorrentFile));
}

function isTorrentFile(file)
{
	const extname = path.extname(file.name).toLowerCase();
	return extname === ".torrent";
}

function isNotTorrentFile(file)
{
	return !isTorrentFile(file);
}

function downloadTorrent(torrentId)
{
	util.log("Downloading torrent from " + torrentId);
	client.add(torrentId, onTorrent);
}

function downloadTorrentFile(file)
{
	util.unsafeLog("Downloading torrent from <strong>" + util.escapeHtml(file.name) + "</strong>");
	client.add(file, onTorrent);
}

function seed(files)
{
	if (files.length === 0) return;
	util.log("Seeding " + files.length + " files");
	client.seed(files, onTorrent);
}

function onTorrent(torrent)
{
	torrent.on("warning", util.warning);
	torrent.on("error", util.error);

	const upload = document.querySelector("input[name=upload]");
	upload.value = upload.defaultValue; // reset upload element

	const torrentFileName = path.basename(torrent.name, path.extname(torrent.name)) + ".torrent";

	util.log("\"" + torrentFileName + "\" contains " + torrent.files.length + " files:");

	torrent.files.forEach(function (file)
	{
		util.unsafeLog("&nbsp;&nbsp;- " + util.escapeHtml(file.name) + " (" + util.escapeHtml(util.getMetricBytes(file.length)) + ")");
	});

	util.log("Torrent info hash: " + torrent.infoHash);
	util.unsafeLog(
		"<a href=\"/#" + util.escapeHtml(torrent.infoHash) + "\" onclick=\"prompt('Share this link with anyone you want to download this torrent:', this.href);return false;\">[Share link]</a> " +
		"<a href=\"" + util.escapeHtml(torrent.magnetURI) + "\" target=\"_blank\">[Magnet URI]</a> " +
		"<a href=\"" + util.escapeHtml(torrent.torrentFileBlobURL) + "\" target=\"_blank\" download=\"" + util.escapeHtml(torrentFileName) + "\">[Download .torrent]</a>"
	);

	function updateSpeed()
	{
		const progress = (100 * torrent.progress).toFixed(1);

		let remaining;
		if (torrent.done)
		{
			remaining = "Done.";
		}
		else
		{
			remaining = torrent.timeRemaining !== Infinity ?
				formatDistance(torrent.timeRemaining, 0, { includeSeconds: true }) :
				"Infinity years";
			remaining = remaining[0].toUpperCase() + remaining.substring(1) + " remaining.";
		}

		util.updateSpeed(
			"<b>Peers:</b> " + torrent.numPeers + " " +
			"<b>Progress:</b> " + progress + "% " +
			"<b>Download speed:</b> " + util.getMetricBytes(client.downloadSpeed) + "/s " +
			"<b>Upload speed:</b> " + util.getMetricBytes(client.uploadSpeed) + "/s " +
			"<b>ETA:</b> " + remaining
		);
	}

	torrent.on("download", updateSpeed);
	torrent.on("upload", updateSpeed);
	setInterval(updateSpeed, 5000);
	updateSpeed();

	torrent.files.forEach(function (file)
	{
		// append file
		file.appendTo(util.hostedContent, {
			maxBlobLength: 2 * 1000 * 1000 * 1000 // 2 GB
		}, function (err)
		{
			if (err) return util.error(err);
		});

		// append download link
		file.getBlobURL(function (err, url)
		{
			if (err) return util.error(err);

			const a = document.createElement("a");
			a.target = "_blank";
			a.download = file.name;
			a.href = url;
			a.textContent = "Download " + file.name;
			util.appendElemToLog(a);
		});
	});

	const downloadZip = document.createElement("a");
	downloadZip.href = "#";
	downloadZip.target = "_blank";
	downloadZip.textContent = "Download all files as zip";
	downloadZip.addEventListener("click", function (event)
	{
		let addedFiles = 0;
		const zipFilename = path.basename(torrent.name, path.extname(torrent.name)) + ".zip";
		let zip = new JSZip();
		event.preventDefault();

		torrent.files.forEach(function (file)
		{
			file.getBlob(function (err, blob)
			{
				addedFiles += 1;
				if (err) return util.error(err);

				// add file to zip
				zip.file(file.path, blob);

				// start the download when all files have been added
				if (addedFiles === torrent.files.length)
				{
					if (torrent.files.length > 1)
					{
						// generate the zip relative to the torrent folder
						zip = zip.folder(torrent.name);
					}
					zip.generateAsync({ type: "blob" }).then(function (blob)
					{
						const url = URL.createObjectURL(blob);
						const a = document.createElement("a");
						a.download = zipFilename;
						a.href = url;
						a.click();
						setTimeout(function ()
						{
							URL.revokeObjectURL(url);
						}, 30 * 1000);
					}, util.error);
				}
			});
		});
	});
	util.appendElemToLog(downloadZip);
}