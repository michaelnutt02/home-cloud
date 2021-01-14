const express = require('express');
const https = require("https");
const app = express();
const httpsPort = process.env.PORT || 29979;
const httpPort = process.env.PORT || 29980;
const cors = require('cors');
const fs = require('fs');
const bodyParser = require("body-parser");
const sizeOf = require('image-size');
const { promisify } = require('util');
const sizeOfC = promisify(require('image-size'));
const asyncRoute = require('route-async')
const { fdir } = require("fdir");
const fg = require('fast-glob');
const { readdirSync } = require('fs')

const options = {
  key: fs.readFileSync("certs/dev-key.pem"),
  cert: fs.readFileSync("certs/rootSSLnopass.pem")
};

// var redbird = new require('redbird')({
// 	port: 8080,
// 	ssl: {
// 		port: httpsPort,
// 		key: "certs/dev-key.pem",
// 		cert: "certs/rootSSLnopass.pem",
// 	}
// });

const rootPaths = require("./rootPaths.json")
// const crawler = new fdir().withBasePath();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/', bodyParser.json());

app.get('/api/imageByNameID/name/:name/id/:id', (req, res) => {
  res.sendFile(maps[req.params.name]+req.params.id);
});

app.get('/api/imageByPath', (req, res) => {
  res.sendFile(req.query.path);
});

app.get('/api/getImageUrl', (req, res) => {
  res.sendFile(req.query.path);
});

const delay = ms => new Promise(res => setTimeout(res, ms));
// for(let i = 1; i<5999999999; i++) {}

app.get('/api/hogEverything', asyncRoute(async (req, res) => {
  console.log("hogging");
  // await delay(5000);
  for(let i = 1; i<5999999999; i++) {}
  console.log("done hogging");
  res.send(["done"]);
}));

app.get('/api/getRoots', (req, res) => {
  res.send(rootPaths);
});

app.get('/api/getImageNames', (req, res) => {
  if(!req.query.path) res.json([]);
  else {
    let dir = req.query.path;
    console.log(dir);
    fs.readdir(dir, (err, files) => {
      res.send(files? files
        .filter(file =>  {
          let stat = fs.statSync(dir+file);
          return stat && !stat.isDirectory() && /\.(png|jpe?g|svg|gif)$/i.test(file);
        }):[]);
    });
  }
});

app.post('/api/appendImageDates', async (req, res) => {
  if(!req.body.images) res.json([]);
  else {
    let images = req.body.images
    images = await Promise.all(images.map(async image => {
      var stats = await fs.statSync(image.path);
      return {...image, mtime : stats.mtime};
    }));
    // console.log(JSON.stringify(images))
    res.send(images);
  }
});

app.get('/api/getAllImages', (req, res) => {
  const nesting = req.query.nesting || 0;
  if(!req.query.path || !rootPaths.some(x=>req.query.path.includes(x))) {
    //res.send(rootPaths.reduce((prev,dir) => [...prev, ...getAllImages(dir, nesting)],[]));
    res.send([]);
  }
  else {
    let dir = req.query.path;
    res.send(getAllImages(dir, nesting));
  }
});

app.get('/api/getRandomImage', (req, res) => {
  if(!req.query.path || !rootPaths.some(x=>req.query.path.includes(x))) {
    res.send("");
  }
  else {
    const randImage = getRandomImage(req.query.path)
    // console.log(randImage);
    res.send(randImage);
  }
});

app.get('/api/getAllDirs', (req, res) => {
  const nesting = req.query.nesting || 0;
  if(!req.query.path || !rootPaths.some(x=>req.query.path.includes(x))) {
    //res.send(rootPaths.reduce((prev,dir) => [...prev, ...getAllImages(dir, nesting)],[]));
    res.send(rootPaths);
  }
  else {
    let dir = req.query.path;
    res.send(getAllDirs(dir));
  }
});

app.get('/api/getRandomImageNames', (req, res) => {
  if(!req.query.path) res.json([]);
  else {
    let dir = req.query.path;
    console.log(dir);
    fs.readdir(dir, (err, files) => {
      let filteredImages = getRandomImage(dir, files)
      // if(!filteredImages || !filteredImages.some(x=>!!x)) getDirectoryNames(dir, (dirs) => searchNestedForImages(dirs.map(x=>dir+x+"/"), [], (nImages)=>res.send(nImages)));
      if(!filteredImages || !filteredImages.some(x=>!!x)) res.send(getRandomImageObject(getAllImagesWithNested(dir)));
      else {
        res.send(filteredImages);
      }
    });
  }
});

function getAllImagesWithNested(dir) {
  const files = new fdir()
  .withBasePath()
  .crawl(dir[dir.length-1]=="\\"?dir.substring(0,dir.length-1):dir)
  .sync();
  return files
  .map(file => {
    return {
      name: file.replace(/^.*[\\\/]/, ''),
      dir: file.replace(/[^\\]+$/, '')
    };
  });
}

function getAllImages(dir, nesting) {
  console.log("getting all images for "+dir);
  const files = new fdir()
  .withBasePath()
  .withMaxDepth(nesting)
  .crawl(dir[dir.length-1]=="\\"?dir.substring(0,dir.length-1):dir)
  .sync()
  .filter(file=>/\.(png|jpe?g|svg|gif)$/i.test(file))
  return files;
}

function getRandomImage(dir) {
  const files = new fdir()
  .withBasePath()
  .crawl(dir[dir.length-1]=="\\"?dir.substring(0,dir.length-1):dir)
  .sync()
  .filter(file=>/\.(png|jpe?g|svg|gif)$/i.test(file))
  return files[Math.floor(Math.random() * files.length)];
}

function getAllDirs(dir) {
  console.log("getting all dirs for "+dir);
  return readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
}

function searchNestedForImages(dirs, images, callback) {
  mergeInfiniteSubDirs(dirs, images, mergedImages=>callback(getRandomImageObject(mergedImages)));
}

function mergeInfiniteSubDirs(dirs, images, callback) {
  // console.log(dirs[0]);
  if(dirs[0]) fs.readdir(dirs[0], (err, files) => {
    const subDirs = files? files.filter(file =>  {
      let stat = fs.statSync(dirs[0]+file);
      return stat && stat.isDirectory();
    }).map(x=>dirs[0]+x+"/"):[];
    const dirImages = files? files.filter(file => /\.(png|jpe?g|svg|gif)$/i.test(file)).map(file => {
      return {
        name: file,
        dir: dirs[0]
      };
    }):[];
    if(subDirs && subDirs.length>0) mergeInfiniteSubDirs(subDirs, dirImages, (subImages)=>mergeInfiniteSubDirs(dirs.splice(1,dirs.length), [...images,...subImages], callback));
    else mergeInfiniteSubDirs(dirs.splice(1,dirs.length), [...images,...dirImages], callback);
  });
  else callback(images);
}

function mergeSubDirs(dirs, images, callback) {
  if(dirs[0]) fs.readdir(dirs[0], (err, files) => {
    let selectedImages = undefined;
    if(!!files) selectedImages = files
      .map(file => {
        return {
          name: file,
          dir: dirs[0]
        };
      });
      mergeSubDirs(dirs.splice(1,dirs.length), [...images,...selectedImages], callback);
  });
  else {
    callback(images);
  }
}

function getRandomImageObject(files) {
  const images = files
  .filter(file =>  {
    return /\.(png|jpe?g|svg|gif)$/i.test(file.name);
  })
  const selectedImages = [images[Math.floor(Math.random()*images.length)]].filter(x=>x && !!x.name);
  return selectedImages? selectedImages:[];
}

app.post('/api/getImageData', async (req, res) => {
  if(!req.body.images) res.json([]);
  else {
    res.send(
      req.body.images.map(file => {
        try{
          let dimensions = sizeOf(file);
          return {
            name: file.replace(/^.*[\\\/]/, ''),
            dir: file.replace(/[^\\]+$/, ''),
            width: dimensions.width,
            height: dimensions.height
          };
        } catch (err) {
          // console.log(err);
        }
      })
      .filter(x=>!!x)
    );
  }
});

app.post('/api/getImageDataC', async (req, res) => {
  if(!req.body.images) res.json([]);
  else {
      let response = (await Promise.all(req.body.images.map(async file => {
        try{
          let dimensions = await sizeOfC(file);
          let stats = await fs.statSync(file);
          return {
            name: file.replace(/^.*[\\\/]/, ''),
            dir: file.replace(/[^\\]+$/, ''),
            width: dimensions.width,
            height: dimensions.height,
            mtime: stats.mtime
          };
        } catch (err) {
          // console.log(err);
        }
      })))
      .filter(x=>!!x)
    
      res.send(response);
  }
});

app.get('/api/getSingleImageData', async (req, res) => {
  if(!req.query.path) res.send({});
  else {
    const file = req.query.path;
    // console.log(file);
    try{
      let dimensions = await sizeOfC(file);
      let stats = await fs.statSync(file);
      res.send({
        name: file.replace(/^.*[\\\/]/, ''),
        dir: file.replace(/[^\\]+$/, ''),
        width: dimensions.width,
        height: dimensions.height,
        mtime: stats.mtime
      });
    } catch (err) {
      // console.log(err);
      res.send(undefined);
    }
  }
});

app.get('/api/getImageDataFromDir', (req, res) => {
  if(!req.query.path) res.json([]);
  else {
    let dir = req.query.path;
    console.log(dir);
    fs.readdir(dir, (err, files) => {
      res.send(files? files
        .filter(file =>  {
          return /\.(png|jpe?g|svg|gif)$/i.test(file);
        })
        .map(file => {
          try{
            let dimensions = sizeOf(dir+file);
            return {
              name: file,
              width: dimensions.width,
              height: dimensions.height
            };
          } catch (err) {
            // console.log(err);
          }
        })
        .filter(x=>!!x):[]);
    });
  }
});

/*
sizeOf(dir+file, (err, dimensions)=> {
            if(err) {
              // console.log(err);
            }
            else {
              ret.push({
                name: file,
                width: dimensions.width,
                height: dimensions.height
              });
              numRead++;
              if(numRead == numToRead) {
                res.send(ret);
              }
            }
          });
*/

app.get('/api/getDirectoryIDs', (req, res) => {
  if(!req.query.path) res.json(rootPaths);
  else {
    let dir = req.query.path;
    getDirectoryNames(dir, (dirs) => res.json(dirs));
  }
})

function getDirectoryNames(dir, callback) {
  fs.readdir(dir, (err, files) => {
    callback(files? files.filter(file =>  {
      let stat = fs.statSync(dir+file);
      return stat && stat.isDirectory();
    }):[]);
  });
}

app.listen(httpPort, () => console.log(`Listening on port ${httpPort}`));
https.createServer(options, app).listen(httpsPort);
// redbird.register('localhost', `http://localhost:${httpPort}`, {ssl: true});