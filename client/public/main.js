var homecloud = homecloud || {}

homecloud.galleryController = function(){
  const picHolder = document.getElementById('picRows');
  const dirHolder = document.getElementById('dirRows');
  const body = document.querySelector('body');
  let fullscreenElement = "";
  let imageInfoElement = "";
  let api = homecloud.serverManager.getServer();
  let userToken = homecloud.serverManager.getToken();

  const queryString = location.search;
  const urlParams = new URLSearchParams(queryString);
  const curDir = urlParams.get("path") || "";
  const curNesting = urlParams.get("nesting") || 0;
  const curSortBy = urlParams.get("sortBy") || "date";
  let curRoots = [];
  const slider = document.querySelector("#heightSlider");
  let pageImageNames = []
  let pageImages = []
  let sliderValue = 400;
  let picHolderPosition = 0;
  let pageHeight = 0;
  let imageRowBuffer = [];
  let loadingDataRow = false;
  let numImageDataLoaded = 0;

  console.log(curDir);

  slider.max = window.innerWidth;

  homecloud.serverManager.beginListening(()=>{
    api = homecloud.serverManager.getServer()
    userToken = homecloud.fbAuthManager.token
    if(api) {
      document.getElementById("CALink").href = api;
      // console.log(`help ${document.getElementById("CALink").href}`)
      startUp();
    }
    else console.log("No server set up.  You can do this through the server client (localhost:29990).")
  })

  async function startUp() {
    fetch(api+'getRoots', {
      method: 'GET',
      // withCredentials: true,
      // credentials: 'include',
      // headers: {
      //     'Authorization': userToken
      // }
    })
      .then(rawRoots => rawRoots.json())
      .then(newRoots => {
        curRoots = newRoots;
        (async ()=>{
          const dirs = (await (await fetch(`${api}getAllDirs?path=${encodeURIComponent(curDir)}`)).json()).sort();
          console.log(dirs);
          const images = await (await fetch(`${api}getAllImages?path=${encodeURIComponent(curDir)}&nesting=${curNesting}`)).json();
          console.log(images);
      
          selectDirectories(curDir, dirs);
          
          selectImages(images, curSortBy);
        })();
      })
      .catch(err => {
        console.log(err)
        document.getElementsByClassName("page-container")[0].innerHTML += "Error connecting to server.  Most likely cause is an expered CA certificate." + 
          '<a class="nav-link" href="'+api+'">Click here, and if your browser prompts you about an untrusted source, go into advanced and click proceed to site.  Then return to this page.</a>'
      })
  }

  function htmlToElement(html) {
      var template = document.createElement('template');
      template.innerHTML = html;
      return template.content.firstChild;
  }

  async function appendImageDates(images) {
    return await fetch(api+'appendImageDates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: images.map(x=>{return{path: x}})
      })
    })
      .then(response => response.json())
      .then(data => {
        return data
      });
  }

  function selectDirectories(dir, subDirs) {
    subDirs.forEach(subDir => {
      let dirElem = htmlToElement(
        `<div class="dir-button">
          ${curRoots.includes(subDir)?subDir.replace(/^.*[\\\/]/, ''):subDir}
          <div class="dir-button-overlay"></div>
        </div>`);
      dirElem.onclick = () => {
          navigateToDirectory(dir+subDir);
      };
      
      dirHolder.appendChild(dirElem);
      fetch(`${api}getRandomImage?path=${encodeURIComponent(dir+subDir)}`)
      .then(image => image.text())
      .then(path => {
        // console.log(path);
        dirElem.appendChild(htmlToElement(`<img src="${getImageUrl(path)}" alt="buttonImage">`));
      })
    });
    // console.log(subDirs);
  }

  function getImageUrl(imagePath) {
    return api+`imageByPath?path=${encodeURIComponent(imagePath)}&authorization=TOKEN ${userToken}`;
  }

  async function selectImages(rawImages, sortBy) {
    let images = rawImages
    if(sortBy == "date") {
      images = await appendImageDates(images)
      images = images.sort((a,b)=> a.mtime < b.mtime?1:-1)
      // console.log(images);
      images = images.map(x=>x.path)
    }
    else if(sortBy == "random") {
      images = shuffle(images)
    }
    else images = images.sort();
    // console.log("images");

    pageImageNames = images;

    loadPictureDataRow();

    setSlider();
    setWindowResize();
    setWindowScroll();
    setKeyDown();
  }

  function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }

  async function fetchSinglePictureData(index) {
    numImageDataLoaded++;
    // console.log("fetching "+index+" "+pageImageNames[index]);
    return await fetch(api+'getSingleImageData?path='+encodeURIComponent(pageImageNames[index]))
    .then(response => response.json())
    .then(image => {
      // console.log(image);
      return {
        name: image.name,
        dir: image.dir,
        path: image.dir+image.name,
        width: image.width,
        height: image.height,
        mtime: image.mtime,
        ratio: 1,
        index: index,
        url: getImageUrl(image.dir+image.name),
        element: htmlToElement(`<div class="pin"><div class="pin-overlay2"></div>`)
      };
    }).catch(err => {
      return undefined;
    });
    
    
  }

  async function loadPictureDataRow() {
    if(loadingDataRow) return;
    loadingDataRow = true;
    let height = sliderValue == window.innerWidth? 9999:sliderValue;
    let widthBuffer = 0;
    const windowWidth = window.innerWidth-14;
    let effectiveWidth = windowWidth;
    imageRowBuffer.forEach(image => {
      widthBuffer += image.width*(height / image.height);
      effectiveWidth -= 14;
    });
    while(widthBuffer <= effectiveWidth && numImageDataLoaded < pageImageNames.length) {
      let image = await fetchSinglePictureData(numImageDataLoaded);
      if(!image) {
        pageImageNames.splice(numImageDataLoaded-1, 1);
        numImageDataLoaded--;
      }
      else {
        widthBuffer += image.width*(height / image.height);
        effectiveWidth -= 14;
        imageRowBuffer.push(image);
      }
    }
    let nextImage = imageRowBuffer.length>1 && numImageDataLoaded < pageImageNames.length? imageRowBuffer.pop():undefined;
    // console.log(imageRowBuffer);
    setRatios([...pageImages, ...imageRowBuffer], sliderValue);
    pageImages = [...pageImages, ...imageRowBuffer];
    imageRowBuffer = nextImage? [nextImage]:[];
    loadingDataRow = false;
    updateImages();
  }

  function addImageToPage(image) {
    let pinElem = image.element;
    let imageElem = htmlToElement(`<img src="${image.url}" alt="image">`);
    image.imageElem = imageElem;
    pinElem.onclick = () => body.appendChild(getFullscreenImage(image));
  }

  function setSlider() {
    slider.oninput = function() {
      sliderValue = this.value;
      // dirHolder.childNodes.forEach(x=>{x.style.width = `${sliderValue}px`; x.style.height = `${sliderValue}px`});
      let visibleImages = pageImages.filter(image=>document.body.contains(image.element));
      let preferedImages = visibleImages.filter(image => image.y >= posScrolled()-56-7);
      visibleImages = preferedImages.length>0?preferedImages:visibleImages;
      const focusImage = visibleImages.reduce((min,image)=> image.y<min.y? image:min,visibleImages[0]);
      setRatios(pageImages, this.value);
      console.log(focusImage);
      setScrollPosition(focusImage.y + picHolderPosition.y - 56);
      while (picHolder.firstChild) {
        picHolder.removeChild(picHolder.lastChild);
      }
      updateImages();
    };
  }

  function setWindowResize() {
    window.addEventListener('resize', ()=>{
      slider.max = window.innerWidth;
      let curWidth = window.innerWidth;
      setTimeout(() => {
        if(window.innerWidth == curWidth) {
          setRatios(pageImages, sliderValue);
          while (picHolder.firstChild) {
            picHolder.removeChild(picHolder.lastChild);
          }
          updateImages();
        }
      }, 100);
    });
  }

  function setWindowScroll() {
    window.addEventListener("scroll",  ()=>{
      updateImages();
    });
  }

  function handleImageVis(image) {
    let imageElem = image.imageElem;
    let pinElem = image.element;
    picHolderPosition = getElementPosition(picHolder);

    if(isImageInViewport(image)) {
      let pinElem = image.element;
      pinElem.style.width = image.width*image.ratio + "px";
      pinElem.style.height = image.height*image.ratio + "px";
      pinElem.style.transform = `translate(${image.x}px, ${image.y}px)`;
    }

    if(isImageInViewport(image) && numImageDataLoaded-imageRowBuffer.length==image.index+1 && numImageDataLoaded < pageImageNames.length) {
      // fetchSinglePictureData(image.index+1);
      loadPictureDataRow();
    }

    if(isImageInViewport(image) && !document.body.contains(pinElem)) {
      if(!imageElem) addImageToPage(image);
      showImage(image);
    }
    else if(!isImageInViewport(image) && document.body.contains(pinElem)) {
      pinElem.remove();
    }
  }

  function updateImages() {
    pageImages.forEach(image => handleImageVis(image));
  }

  function setKeyDown() {
    document.addEventListener("keydown", event => {
      if (event.isComposing) {
        return;
      }
      let visibleImages = pageImages.filter(image=>document.body.contains(image.element));
      // console.log(visibleImages);
      let preferedImages = visibleImages.filter(image => image.y >= posScrolled()-picHolderPosition.y-56-7);
      visibleImages = preferedImages.length>0?preferedImages:visibleImages;
      const focusImage = visibleImages.reduce((min,image)=> image.y<min.y? image:min,visibleImages[0]);
      switch(event.code) {
        case "ArrowDown":
          event.preventDefault();
          setScrollPosition(focusImage.y+focusImage.height*focusImage.ratio+14+picHolderPosition.y - 56);
          break;
        case "ArrowUp":
          event.preventDefault();
          let index = focusImage.index;
          while(preferedImages.length>0 && index>0 && pageImages[index].y==focusImage.y) index--;
          setScrollPosition(pageImages[index].y+picHolderPosition.y - 56);
          break;
      }
    });
  }

  function showImage(image) {
    let imageElem = image.imageElem;
    let pinElem = image.element;
    pinElem.style.width = image.width*image.ratio + "px";
    pinElem.style.height = image.height*image.ratio + "px";
    pinElem.style.transform = `translate(${image.x}px, ${image.y}px)`;
    pinElem.appendChild(imageElem);
    picHolder.appendChild(pinElem);
  }

  function setRatios(images, height) {
    height = height == window.innerWidth? 9999:height;
    let widthBuffer = 0;
    let yBuffer = 0;
    let imageBuffer = [];
    const windowWidth = window.innerWidth-14;
    let effectiveWidth = windowWidth;
    let rowHeight = 0;

    for(let i = 0; i<images.length; i++) {
      widthBuffer += images[i].width*(height / images[i].height);
      effectiveWidth -= 14;
      imageBuffer.push(images[i]);
      if(i==images.length-1 || widthBuffer+images[i+1].width*(height / images[i+1].height) > effectiveWidth) {
        rowHeight = (effectiveWidth/widthBuffer)*height;
        let y = yBuffer;
        yBuffer += rowHeight+14;
        let x = 0;
        imageBuffer.forEach(image => {
          image.ratio = rowHeight/image.height;
          image.y = y;
          image.x = x;
          x+=image.width*image.ratio+14
        });
        widthBuffer = 0;
        imageBuffer = [];
        effectiveWidth = windowWidth;
      }
    }

    pageHeight = yBuffer;
    picHolder.style.height = pageHeight+(numImageDataLoaded!=pageImageNames.length?height:0)+"px";
  }

  function posScrolled(){
    return window.pageYOffset || (document.documentElement || document.body.parentNode || document.body).scrollTop;
  }

  function setScrollPosition(pos) {
    // console.log("scrolling to ",pos);
    window.scrollTo(0,pos);
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    let res = (
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.left <= (window.innerWidth || document.documentElement.clientWidth)
    );
    // if(res) console.log(rect.top+" "+rect.left);
    return res;
  }

  function getElementPosition(el) {
    // yay readability
    for (var lx=0, ly=0;
        el != null;
        lx += el.offsetLeft, ly += el.offsetTop, el = el.offsetParent);
    return {x: lx,y: ly};
  }

  function isImageInViewport(image) {
    const rect = {
      top: image.y + picHolderPosition.y + image.height*image.ratio,
      bottom: image.y + picHolderPosition.y,
      left: image.x,
      right: image.x - image.height*image.ratio
    };
    let res = (
        rect.top >= posScrolled() &&
        rect.bottom <= posScrolled() + window.innerHeight
    );
    return res;
  }

  function isYInViewport(y) {
    const yPos = y + picHolderPosition.y;
    let res = yPos <= posScrolled() + window.innerHeight;
    return res;
  }

  function makeFullscreenImage() {
    let fullscreenElem = htmlToElement(`<div id="fullImage">
      <div id="darkenBack" onclick=closeElement(this.parentNode)></div>
      <button class="x-button" onclick="closeElement(this.parentNode)">x</button>
      <img src="" alt="fullImage" style="">
      <div id="fullImagePageNumber"></div>
    </div>`);
    let infoButton = htmlToElement(`<button class="i-button">i</button>`);
    let imageInfoModal = htmlToElement(`<div id="imageInfoModal" class="modal">
      <div class="modal-content">
        <span class="close" onclick="this.parentNode.parentNode.style.display = 'none'">&times;</span>
        <p></p>
        <p></p>
      </div>
    </div>`);
    infoButton.onclick = () => imageInfoModal.style.display = "block";
    window.onclick = function(event) {
      if (event.target == imageInfoModal) {
        imageInfoModal.style.display = "none";
      }
    }
    imageInfoModal.style.display = "none";
    fullscreenElem.appendChild(infoButton);
    fullscreenElem.appendChild(imageInfoModal);
    return fullscreenElem;
  }

  function getFullscreenImage(image) {
    const fullscreenElem = fullscreenElement || makeFullscreenImage();
    fullscreenElement = fullscreenElem;
    updateFullscreenElement(fullscreenElem, image);

    document.addEventListener("keydown", event => {
      if(document.body.contains(fullscreenElem)) {
        if (event.isComposing) {
          return;
        }
        switch(event.code) {
          case "ArrowRight":
            image = pageImages[Math.min(image.index+1,pageImages.length-1)];
            updateFullscreenElement(fullscreenElem, image);
            break;
          case "ArrowLeft":
            image = pageImages[Math.max(image.index-1,0)];
            updateFullscreenElement(fullscreenElem, image);
            break;
        }
      }
    });

    let manager = new Hammer.Manager(fullscreenElem);
    let Swipe = new Hammer.Swipe();
    manager.add(Swipe);
    manager.on("swipeleft", () => {
      image = pageImages[Math.min(image.index+1,pageImages.length-1)]
      updateFullscreenElement(fullscreenElem, image);
    });
    manager.on("swiperight", () => {
      image = pageImages[Math.max(image.index-1,0)]
      updateFullscreenElement(fullscreenElem, image);
    });

    return fullscreenElem;
  }

  function updateFullscreenElement(fullscreenElem, image) {
    const imgElem = fullscreenElem.querySelector("img");
    const pageNumElem = fullscreenElem.querySelector("#fullImagePageNumber");
    const imageInfoElem = fullscreenElem.querySelector("#imageInfoModal");
    setScrollPosition(image.y + picHolderPosition.y - 56);
    imgElem.src = image.url;
    imageInfoElem.querySelectorAll("p")[0].innerHTML = `"${image.name.replace(/\.(png|jpe?g|svg|gif|jfif)$/i,'')}" from ${image.path}`;
    imageInfoElem.querySelectorAll("p")[1].innerHTML = `${image.mtime}`;
    if(fullscreenElem.clientHeight==0)
      imgElem.onload = function() {
        imgElem.style = image.width/image.height>fullscreenElem.clientWidth/fullscreenElem.clientHeight? "width:100%;":"height:100%;";
        imgElem.onload = ()=>{};
      };
    else {
      imgElem.style = image.width/image.height>fullscreenElem.clientWidth/fullscreenElem.clientHeight? "width:100%;":"height:100%;";
    }
    pageNumElem.innerHTML = `${image.index+1} of ${pageImageNames.length}`;
  }

  function navigateToDirectory(path) {
      location.href = `?path=${path}\\&nesting=${curNesting}&sortBy=date`;
  }
}

homecloud.initializePage = function() {
	if(homecloud.page == "main"){
    homecloud.serverManager = new homecloud.ServerManager();
    homecloud.galleryController();
    $("#signOutSideNavButton").click((event) => {
      console.log("sign out");
  
      firebase.auth().signOut().then(function() {
        // Sign-out successful.
        console.log("You are now signed out");
      }).catch(function(error) {
        // An error happened.
        console.log("Signed out error");
      });
      });
	}

  if(homecloud.page == "settings"){
    homecloud.serverManager = new homecloud.ServerManager();
    $("#signOutSideNavButton").click((event) => {
      console.log("sign out");
  
      firebase.auth().signOut().then(function() {
        // Sign-out successful.
        console.log("You are now signed out");
      }).catch(function(error) {
        // An error happened.
        console.log("Signed out error");
      });
    });
    console.log(homecloud.serverManager.getServer())
    homecloud.serverManager.beginListening(()=>{
      $("#serverIPInput").val(homecloud.serverManager.getServer());
    })
    $("#serverIPSave").click((event) => {
      homecloud.serverManager.setServer($("#serverIPInput").val())
    });
	}
};

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
    }, {merge: true})
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

var rand = function() {
  return Math.random().toString(36).substr(2); // remove `0.`
};

var token = function() {
  return rand() + rand(); // to make it longer
};

function closeElement(elem) {
  elem.remove();
}

homecloud.FbAuthManager = class {
	constructor() {
		this._user = null;
    this._token = undefined;
	}
	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user)=>{
			this._user = user;
      user.getIdToken().then((idToken)=>{
        this._token = idToken
        changeListener();
     });
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
	get token() {
		return this._token;
	}
};

homecloud.checkForRedirects = function() {
	if(homecloud.fbAuthManager.isSignedIn && homecloud.page == "login") {
		location.href = "/main";
	}
	if(!homecloud.fbAuthManager.isSignedIn && homecloud.page != "login") {
		location.href = "/";
	}
};

homecloud.fbAuthManager = new homecloud.FbAuthManager();
	homecloud.fbAuthManager.beginListening(()=>{
		console.log("auth change callback fired.");
		console.log("sign in: ", homecloud.fbAuthManager.isSignedIn);

		homecloud.checkForRedirects();

		homecloud.initializePage();
	});