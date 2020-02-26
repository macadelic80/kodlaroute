
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


let sendMessage = (displayName, text, date) =>{
	let div = document.createElement("div");
	div.innerHTML = `
	<span class="time">${date}</span><span class="author">${displayName}</span>
	<span class="text">${text}</span>
	`
	document.querySelector(".log").appendChild(div);
}

let sendInfo = (displayName, text, date) =>{
	let messages = {
		"join": "a rejoint la partie.",
		"leave": "a quitté la partie."
	};
	let div = document.createElement("div");
	div.innerHTML = `
	<span class="time">${date}</span><span class="author">${displayName + " " + messages[text]}</span>
	`
	document.querySelector(".log").appendChild(div);
}

document.addEventListener('DOMContentLoaded', function(){
	let socket = io.connect();
	document.querySelector(".sidebarToggle").addEventListener("click", e=>{
		let sidebar = document.querySelector(".sidebar");
		sidebar.hidden = !sidebar.hidden;
	})
	document.querySelector("#textBox").addEventListener("keydown", event=>{
		if (!event.shiftKey && event.keyCode === 13) {
	    event.preventDefault();

	    const text = document.querySelector("#textBox").value.trim();
	    if (text.length > 0)
			get_account(user=>{
				socket.emit("chat", text, window.location.pathname.substr(1), user)
			})
	    document.querySelector("#textBox").value = "";
	  }
	})
	socket.on("connect", ()=>{
		console.log("Connecté au serveur");
		get_account(user=>{
			let code = window.location.pathname.substr(1)
			socket.emit("joined", user, code);
			document.querySelector(".leaveRoom").addEventListener("click", e=>{
				if(confirm("Are you sure you want quit ?")){
					socket.emit("leave", user, code)
					window.location.href = window.location.origin
				}
			})
		})
	}).on("fail", (e)=>{
		alert(e);
		window.location.href = window.location.origin;
	}).on("chatMessage", data=>{
		let {displayName, text, date} = data;
		sendMessage(displayName,text,date);
	}).on("chatInfo", (date, type, displayName)=>{
		console.log("info", type);
		sendInfo(displayName,type,date);
	})



});
