const Client = require("ssh2-sftp-client");
const fs = require("fs");
const sftpconfig = require("./sftp.json");

const sftp = new Client();
const options = {
    host: sftpconfig.host,
    port: sftpconfig.port,
    username: sftpconfig.username,
    passphrase: sftpconfig.passphrase,
    privateKey: fs.readFileSync(sftpconfig.privateKey),
};
async function exec(){
    console.log(`Forming SFTP connection to: ${sftpconfig.username}@${sftpconfig.host}:${sftpconfig.port}`);
    try {
        await sftp.connect(options);
        console.log("Connected!\n");
        const promises = [];
        fs.readdir("./build",(e,files)=>{
            files.filter(x => x.endsWith(".js")).forEach(async filename => {
                promises.push(sftp.put(`${__dirname}/build/${filename}`,`./argos/${filename}`));
            });
            files.filter(x => !x.split("").includes(".")).forEach(async foldername => {
                if(foldername === "data") return;
                promises.push(sftp.uploadDir(`${__dirname}/build/${foldername}`,`./argos/${foldername}`));
            });
            Promise.all(promises).then((x)=>{
                console.log(`
Following files/folders were uploaded:
${x.map(y => y.split("argos/")[1]).join("\n")}`);
                sftp.end();
            });
        });
    } catch(e){
        console.error(e);
    }
}

exec();