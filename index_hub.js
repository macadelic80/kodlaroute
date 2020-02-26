let socket = io.connect();
socket.on("connect", ()=>{
	console.log("Connecté au serveur");
	socket.emit("get_rooms");
}).on("send_rooms", (rooms)=>{
	console.log("rooms actuelles", rooms);
}).on("error_room", (error)=>{
	alert(error)
}).on("success", (code)=>{
	window.location.href += code
})

let create = (e) => {
	let selected = ~~document.querySelector("#roomPrivacyPrivate").checked;
	let room_name = document.querySelector("#room_name").checked;
	let privacy = ["Public", "Private"][selected]
	socket.emit("create_room", privacy, room_name);
}


let join = (e) => {
	let code = document.querySelector("#code");
	console.log("sa join")
	socket.emit("join_private_room", code.value);
}

document.addEventListener('DOMContentLoaded', function(){
	function onSuccess(googleUser) {
		let displayName = googleUser.getBasicProfile().getGivenName();
		let email = googleUser.getBasicProfile().getEmail()
		console.log(displayName, email);
    }
    function onFailure(error) {
  		console.log(error);
    }
  	gapi.signin2.render('my-signin2', {
  	  'scope': 'profile email',
  	  'width': 240,
  	  'height': 50,
  	  'longtitle': true,
  	  'theme': 'dark',
  	  'onsuccess': onSuccess,
  	  'onfailure': onFailure
  	});
})
