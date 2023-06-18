const io = require('socket.io-client');
const ss = require('socket.io-stream');
const fs = require('fs');
const repl = require('repl')
const path = require("path");

const Download_DIR = path.join(__dirname, "download");

if (!fs.existsSync(Download_DIR)) {
  fs.mkdirSync(Download_DIR, {recursive: true});
}


const socket = io.connect("http://localhost:3000");

const username = process.argv[2] || `${Math.floor(Math.random() * (100 - 1)) + 1}`;

const logMessage = (message) => {
  if (message.user !== username) {
    console.log("\nMessage From", message.user, ":");
    console.log(message.text);
  }
}

const logError = (err) => {
  if (err) console.error(err);
}

socket.on('connect', async function (sc) {
  console.log('Connected!');
  console.log('-----------------------------------');
  socket.emit("join", {username}, logError);
});

ss(socket, {}).on('send_file', function (stream, data) {
  stream.pipe(fs.createWriteStream(path.join(Download_DIR, data.name)));
  console.log(`file ${data.name} saved!`)
});

socket.on("message", (msg) => {
  logMessage(msg)
})
repl.start({
  prompt: '',
  eval: (msg) => {
    if (!socket.connected) {
      console.info("socket not connected! please wait ... ")
    } else {
      if (msg.includes("exit()")) {
        socket.disconnect();
        process.exit(0);
      } else if (msg.includes("sfile:")) {
        const filename = msg.split(":")[1].trim();
        const filePath = path.join(Download_DIR, filename);
        if (!fs.existsSync(filePath)) {
          console.log(`file ${filename} dont exist on download folder !`);
        } else {
          const stream = ss.createStream({});

          ss(socket, {}).emit('upload_file', stream, {name: filename}, (status) => {
            console.log(status);
          });
          fs.createReadStream(filePath).pipe(stream);
        }
      } else if (msg.includes("gfile:")) {
        const filename = msg.split(":")[1].trim();
        socket.emit('download_file', filename, logError)
      } else {
        socket.emit("sendMessage", msg, logError)
      }
    }
  }
})
