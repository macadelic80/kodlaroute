let Userj

let get_account = (callback)=>{
	gapi.signin2.render('my-signin2', {
	  'scope': 'profile email',
	  'width': 240,
	  'height': 50,
	  'longtitle': true,
	  'theme': 'dark',
	  'onsuccess': googleUser =>{
		  let displayName = googleUser.getBasicProfile().getGivenName();
		  let email = googleUser.getBasicProfile().getEmail()
		  let picture = googleUser.getBasicProfile().getImageUrl()
		  let user = {displayName, email, picture};
		  callback(user)
	  },
	  'onfailure': error=> {
		  console.log(error);
	  },
	});
}

let create = (e) => {
	let selected = ~~document.querySelector("#roomPrivacyPrivate").checked;
	let room_name = document.querySelector("#room_name").value.toLowerCase();
	let privacy = ["Public", "Private"][selected]
	socket.emit("create_room", privacy, room_name, User);
}


let join = (e) => {
	let name = document.querySelector("#name").value.toLowerCase();
	socket.emit("join_private_room", name);
}

let socket;

let update_room_list = (rooms, infos) =>{
	let list = document.querySelector(".list");
	let header = document.querySelector("#info_rooms");
	header.textContent = `${infos.players} player${infos.players == 1 ? "" : "s"} in ${rooms.length} public room${rooms.length == 1 ? "" : "s"} and ${infos.private} private room${infos.private == 1 ? "" : "s"}`;
	list.innerHTML = "";
	rooms.forEach(x=>list.appendChild(create_room_box(x)));
}
let create_room_box = (room) => {
	let a = document.createElement("a");
	a.classList.add("entry");
	a.setAttribute("href", "/" + room.name)
	a.innerHTML = `
		<div class="title">${room.name}
			<span class="playerCount">${room.players}</span>
		</div>
		<div class="playing">${room.state}</div>`
	return a
}
let start = () => {
	socket = io.connect();
	document.querySelector("#refresh").addEventListener("click", e=>{
		socket.emit("get_rooms");
	})
	socket.on("connect", ()=>{
		get_account(user=>{
			User = user;
		})
		socket.emit("get_rooms");
	}).on("send_rooms", (rooms, infos)=>{
		update_room_list(rooms, infos);
		console.log("rooms actuelles", rooms);
	}).on("error_room", (error)=>{
		alert(error)
	}).on("success", (name)=>{
		window.location.href += name;
	})
}

let check = () => {
	if (window["io"] && window["gapi"]) start();
	else {
		console.log("socket.io ||/&& gapi non chargé")
		setTimeout(check, 10);
	}
}

document.addEventListener('DOMContentLoaded', function(){
	check();
})
