const api = 'http://localhost:29991/api/'

function saveRootPaths() {
    var rootPathText = document.getElementById('rootPathsInput').value
    var rootPathArray = rootPathText.replaceAll(', ',',').split(',')
    console.log(rootPathArray)

    fetch(api+'updateRootPaths', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rootPaths: rootPathArray
        })
      })
}

var rand = function() {
    return Math.random().toString(36).substr(2); // remove `0.`
};

var token = function() {
    return rand() + rand(); // to make it longer
};

homecloud.initializePage = function() {
    if(homecloud.page == 'main') {
        homecloud.serverManager = new homecloud.ServerManager();

        homecloud.serverManager.beginListening(()=>{
            let token = homecloud.serverManager.getToken()
            fetch(api+'setToken', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  token: [token]
                })
              })
        });

        fetch(api+'getRoots')
            .then(response => response.json())
            .then(roots => {
                document.getElementById('rootPathsInput').value = roots.join(',')
            })

        fetch(api+'getIP')
            .then(response => response.text())
            .then(ip => {
                document.getElementById('serverIP').innerHTML = 'Server IP: '+ip
            })
    }
}

homecloud.ServerManager = class {
	constructor() {
	  this._documentSnapshots = undefined;
	  this._ref = firebase.firestore().collection("users").doc(homecloud.fbAuthManager.uid);
	  this._unsubscribe = null;
	}
	setServer(server) {  
    console.log(`adding ${server}`);
    
		this._ref.set({
      server: server
    })
    .then(function() {
        console.log("Server Added");
    })
    .catch(function(error) {
        console.error("Error writing document: ", error);
    });
	}
	beginListening(changeListener) {    
		this._unsubscribe = this._ref
		.onSnapshot((querySnapshot) => {
				console.log("Retrieved User Data");
				this._documentSnapshots = querySnapshot;
				changeListener();
			});
  }
  getServer() {
    if(!this._documentSnapshots) return undefined;
    const docSnapshot = this._documentSnapshots.data();
    if(!docSnapshot) return undefined;
    return docSnapshot["server"];
  }
  getToken() {
    if(!this._documentSnapshots) return undefined;
    const docSnapshot = this._documentSnapshots.data();
    if(!docSnapshot) return undefined;
    if(!docSnapshot["token"]) {
      this._ref.set({
        token: token()
      }, {merge: true})
      .then(function() {
          console.log("Token Added");
      })
      .catch(function(error) {
          console.error("Error writing document: ", error);
      });
    }
    return docSnapshot["token"];
  }
}

homecloud.FbAuthManager = class {
    constructor() {
        this._user=null;
    }
    beginListening(changeListener) {
        firebase.auth().onAuthStateChanged((user)=>{
            this._user = user;
            changeListener();
        })
    }
    get isSignedIn() {
        return !!this._user;
    }
    get uid() {
        return this._user.uid;
    }
    get photoURL() {
        return this._user.photoURL;
    }
};

homecloud.checkForRedirects = function() {
    if(homecloud.fbAuthManager.isSignedIn && homecloud.page == "login") {
        location.href = "/";
    }
    if(!homecloud.fbAuthManager.isSignedIn && homecloud.page != "login") {
        location.href = "/login";
    }
};

homecloud.fbAuthManager = new homecloud.FbAuthManager();
    homecloud.fbAuthManager.beginListening(()=>{
        console.log("auth change callback fired.");
        console.log("sign in: ", homecloud.fbAuthManager.isSignedIn);

        homecloud.checkForRedirects();

        homecloud.initializePage();
    });