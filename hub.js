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
    let c = new Date;
    let r = c.getHours();
    	r = (10 > r ? "0" : "") + r;
    let o = c.getMinutes();
    	o = (10 > o ? "0" : "") + o;
    let s = c.getSeconds();
    	s = (10 > s ? "0" : "") + s;
    let m = c.getMilliseconds();
	m = (100 > m && m >= 10 ? "0" : m < 10 ? "00" : "") + m;
	return "" + r + ":" + o + ":" + s + ":" + m;
}

class Room {
	constructor(_name, _user, _privacy){
		this.name = _name.toLowerCase();
		this.privacy = _privacy;
		this.players = [];
		this.players_in_game = [];
		this.state = "waitingForPlayers";
		this.questions = [];
		this.question_index = 0;
		this.host = _user.email;
	}
	next_question(){
		this.broadcast_in_game_emit("set_question", this.questions[this.question_index], this.question_index);
	}
	broadcast_message(data){
		let date = get_date();
		data = {date, ...data}
		this.players.forEach(player=>{
			player.ids.forEach(so=>{
				if (Connections[so])
					Connections[so].socket.emit("chatMessage", data)
			})
		})
	}
	broadcast_in_game_emit(emit, ...data){
		this.players_in_game.forEach(player=>{
			player.ids.forEach(so=>{
				if (Connections[so])
					Connections[so].socket.emit(emit, ...data);
			})
		})
	}
	broadcast_info(type, displayName){
		let date = get_date();
		this.players.forEach(player=>{
			player.ids.forEach(x=>{
				if (Connections[x])
					Connections[x].socket.emit("chatInfo", date, type, displayName)
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
				Connections[id].socket.disconnect();
				delete Connections[id]
				this.broadcast_info("leave", player.displayName)
				this.players.splice(this.players.findIndex(x=>x.email==player.email),1)
				if (this.players.length == 0) delete rooms[this.name.toLowerCase()];
			} else {
				let index = player.ids.indexOf(id);
				if (!~index) return ;
				if (Connections[id]){
					Connections[id].socket.disconnect();
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
		this.next = false;
		this.ids = [_id];
		this.failed = [];
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
function shuffle(a) {
    var j, x, i
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i)
        x = a[i - 1]
        a[i - 1] = a[j]
        a[j] = x
    }
};

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
		Connections[socket.id] = {socket, room_name: name};
		if (!rooms.hasOwnProperty(name)) rooms[name] = new Room(name, user, privacy);
		socket.emit("success", name);
	}).on("join_private_room", (name)=>{
		let index = rooms[name] || -1;
		if (!~index) return socket.emit("error_room", "undefined room");
		socket.emit("success", name);
	}).on("joined", (user, name)=>{
		if (!name) return;
		console.log("joined", name);
		let room = rooms[name] || -1;
		if (!~room) return socket.emit("fail", "Erreur interne 118");
		Connections[socket.id] = {socket, room_name: name};
		room.addplayer(user, socket.id);
		if (user.email == room.host)
			socket.emit("host");
	}).on("leave", (user)=>{
		let name = Connections[socket.id].room_name;
		if (!name) return
		let room = rooms[name] || -1;
		if (!~room) return
		room.removeplayer(user, socket.id);
	}).on("chat", (message, user)=>{
		let name = Connections[socket.id].room_name;
		let room = rooms[name] || -1;
		if (!~room) return
		room.broadcast_message({displayName: user.displayName, text: message});
	}).on("get_datas", ()=>{
		let name = Connections[socket.id] && Connections[socket.id].room_name || null;
		if (!name) return;
		if (rooms[name]) socket.emit("data", rooms[name].players.map(x=>new Object({displayName: x.displayName, email: x.email})), name);
	}).on("validate", (value) =>{
		let name = Connections[socket.id].room_name;
		let room = rooms[name] || -1;
		if (!~room) return
		let user = room.players_in_game.findIndex(x=>x.ids.includes(socket.id));
		if (!~user) return;
		user = room.players_in_game[user];
		let current_question = room.questions[room.question_index];
		if (current_question.answers.value != value && !current_question.answers[value].isRight){
			user.failed.push(room.question_index);
			console.log(`${user.displayName} ptdrr il sest grave fail`)
		} else {
			console.log(`${user.displayName} ce bg`)
		}
		user.next = true;
		if (room.players_in_game.reduce((x,y)=>x && y.next, true)){
			console.log("Tous les joueurs en jeu passent a la question suivante donc on next")
			room.question_index++;
			room.next_question();
		}
	}).on("join", ()=>{
		let name = Connections[socket.id].room_name;
		let room = rooms[name] || -1;
		if (!~room) return
		let index = room.players.findIndex(x=>x.ids.includes(socket.id))
		if (!~index) return;
		let user = room.players[index];
		if (~room.players_in_game.findIndex(x=>x.email == user.email)) return;
		room.players_in_game.push(user);
		console.log(`${user.displayName} rejoint la partie dans ${name}`, room.players_in_game.map(x=>x.displayName));
	}).on("quit", ()=>{
		let name = Connections[socket.id].room_name;
		let room = rooms[name] || -1;
		if (!~room) return
		let index = room.players.findIndex(x=>x.ids.includes(socket.id))
		if (!~index) return;
		let user = room.players[index];
		room.players_in_game.splice(room.players_in_game.findIndex(x=>x.email == user.email), 1);
		console.log(`${user.displayName} quitte la partie dans ${name}`, room.players_in_game.map(x=>x.displayName));
	}).on("start_game", ()=>{
		let name = Connections[socket.id].room_name;
		let room = rooms[name] || -1;
		if (!~room) return
		let index = room.players.findIndex(x=>x.ids.includes(socket.id))
		if (!~index) return;
		let user = room.players[index];
		if (user.email == room.host){
			shuffle(Questions);
			room.questions.push(...Questions.slice(0,50));
			room.next_question();
		}
	})
});




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
	    <div class="loading page">
	      <div>Please sign-in with google before...</div>
	    </div>
	    <div class="main page" hidden>
	      <div class="game">
		  <button id="joinGame">Rejoindre la partie</button>
		  <button id="quitGame" hidden>Quitter la partie</button>
		  </div>
	      <div class="sidebar">
	        <div class="actions">
	          <a class="chat" title="Chat">Chat</a>
	          <a class="options" title="Options">Options</a>
	          <a class="leaveRoom" title="Leave room">Leave</a>
	        </div>
	        <div class="chat">
	          <div class="log"></div>
	          <div class="input">
			  	<textarea id="textBox"placeholder="Type here to chat" maxlength="300"></textarea>
			  </div>
	        </div>
	        <div class="options" hidden>
			    <table>
			        <tbody>
			            <tr>
			                <td>Audio (si disponible)</td>
			                <td>
								<select name="audio">
			                        <option value="true" selected="selected">Activé</option>
			                        <option value="false">Désactivé</option>
				                </select>
							</td>
			            </tr>
						<tr>
			                <td>Mode questions graves</td>
			                <td>
								<select name="mqg">
			                        <option value="false" selected="selected">Desactivé</option>
			                        <option value="true">Activé</option>
				                </select>
							</td>
			            </tr>
			        </tbody>
			    </table>
	        </div>
	      </div>
	    </div>
	  </div>
	  <script src="socket.io/socket.io.js"> </script>

	  <script src="room/index_room.js"></script>
	  `
	return data;
}
