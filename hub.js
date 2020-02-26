const express = require("express");
const socketio = require("socket.io");
const fs = require("fs");
const _ = require("lodash");
const url = require('url');
const path = require('path');
const http = require("http");

//console.log(google.urlGoogle());
let server = express().use((req, res) => {
    const parsedUrl = url.parse(req.url);
    let pathname = `.${parsedUrl.pathname}`;

    const mimeType = {
        '.ico': 'image/x-icon',
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.pdf': 'application/pdf',
    };
    fs.exists(pathname, function (exist) {
        if(!exist) {
			let room;
			if (!(room = find_room(pathname.substr(2)))){
				res.statusCode = 404;
	            res.end(`File ${pathname} not found!`);
	            return;
			}
			res.setHeader('Content-type', 'text/html');
			res.end(build_html(room));
			return ;
        } else if (fs.statSync(pathname).isDirectory()) {
            pathname += '/index_hub.html';
        }
        fs.readFile(pathname, function(err, data){
            if(err){
                res.statusCode = 500;
                res.end(`Error getting the file: ${err}.`);
            } else {
                const ext = path.parse(pathname).ext;
                res.setHeader('Content-type', mimeType[ext] || 'text/plain' );
                res.end(data);
            }
        });
    });
}).listen(process.env.PORT || 8080);

let Connections = {};
let get_date = ()=>{
	let date = new Date();
	let hours = date.getHours();
	hours += hours < 10 ? "0" : "";
	let minutes = date.getMinutes();
	minutes += minutes < 10 ? "0" : "";
	let seconds = date.getSeconds();
	seconds += seconds < 10 ? "0" : "";
	let ms = date.getMilliseconds();
	seconds += seconds < 10 ? "00" : seconds < 100 ? "0" : "";
	return `${hours}:${minutes}:${seconds}:${ms}`;
}

class Room {
	constructor(_code, _name){
		this.code = _code;
		this.name = _name;
		this.players = [];
		this.state = ""
	}
	broadcast_message(data){
		let date = get_date();
		data = {date, ...data}
		this.players.forEach(player=>{
			player.ids.forEach(so=>{
				if (Connections[so])
					Connections[so].emit("chatMessage", data)
			})
		})
	}
	broadcast_info(type, displayName){
		console.log("sa broadcast info", type);
		let date = get_date();
		this.players.forEach(player=>{
			player.ids.forEach(x=>{
				if (Connections[x])
					Connections[x].emit("chatInfo", date, type, displayName)
			})
		})
	}
	addplayer(user, id){
		let index;
		if (~(index = this.players.findIndex(x=>x.email==user.email))) {
			let player = this.players[index];
			player.ids.push(id);
			return;
		}
		this.broadcast_info("join", user.displayName)
		this.players.push(new User(user, id));
	}
	removeplayer(user, id){
		let index;
		if (~(index = this.players.findIndex(x=>x.email == user.email))) {
			let player = this.players[index];
			if (player.ids.length == 1){
				Connections[player.ids[0]].disconnect();
				delete Connections[player.ids[0]]
				this.broadcast_info("leave", player.displayName)
				this.players.splice(this.players.findIndex(x=>x.email==player.email),1)
			} else {
				let index = player.ids.findIndex(x=>x == id);
				if (!~index) return ;
				Connections[player.ids[index]].disconnect();
				delete Connections[player.ids[index]]
				player.ids.splice(index, 1)
			}
		}
	}
}

class User {
	constructor(_user, _id){
		this.displayName = _user.displayName;
		this.picture = _user.picture;
		this.email = _user.email;
		this.ids = [_id];
	}
}

global.rooms = [];
rooms.push(new Room("12345678", "test"))

let find_room = (code)=>{
	let index = rooms.findIndex(x=>x.code == code || x.name == code);
	return (~index ? rooms[index] : undefined)
}

let findUserBySocketId = (id)=>{
	rooms.forEach(room=>{
		let index = room.players.findIndex(player=>~player.ids.findIndex(x=>x.id == id));
		if (~index){
			let player = room.players[index];
			return {room, player};
		}
	})
	return null
}

socketio(server).on("connection", socket => {
	Connections[socket.id] = socket;
	socket.on("js", code => {
		try{
			socket.emit("log", eval(code))
		} catch(e){
			socket.emit("log", e.toString())
		}
	}).on("disconnect", ()=>{
		let data = findUserBySocketId(socket.id);
		if (!data) return;
		let {room, player} = data
		room.removeplayer(player, socket.id);
	}).on("get_rooms", ()=>{
		socket.emit("send_rooms", global.rooms);
	}).on("create_room", (privacy, name)=>{

	}).on("join_private_room", (code)=>{
		let index = rooms.findIndex(x=>x.code == code);
		if (!~index) return socket.emit("error_room", "undefined room");
		socket.emit("success", code);
	}).on("joined", (user,  code)=>{
		let room = find_room(code);
		if (!~room) return socket.emit("fail", "Erreur interne 118");
		room.addplayer(user, socket.id);
	}).on("leave", (user,code)=>{
		let room = find_room(code);
		if (!~room) return
		room.removeplayer(user, socket.id);
	}).on("chat", (message, code, user)=>{
		let room = find_room(code);
		if (!~room) return
		room.broadcast_message({displayName: user.displayName, text: message});
	})
});


let build_html = (room, account) => {
	let data = `<html><head>
	  <meta charset="utf-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
	  <meta name="google-signin-client_id" content="673393186411-gkkarivsp6p6ea61h8kmvg8sgrln6l7e.apps.googleusercontent.com">
	  <title>KoD Laroute</title>
	  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lato|Varela+Round|Pacifico">
	  <link rel="stylesheet" href="common/base.css">
	  <link rel="stylesheet" href="room/index.css">
	  <script src="google-utils.js" async defer></script>
	<body>
	  <div class="top">
	    <div class="info"><span class="url">${room.name}/<span class="roomCode">${room.code}</span></span> <span class="chatterCount">${room.players.length}</span></div>
		<div class="spacer"></div>
		<div id="my-signin2"></div>
		<div class="sidebarToggle" title="Toggle sidebar"><button>📝</button></div>
	  </div>
	  <div class="pages">
	    <div class="loading page" hidden>
	      <div>Loading...</div>
	    </div>
	    <div class="main page">
	      <div class="game"><iframe></iframe></div>
	      <div class="sidebar">
	        <div class="actions">
	          <a class="chat" title="Chat">Chat</a>
	          <a class="people" title="People">Players</a>
	          <a class="leaveRoom" title="Leave room">Leave</a>
	        </div>
	        <div class="chat">
	          <div class="log"></div>
	          <div class="input">
			  	<textarea id="textBox"placeholder="Type here to chat" maxlength="300"></textarea>
			  </div>
	        </div>
	        <div class="people" hidden>
	          <div class="list"></div>
	        </div>
	      </div>
	    </div>
	  </div>
	  <script src="socket.io/socket.io.js"> </script>

	  <script src="room/index_room.js"></script>
	  `
	return data;
}
