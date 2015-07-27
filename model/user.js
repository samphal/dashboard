var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    validate = require('mongoose-validator');

var roleValidator = [
		validate({validator : function(value){
			var roles = ['admin','user'];
			if(roles.indexOf(value) === -1){
				return false;
			}
			return true;
		},
		message : 'wrong role'})
	];

var UserSchema = new mongoose.Schema({
	username : {
		type : String,
		required : true,
		unique : true
	},
	password : {
		type : String,
		required : true
	},
	failed_attempts : {
		type : Number,
		default : 0
	},
	role : {
		type : String,
		required : true,
		validate : roleValidator
	},
	last_login : {
		type : Date,
		default : Date.now
	}
});

var User = mongoose.model('User', UserSchema);

User.schema.path('role').validate(function (value) {
  return /admin|user/i.test(value);
}, 'Invalid role');