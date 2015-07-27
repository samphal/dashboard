var express = require('express.io'),
    app = express().http().io(),
    mongoose = require('mongoose'),
    db = mongoose.connect('mongodb://localhost/cowork2');

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({ secret: 'abc' }));
app.use(express.static('../app'));

app.use(function  (req,res,next) {
	console.log(req.url);
	next();
});

require('./model/user');
require('./model/location');
app.listen(8102);
require('./routes/routes')(app);

console.log('Express server started on port 8102');