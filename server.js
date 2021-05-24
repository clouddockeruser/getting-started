const http = require('http');
const execa = require('execa');

let ydlexe = './youtube-dl.exe';
const isUnix = require('is-unix')
if (isUnix(process.platform)) {
    ydlexe = './youtube-dl';
}

var updating = false;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function tryupdate() {
    if (updating)
        return;

    console.log("trying to update...");

    try {
        updating = true;
        var res = await execa(ydlexe, ["--update"]);
        console.log("update completed", res.message)
    } catch (err) {
        console.log("update error: ", err);
    } finally {
        updating = false;
    }
}

const server = http.createServer(async (req, res) => {

    while (updating && !req.aborted) {
        console.log("witing for update to complete");
        await sleep(1000);
    }

    console.log("raw url:", req.url);

    if (req.url == null || !req.url.length) {
        res.statusCode = 400;
        res.end('No url specified');
        return;
    }

    let url = req.url;

    if (url.startsWith("/"))
        url = url.substr(1);

    console.log("url: ", url);

    //https://www.youtube.com/watch?v=tPEE9ZwTmy0


    try {

        var filenameResult = await execa(ydlexe, ["--get-filename", "-o", "'%(title)s.%(ext)s'", url, "--restrict-filenames"]);

        if (req.aborted)
            return;

        if (filenameResult.exitCode !== 0) {
            res.statusCode = 400;
            res.end(filenameResult.message);
        } else {
            var filename = filenameResult.stdout;

            if (filename.startsWith('\''))
                filename = filename.substr(1);

            if (filename.endsWith('\''))
                filename = filename.substr(0, filename.length - 1);

            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="' + filename + '"'
            });
            var proc = execa(ydlexe, ["-o", "-", url]);
            proc.stdout.pipe(res);

            req.on("aborted", () => {
                console.log("aborted, canceling proc");
                proc.cancel();
            });

            await proc;
        }
    } catch (err) {

        if (!req.aborted) {
            res.statusCode = 500;
            var errormsg = err.toString().substr(0, 1000);
            console.log(errormsg);
            res.end(errormsg);
        }
    }

    tryupdate();
    console.log("request done")
});

var port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Server running at port ${port}`);
});

