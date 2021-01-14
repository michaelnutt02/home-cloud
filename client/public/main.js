var homecloud = homecloud || {}

homecloud.galleryController = function(){
  const picHolder = document.getElementById('picRows');
  const dirHolder = document.getElementById('dirRows');
  const body = document.querySelector('body');
  let fullscreenElement = "";
  let imageInfoElement = "";
  let api = homecloud.serverManager.getServer();
  /*"http://10.0.0.8:29980/api/" //184.56.81.118 | 192.168.1.121 | localhost 
  | C:\Users\Michael\Downloads\upnpc-exe-win32-20080925\upnpc-shared.exe -a 73.103.113.150 29979 29979 TCP*/

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
    if(api) startUp();
    else console.log("No server set up.  I'm lazy so you have to do that through the console.")
  })

  async function startUp() {
    curRoots = await (await fetch(api+'getRoots')).json();
    const dirs = (await (await fetch(`${api}getAllDirs?path=${encodeURIComponent(curDir)}`)).json()).sort();
    console.log(dirs);
    const images = await (await fetch(`${api}getAllImages?path=${encodeURIComponent(curDir)}&nesting=${curNesting}`)).json();
    console.log(images);

    selectDirectories(curDir, dirs);
    
    selectImages(images, curSortBy);
  }

  function imagesAtNesting(nesting, myImageTree) {
    let images = myImageTree.images || [];
    if(nesting == 0) return images;
    Object.keys(myImageTree).forEach(x=> images = [...images, ...imagesAtNesting(nesting-1, myImageTree[x])])
    return images;
  }

  function htmlToElement(html) {
      var template = document.createElement('template');
      template.innerHTML = html;
      return template.content.firstChild;
  }

  function fetchAllPictures(dir, callback) {
    fetch(api+'getAllImages?path='+encodeURIComponent(dir))
    .then(response => response.json())
    .then(rawImages => {
      console.log(rawImages);
      try {
        sessionStorage.setItem('allImages', JSON.stringify(rawImages));
      } catch (err) {
        allPicturesTooBig = true;
      }
      curAllImages = rawImages;
      callback();
    });
  }

  async function allImages() {
    return clientImagePaths || !allPicturesTooBig? JSON.parse(sessionStorage.getItem('allImages')) : 
      (curAllImages? curAllImages :
      await fetch(api+'getAllImages?path='+encodeURIComponent(curDir))
      .then(response => response.json()));
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

  async function imageTree() {
    let imageTree = {};
    (await allImages()).filter(x=>x.includes(curDir)).forEach(image => {
      let pathArray = image.replace(curDir,'').split("\\");
      pathArray.reduce((prev,value) => (value==pathArray[pathArray.length-1]?
        (prev.images? prev.images.push(image):prev.images = [image])
        :(prev[value] = prev[value] || {}), prev[value]), imageTree);
    });
    if(curRoots.some(root => {
      let pathArray = root.split("\\");
      return pathArray.some(x=>imageTree[x]);
    })) imageTree = curRoots.reduce((p,n) => {return{...p, [n]:imageTree[n]}},{})
    console.log(imageTree);
    return imageTree;
  }

  function selectDirectories(dir, subDirs) {
    subDirs.forEach(subDir => {
      let dirElem = htmlToElement(`<div class="dir-button">${curRoots.includes(subDir)?subDir.replace(/^.*[\\\/]/, ''):subDir}<div class="dir-button-overlay"></div></div>`);
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
    return api+'imageByPath?path='+encodeURIComponent(imagePath);
  }

  async function selectImages(rawImages, sortBy) {
    let images = rawImages
    if(sortBy == "date") {
      images = await appendImageDates(images)
      images = images.sort((a,b)=> a.mtime < b.mtime?1:-1)
      // console.log(images);
      images = images.map(x=>x.path)
    }
    else images = images.sort();
    // console.log("images");

    pageImageNames = images;

    // fetchPictureData(0);
    loadPictureDataRow();

    setSlider();
    setWindowResize();
    setWindowScroll();
    setKeyDown();
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
        element: htmlToElement(`<div class="pin"><div class="pin-overlay"></div>`)
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
    imageInfoElem.querySelectorAll("p")[0].innerHTML = `"${image.name.replace(/\.(png|jpe?g|svg|gif)$/i,'')}" from ${image.path}`;
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

  function closeElement(elem) {
    elem.remove();
  }

  function navigateToDirectory(path) {
      location.href = `?path=${path}\\&nesting=${curNesting}&sortBy=date`;
  }

  function navigateToNesting(nesting) {
    location.href = `?path=${curDir}\\&nesting=${nesting}&sortBy=date`;
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