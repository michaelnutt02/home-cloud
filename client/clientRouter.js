var express = require("express");
var app = express();
var path = require('path');
app.use('/', express.static("public"));
app.listen(3000);

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/main.html'));
});
