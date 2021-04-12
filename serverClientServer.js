const express = require('express');
const httpPort = process.env.PORT || 29991;
const app = express();
var fs = require('fs');
const cors = require('cors');
const bodyParser = require("body-parser");
const publicIp = require('public-ip');

app.use(cors());
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/', bodyParser.json());

const rootPaths = require("./rootPaths.json")

app.post('/api/updateRootPaths', async (req, res) => {
    if(req.body.rootPaths) {
        console.log(req.body.rootPaths);
        var name = 'rootPaths.json';
        fs.writeFileSync(name, JSON.stringify(req.body.rootPaths));
    }
});

app.get('/api/getRoots', (req, res) => {
  res.send(JSON.parse(fs.readFileSync('rootPaths.json').toString()));
});

app.get('/api/getIP', (req, res) => {
    (async () => {
        const ipaddr = await publicIp.v4();
        res.send('https://'+ipaddr+':29980/api/');
    })();
});

app.post('/api/updateAuthedUsers', async (req, res) => {
    if(req.body.authedUsers) {
        console.log(req.body.authedUsers);
        var name = 'authedUsers.json';
        var authedUsers = fs.existsSync(name)?JSON.parse(fs.readFileSync(name).toString()):{}
        authedUsers.additionalUsers = req.body.authedUsers
        fs.writeFileSync(name, JSON.stringify(authedUsers));
    }
});

app.get('/api/getAuthedUsers', (req, res) => {
    var name = 'authedUsers.json';
  res.send(fs.existsSync(name)?JSON.parse(fs.readFileSync(name).toString()):{});
});

app.post('/api/updateServerOwner', async (req, res) => {
    if(req.body.owner) {
        console.log(req.body.owner);
        var name = 'authedUsers.json';
        var authedUsers = fs.existsSync(name)?JSON.parse(fs.readFileSync(name).toString()):{}
        authedUsers.owner = req.body.owner
        fs.writeFileSync(name, JSON.stringify(authedUsers));
    }
});

app.listen(httpPort, () => console.log(`Listening on port ${httpPort}`));