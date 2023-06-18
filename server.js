const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const ss = require('socket.io-stream');
const app = express();
const server = http.createServer(app);
const io = socketio(server);
const {
  addUser, removeUser, getUser, getUsers
} = require('./user');

const UPLOAD_DIR = path.join(__dirname, "upload");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, {recursive: true});
}

io.on('connect', socket => {
  socket.on('join', ({username}, callback) => {
    const {error, user} = addUser({id: socket.id, name: username});

    if (error) return callback?.(error);

    socket.join("room");

    socket.emit('message', {
      user: 'server', text: `${user.name.toUpperCase()}, Welcome to room.`
    });
    socket.broadcast.to("room").emit('message', {
      user: 'server', text: `${user.name.toUpperCase()} has joined!`
    });

    io.to("room").emit('users', {
      users: getUsers()
    });

    callback?.();
  });
  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    io.to("room").emit('message', {user: user.name, text: message});

    callback?.();
  });

  ss(socket, {}).on('upload_file', function (stream, data, callback) {
    try {
      const filename = path.basename(data.name);
      stream.pipe(fs.createWriteStream(path.join(UPLOAD_DIR, filename)));
      callback?.(`file ${filename} uploaded.`)
      const user = getUser(socket.id);
      io.to("room").emit("message",{user: user.name , text:`user "${user.name}" upload a file with name "${filename}". you can get file by "gfile:${filename}"`});
    } catch (e) {
      callback?.("fail.")
    }
  });
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to("room").emit('message', {
        user: 'server', text: `${user.name.toUpperCase()} has left.`
      });
      io.to("room").emit('users', {
        users: getUsers()
      });
    }
  });
  socket.on('download_file', function (filename, callback) {
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      callback?.(`file ${filename} doesnt exist on server!`);
    } else {
      const stream = ss.createStream({});
      ss(socket, {}).emit('send_file', stream, {name: filename});
      fs.createReadStream(filePath).pipe(stream);
    }
  });
});
server.listen(process.env.SERVER_PORT || 3000, () => console.log('Server is running on port 3000'));
