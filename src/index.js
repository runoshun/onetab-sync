const fs = require("fs");

const program = require("commander");

import gist from "./gist";
import openOneTabDB from "./db";
import conf from "./conf";

const uploadToGist = async () => {
    console.info("uploading data to gist ...");
    try {
        let config = await conf.load(["chrome_profile_path", "onetab_ext_id", "gist_token"]);
        let oneTabData = await readOneTabData(config);
        let res = await gist.upload(config, oneTabData);
        console.info("success. " + res.html_url);
        return res;
    } catch(e) {
        console.error(e);
    }
};

const downloadFromGist = async () => {
    console.info("downloading data from gist ...");
    try {
        let config = await conf.load(["chrome_profile_path", "onetab_ext_id", "gist_token", "gist_id"]);
        let [data, metadata] = await gist.download(config);
        let oneTabData = await readOneTabData(config);
        let res = await gist.backup(config, oneTabData);
        await restoreOneTabData(config, data);
        console.info("success.");
        return res;
    } catch (e) {
        console.error(e);
    }
};

const syncWithGist = async () => {
    try {
        let config = await conf.load(["chrome_profile_path", "onetab_ext_id", "gist_token"]);
        return await detectDownloadOrUpload(config);
    } catch (e) {
        console.error(e);
    }
};

const restoreFromFile = async (file) => {
    try {
        let config = await conf.load(["chrome_profile_path", "onetab_ext_id"]);
        let content = fs.readFileSync(file).toString();
        let res = await restoreOneTabData(config, content)
        console.info("success.");
        return res;
    } catch (e) {
        console.error(e);
    }
}

const readOneTabData = async (config) => {
    try {
        let db = await openOneTabDB(config);
        let result = await db.get();
        await db.close();
        return result;
    } catch (e) {
        return Promise.reject(
            new Error("can't open chrome localstorage db. If your browser is running, please quit it." + e.message)
        );
    }
};


const restoreOneTabData = async (config, data) => {
    try {
        let db = await openOneTabDB(config);
        let result = await db.put(data);
        await db.close();
        return result;
    } catch (e) {
        return Promise.reject(
            new Error("can't open chrome localstorage db. If your browser is running, please quit it." + e.message)
        );
    }
};

const detectDownloadOrUpload = (config) => {
    gist.download(config).then(([data, metadata]) => {
        if (config.lastsync === metadata.lastsync) {
            return uploadToGist();
        } else {
            return downloadFromGist();
        }
    }).catch(res => res.message === "Not Found" ? uploadToGist() : console.error(res));
};


const pkginfo = JSON.parse(fs.readFileSync(__dirname + "/../package.json"));
program
    .version(pkginfo.version)
    .description(pkginfo.description);

program
    .command("upload")
    .description("force upload onetab data to gist")
    .action(uploadToGist);

program
    .command("download")
    .description("force download onetab data from gist")
    .action(downloadFromGist);

program
    .command("sync")
    .description("sync onetab data with gist")
    .action(syncWithGist);

program
    .command("restore <file>")
    .description("restore onetab data from backup file")
    .action(restoreFromFile);

program
    .command("*", undefined, {noHelp: true})
    .action(() => program.help());

program.parse(process.argv);
if (!program.args.length) program.help();

