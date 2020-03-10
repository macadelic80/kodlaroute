const express = require("express");
const socketio = require("socket.io");
const fs = require("fs");
const _ = require("lodash");
const url = require('url');
const path = require('path');
const http = require("http");
const Questions = require("./questions.json")
//console.log(google.urlGoogle());

global.Connections = {};
global.rooms = {};

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
			if (!(room = rooms[pathname.substr(2).toLowerCase()])){
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

let get_date = ()=>{
	let date = new Date();
	let hours = date.getHours();
	hours = hours < 10 ? "0" : "" + hours;
	let minutes = date.getMinutes();
	minutes = minutes < 10 ? "0" : "" + minutes;
	let seconds = date.getSeconds();
	seconds = seconds < 10 ? "0" : "" + seconds;
	let ms = date.getMilliseconds();
	seconds = seconds < 10 ? "00" : seconds < 100 ? "0" : "" + seconds;
	return `${hours}:${minutes}:${seconds}:${ms}`;
}

class Room {
	constructor(_name, _privacy){
		this.name = _name.toLowerCase();
		this.privacy = _privacy;
		this.players = [];
		this.state = "waitingForPlayers"
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
				Connections[id].disconnect();
				delete Connections[id]
				this.broadcast_info("leave", player.displayName)
				this.players.splice(this.players.findIndex(x=>x.email==player.email),1)
				if (this.players.length == 0) delete rooms[this.name.toLowerCase()];
			} else {
				let index = player.ids.indexOf(id);
				if (!~index) return ;
				if (Connections[id]){
					Connections[id].disconnect();
					delete Connections[id]
					player.ids.splice(index, 1)
				}
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

let findUserBySocketId = (id)=>{
	for (room in rooms){
		room = rooms[room]
		let index = room.players.findIndex(player=>~player.ids.indexOf(id));
		if (~index){
			let player = room.players[index];
			return {room, player};
		}
	}
	return null
}

let get_players_count = () =>{
	let length = 0;
	for (room in rooms) length += rooms[room].players.length;
	return length;
}

socketio(server).on("connection", socket => {
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
		let rooms_list = Object.keys(rooms).filter(x=>rooms[x].privacy == "Public").map(x=>Object({name:rooms[x].name, players: rooms[x].players.length, state: rooms[x].state}))
		let infos = {private: Object.keys(rooms).filter(x=>rooms[x].privacy == "Private").length, players: get_players_count()};
		socket.emit("send_rooms", rooms_list, infos);
	}).on("create_room", (privacy, name, user)=>{
		Connections[socket.id] = socket;
		if (!rooms.hasOwnProperty(name)) rooms[name] = new Room(name, privacy);
		socket.emit("success", name);
	}).on("join_private_room", (name)=>{
		let index = rooms[name] || -1;
		if (!~index) return socket.emit("error_room", "undefined room");
		socket.emit("success", name);
	}).on("joined", (user,  name)=>{
		console.log("joined", name, rooms[name]);
		let room = rooms[name] || -1;
		if (!~room) return socket.emit("fail", "Erreur interne 118");
		Connections[socket.id] = socket;
		room.addplayer(user, socket.id);
	}).on("leave", (user,name)=>{
		let room = rooms[name] || -1;
		if (!~room) return
		room.removeplayer(user, socket.id);
	}).on("chat", (message, name, user)=>{
		let room = rooms[name] || -1;
		if (!~room) return
		room.broadcast_message({displayName: user.displayName, text: message});
	})
});

let format_question = (question) => {
	let data = question.answers.map((x)=>`<div><input type="checkbox" name="scales"><label>${x.entitled}</label></div>`)
	return "<ul id='question_list'>" + data.join("") + "</ul>";
}


let create_question = (x) => {
	let data = `
		<div id="section">
			<div id="id_question">
				Question <span>1</span> sur <span>50</span> </div>
			<div>
				<div>
					<p><img src="${x.picture}" alt=""></p>
					<p>${x.question}</p>
				</div>
				${format_question(x)}
			</div>
		</div>`
		return data;
}


let build_html = (room) => {
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
	    <div class="info"><span class="url">${room.name}</span> <span class="chatterCount">${room.players.length}</span></div>
		<div class="spacer"></div>
		<div id="my-signin2"></div>
		<div class="sidebarToggle" title="Toggle sidebar"><button>📝</button></div>
	  </div>
	  <div class="pages">
	    <div class="loading page" hidden>
	      <div>Loading...</div>
	    </div>
	    <div class="main page">
	      <div class="game">
		  ${create_question(Questions[0])}
		  </div>
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
