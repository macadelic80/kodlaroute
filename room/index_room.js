let users = [];
let settings = {
	audio: true,
	state: "waitingForPlayers",
	mqg: false,
	selected: null
}
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
let format_question = (question) => {
	let data = question.answers.map((x)=>`<div><input type="checkbox" name="scales"><label>${x.value}</label></div>`)
	return "<ul id='question_list'>" + data.join("") + "</ul>";
}

let create_question = (x, index) => {
	let data = `
		<div id="section">
			<div id="id_question">
				Question <span>${index + 1}</span> sur <span>50</span> </div>
			<div>
				<div>
					<p><img src="${x.picture}" alt=""></p>
					<p>${x.question}</p>
				</div>
				${format_question(x)}
			</div>
		</div>
		<button id="next">Next</button>
		`
		return data;
}

let sendMessage = (displayName, isHost, text, date) =>{
	let div = document.createElement("div");
	let chat = document.querySelector(".log")
	div.innerHTML = `
    <span class="time">${date}</span>
    ${isHost ? "<span>⭐</span>": ""}
    <span class="author">${displayName}:</span>
	<span class="text">${text}</span>
	`
	chat.appendChild(div);
	if (!(chat.scrollTop >= chat.scrollHeight - chat.clientHeight - 15))
		chat.scrollBy(1, 5000)
}

let update_users_list = () => {
	let players = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.players");

	document.querySelector("body > div.top > div.info > span.chatterCount").innerText = users.length;
	players.innerHTML = users.join("</br>")
}

let sendInfo = (displayName, text, date) =>{
	let messages = {
		"join": " a rejoint la partie.",
        "leave": " a quitté la partie.",
        "ban": " a été banni.",
		"QCM": ""
	};
	let div = document.createElement("div");
	div.innerHTML = `
	<span class="time">${date}</span><span class="author">${displayName + messages[text]}</span>
	`
	document.querySelector(".log").appendChild(div);
}
let start = ()=> {
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
				socket.emit("chat", text, user)
			})
	    document.querySelector("#textBox").value = "";
	  }
	})

	let chat = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.chat");
	let players = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.players");
	let options = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.options");
	let chat_header = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.actions > a.chat")
	let options_header = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.actions > a.options")
	let players_header = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.actions > a.players")

	chat_header.addEventListener("click", event=>{
		chat.hidden = false;
		options.hidden = true
		players.hidden = true
	})
	options_header.addEventListener("click", event=>{
		chat.hidden = true
		options.hidden = false
		players.hidden = true
	})
	players_header.addEventListener("click", event=>{
		chat.hidden = true
		options.hidden = true
		players.hidden = false
	})
	let audio = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.options > table > tbody > tr:nth-child(1) > td:nth-child(2) > select");
	audio.addEventListener("change", event=>{
		let selection = event.target.value;
		settings.audio = selection == "true";
	})
	let mqg = document.querySelector("body > div.pages > div.main.page > div.sidebar > div.options > table > tbody > tr:nth-child(2) > td:nth-child(2) > select");
	mqg.addEventListener("change", event=>{
		let selection = event.target.value;
		socket.emit("mqg", selection == "true");
		settings.mqg = selection == "true";
	})
	let joinGame = document.querySelector("#joinGame")
	joinGame.addEventListener("click", event=>{
		joinGame.hidden = true;
		quitGame.hidden = false;
		socket.emit("join");
	})
	let quitGame = document.querySelector("#quitGame")
	quitGame.addEventListener("click", event=>{
		quitGame.hidden = true;
		joinGame.hidden = false;
		socket.emit("quit");
    })
    document.querySelector(".leaveRoom").addEventListener("click", e=>{
        if(confirm("Are you sure you want quit ?")){
            socket.emit("leave", user)
            window.location.href = window.location.origin
        }
    })
	socket.on("connect", ()=>{
		console.log("Connecté au serveur");
		get_account(user=>{
			document.querySelector(".loading.page").hidden = true;
			document.querySelector(".main.page").hidden = false;
			let name = window.location.pathname.substr(1);
			socket.emit("joined", user, name);
			socket.emit("get_datas");
		})
	}).on("uAreBanned", ()=>{
        document.querySelector("#bannedPage").hidden = false;
        document.querySelector("#loadingPage").hidden = true;
		document.querySelector(".main.page").hidden = true;
    }).on("host", ()=>{
		let button = document.createElement("button")
		button.innerText = "Lancer la partie"
		button.addEventListener("click", (event) => {
			socket.emit("start_game");
		})
		document.querySelector(".game").appendChild(button)
	}).on("data", (data,name)=>{
		console.log("data", data, name)
		users = users.concat(data);
		update_users_list()
	}).on("fail", (e)=>{
		alert(e);
		window.location.href = window.location.origin;
	}).on("chatMessage", data=>{
		let {displayName, isHost, text, date} = data;
		sendMessage(displayName,isHost, text,date);
	}).on("chatInfo", (date, type, displayName)=>{
		//console.log("info", type);
		if (type == "join") users.push(displayName);
		else if (type == "leave") users.splice(users.indexOf(displayName), 1);
		update_users_list()
		sendInfo(displayName,type,date);
	}).on("set_question", (question, index)=>{
		console.log(question, index);
		document.querySelector(".game").innerHTML = create_question(question, index);
		set_answers_event();
		let next = document.querySelector("#next");
		next.addEventListener("click", event=>{
			let a = [...document.querySelector("#question_list").children].filter(x=>x.children[0].checked).length;
			let selected = [...document.querySelector("#question_list").children].findIndex(x=>x.children[0].checked)
			if (a == 1 && ~selected) socket.emit("validate", selected);
			else sendInfo("Il faut choisir une seule reponse", "QCM", get_date());
		})
	}).on("bannedUser", displayName => {
        users.splice(users.indexOf(displayName), 1);
        sendInfo(displayName,type,date);
    })
}

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
