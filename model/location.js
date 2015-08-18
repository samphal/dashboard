var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var LocationSchema = new mongoose.Schema({
	username : {
		type: Schema.Types.ObjectId, 
      	ref: 'User'
	},
	date : {
		 type : String,
		 required : true
	},
	locations : [{
		loc : { latitude : {type : Number},longitude : {type : Number}},
		datetime : { type : Date }
	}],
	shops : [{
		loc : { lat : {type : Number},long : {type : Number}},
		datetime : { type : Date }
	}]
});

LocationSchema.index({username: 1, date: 1}, {unique: true});

mongoose.model('Location', LocationSchema);