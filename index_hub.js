

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
	get_account(user=>{
		socket.emit("create_room", privacy, room_name, user);
	})
}


let join = (e) => {
	let name = document.querySelector("#name").value.toLowerCase();
	socket.emit("join_private_room", name);
}

let socket;
let start = () => {
	socket = io.connect();
	socket.on("connect", ()=>{
		console.log("Connecté au serveur");
		socket.emit("get_rooms");
	}).on("send_rooms", (rooms)=>{
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
