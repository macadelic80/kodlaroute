let users = [];
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


let set_answers_event = () => {
	[...document.querySelector("#question_list").children].forEach(x => {
		x.onclick = e => e.target.parentElement.children[0].checked = !e.target.parentElement.children[0].checked
	});
}

let sendMessage = (displayName, text, date) =>{
	let div = document.createElement("div");
	let chat = document.querySelector(".log")
	div.innerHTML = `
	<span class="time">${date}</span><span class="author">${displayName}:</span>
	<span class="text">${text}</span>
	`
	chat.appendChild(div);
	if (!(chat.scrollTop >= chat.scrollHeight - chat.clientHeight - 15))
		chat.scrollBy(1, 5000)
}

let update_users_list = () => {
	document.querySelector("body > div.top > div.info > span.chatterCount").innerText = users.length;
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
let start = ()=> {
	let socket = io.connect();
	document.querySelector(".sidebarToggle").addEventListener("click", e=>{
		let sidebar = document.querySelector(".sidebar");
		sidebar.hidden = !sidebar.hidden;
	})
	set_answers_event();
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
		socket.emit("get_datas", window.location.pathname.substr(1));
		get_account(user=>{
			users.push(user.displayName);
			update_users_list()
			document.querySelector(".loading.page").hidden = true;
			document.querySelector(".main.page").hidden = false;
			let name = window.location.pathname.substr(1);
			socket.emit("joined", user, name);
			document.querySelector(".leaveRoom").addEventListener("click", e=>{
				if(confirm("Are you sure you want quit ?")){
					socket.emit("leave", user, name)
					window.location.href = window.location.origin
				}
			})
		})
	}).on("data", (data,name)=>{
		users = users.concat(users, data);
		update_users_list()
	}).on("fail", (e)=>{
		alert(e);
		window.location.href = window.location.origin;
	}).on("chatMessage", data=>{
		let {displayName, text, date} = data;
		sendMessage(displayName,text,date);
	}).on("chatInfo", (date, type, displayName)=>{
		//console.log("info", type);
		if (type == "join") users.push(displayName);
		else if (type == "leave") users.splice(users.indexOf(displayName), 1);
		update_users_list()
		sendInfo(displayName,type,date);
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
});
