const http = require('http');
const { spawn } = require('child_process');

let ydlexe = './youtube-dl.exe';
if (process.platform != "win32") {
    console.log("using unix youtube-dl because platform is " + process.platform);
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
        var res = await waitForProcReturnStdout(spawn(ydlexe, ["--update"]));
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

        let filenameProc = spawn(ydlexe, ["--get-filename", "-o", "'%(title)s.%(ext)s'", url, "--restrict-filenames"]);
        let filename = await waitForProcReturnStdout(filenameProc);

        if (req.aborted)
            return;

        filename = filename.trim();

        if (filename.startsWith('\''))
            filename = filename.substr(1);

        if (filename.endsWith('\''))
            filename = filename.substr(0, filename.length - 1);

        let proc = spawn(ydlexe, ["-o", "-", url]);
        proc.stdout.pipe(res);

        console.log("piped");

        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="' + filename + '"'
        });

        req.on("aborted", () => {
            console.log("aborted, canceling proc");
            proc.kill()
        });

        proc.on('exit', function () {
            console.log("proc done");
            tryupdate();
        });
    } catch (err) {

        if (!req.aborted) {
            res.statusCode = 500;
            let errormsg = err.toString().substr(0, 1000);
            console.log(errormsg);
            res.end(errormsg);
        }
    }
});

function waitForProcReturnStdout(proc) {
    return new Promise((resolve, reject) => {
        let stdout = "";
        proc.stdout.on("data", data => {
            stdout += data;
        });
        let stderr = "";
        proc.stderr.on("data", data => {
            stderr += data;
        });
        proc.once("exit", () => {
            if (proc.exitCode != 0)
                reject(stderr);
            else
                resolve(stdout);
        });
    });
}

var port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Server running at port ${port}`);
});

