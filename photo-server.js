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
const natUpnp = require('nat-upnp');

const options = {
  key: fs.readFileSync("certs/dev-key.pem"),
  cert: fs.readFileSync("certs/rootSSLnopass.pem")
};

function getRootPaths() {
  return JSON.parse(fs.readFileSync('rootPaths.json').toString())
}

function getTokens() {
  return JSON.parse(fs.readFileSync('tokens.json').toString())
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/', bodyParser.json());

app.get('/api/imageByPath', (req, res) => {
  if (!req.query.authorization || req.query.authorization.indexOf('TOKEN ') === -1) {
    return res.status(401).json({ message: 'Missing Authorization Param' });
  }
  else if(getTokens().some(x=> req.query.authorization.substring(6) != x))
    return res.status(401).json({ message: 'Incorrect Authorization Param' });
  else res.sendFile(req.query.path);
});

app.get('/api/getRoots', (req, res) => {
  res.send(getRootPaths());
});

app.get('/api/getAllImages', (req, res) => {
  const nesting = req.query.nesting || 0;
  if(!req.query.path || !getRootPaths().some(x=>req.query.path.includes(x))) {
    //res.send(rootPaths.reduce((prev,dir) => [...prev, ...getAllImages(dir, nesting)],[]));
    res.send([]);
  }
  else {
    let dir = req.query.path;
    res.send(getAllImages(dir, nesting));
  }
});

app.get('/api/getAllDirs', (req, res) => {
  const nesting = req.query.nesting || 0;
  if(!req.query.path || !getRootPaths().some(x=>req.query.path.includes(x))) {
    //res.send(rootPaths.reduce((prev,dir) => [...prev, ...getAllImages(dir, nesting)],[]));
    res.send(getRootPaths());
  }
  else {
    let dir = req.query.path;
    res.send(getAllDirs(dir));
  }
});

app.get('/api/getRandomImage', (req, res) => {
  if(!req.query.path || !getRootPaths().some(x=>req.query.path.includes(x))) {
    res.send("");
  }
  else {
    const randImage = getRandomImage(req.query.path)
    // console.log(randImage);
    res.send(randImage);
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

function getAllImages(dir, nesting) {
  console.log("getting all images for "+dir);
  const files = new fdir()
  .withBasePath()
  .withMaxDepth(nesting)
  .crawl(dir[dir.length-1]=="\\"?dir.substring(0,dir.length-1):dir)
  .sync()
  .filter(file=>/\.(png|jpe?g|svg|gif|jfif)$/i.test(file))
  return files;
}

function getRandomImage(dir) {
  const files = new fdir()
  .withBasePath()
  .crawl(dir[dir.length-1]=="\\"?dir.substring(0,dir.length-1):dir)
  .sync()
  .filter(file=>/\.(png|jpe?g|svg|gif|jfif)$/i.test(file))
  return files[Math.floor(Math.random() * files.length)];
}

function getAllDirs(dir) {
  console.log("getting all dirs for "+dir);
  return readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
}

app.listen(httpPort, () => console.log(`Listening on port ${httpPort}`));
https.createServer(options, app).listen(httpsPort);
// redbird.register('localhost', `http://localhost:${httpPort}`, {ssl: true});
 
var client = natUpnp.createClient();
client.getMappings({ local: true }, function(err, results) {
    // console.log(results)
    if(results.some(portMap=>{
        return (portMap.public.port == 29980 && portMap.private.port == 29979) 
    })) console.log('port mapping found')
    else {
      console.log('setting up port map')
      client.portMapping({
          public: 29980,
          private: 29979,
          ttl: 0,
          description: 'myhomecloud.app'
        }, function(err) {
          if(err) console.log('fuck')
        });
  }
});