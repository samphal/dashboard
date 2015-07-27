var mongoose = require('mongoose'),
	User = mongoose.model('User'),
	Location = mongoose.model('Location');

module.exports = function(app){

	app.post('/api/browser/users',function(req,res){
		var field_list = ['username','password','role'];
		
		if(has_required_field(req.body , field_list)){	
			var newUser = new User({username : req.body.username , password : req.body.password,role:req.body.role});
			newUser.save(function(err,user){
				if(err){
					console.log(JSON.stringify(err));
					res.status(500);
					res.end(JSON.stringify({message : err.message}));
				}else{
					res.end(""+user._id);
				}
			});
		}else{
			res.status(400);
			res.end("Bad Request");
		}
	});

	app.get('/api/android/users/username',function(req,res){
		User.find({role:"user"},{username:1},function(err,users){
			if(err){
				res.status(500);
				res.end("Internal Error");
			}else{
				res.end(JSON.stringify(users));
			}
		});
	});

	app.get('/api/android/shops/:userid/:day/:month/:year',function(req,res){
		var date = req.params.day+"/"+req.params.month+"/"+req.params.year;
		Location.findOne({username : req.params.userid,date:date},{shops:1,_id:0},function(err,location){
			if(err || location === null){
				res.status(500);
				res.end("Internal Error");
			}else{
				res.end(JSON.stringify(location.shops));
			}
		});
	});

	app.get('/api/android/shops/:day/:month/:year',function(req,res){
		var date = req.params.day+"/"+req.params.month+"/"+req.params.year;
		Location.find({date:date},{username:1,shops:1,_id:0})
		.populate('username','username -_id role')
		.exec(function(err,data){
			var finalData = [],obj = null;
			for(var i = 0 ,length = data.length ; i<length ; i++){
				if(data[i].username.role !== "user"){
					continue;
				}
				obj = {};
				obj.username = data[i].username.username;
				obj.count = data[i].shops.length;
				finalData.push(obj);
			}
			res.end(JSON.stringify(finalData));
		});
	});

	app.post('/api/android/login',function(req,res){
		var field_list = ['username','password'];
		
		if(has_required_field(req.body , field_list)){	
			User.findOne({username: req.body.username},{password:1,_id:1,failed_attempts:1,last_login:1,role:1},function(err,user){
				if(err){
					res.status(500);
					res.end(JSON.stringify({error:"Internal Error"}));
				}else if( user === null){
					res.status(401);
					res.end(JSON.stringify({error:"No such user exists"}));
				}else {
					if(user.failed_attempts > 2 && date_diff(user.last_login) < 1){
						res.status(401);
						res.end(JSON.stringify({error:"You r blocked for 30 minutes.."}));
					}else if(user.password !== req.body.password){
						res.status(401);
						res.end(JSON.stringify({error:"Your password is wrong."}));
						User.update({username: req.body.username},{$inc : {failed_attempts:1},$currentDate : {last_login : true}},function(err){
								
						});
					}else{
						User.update({username: req.body.username},{$set : {failed_attempts:0}},function(err){
								
						});
						res.end(JSON.stringify({id : user._id,role:user.role}));
					}
				}
			});
		}else{
			res.status(400);
			res.end(JSON.stringify({error : "Bad Request"}));
		}
	});

	app.post('/api/android/locations',function(req,res){

		var field_list = ['locations','email'];
		
		if(!has_required_field(req.body , field_list)){	
			res.status(400);
			res.end("Bad Request");
			return;
		}

		var data = group_by_date(req.body.locations);

		for(var i = 0 , length = data.length ; i < length ; i++){
			(function(index){
				Location.update({username : req.body.email , date : data[index].date},{$pushAll : {locations : data[index].locations , shops : []}},{upsert:true},
					function(err){
						if(err){
							res.status(500);
							res.end("Internal Error");
							return;
						}else{
							console.log("updated" + index);
						}
						if(index === length-1){
							res.end("updated");
						}
					});
			})(i);
		}
	});

	app.post('/api/android/shops',function(req,res){
		console.log(JSON.stringify(req.body));

		var field_list = ['shops','email'];
		
		if(!has_required_field(req.body , field_list)){	
			res.status(400);
			res.end("Bad Request");
			return;
		}

		var data = group_by_date(req.body.shops);
		console.log(data);

		for(var i = 0 , length = data.length ; i < length ; i++){
			(function(index){
				Location.update({username : req.body.email , date : data[index].date},{$pushAll : {shops : data[index].locations ,locations : []}},{upsert:true},
					function(err){
						if(err){
							res.status(500);
							res.end("Internal Error");
							return;
						}else{
							console.log("updated" + index);
						}
						if(index === length-1){
							res.end("updated");
						}
					});
			})(i);
		}
	});
};

function group_by_date(array){
	var group_by_date_array = [],obj={};
	for(var i = 0,length=array.length ; i<length ; i++){
		if(indexOf(group_by_date_array,format_date(array[i].datetime)) === -1){
			obj = {};
			obj.date = format_date(array[i].datetime);
			obj.locations = [];
			obj.locations.push(array[i]);
			group_by_date_array.push(obj);
		}else{
			group_by_date_array[indexOf(group_by_date_array,format_date(array[i].datetime))].locations.push(array[i]);
		}
	}

	return group_by_date_array;
}

function indexOf(array,element){
	for(var i = 0 , length = array.length ; i<length ; i++){
		if(array[i].date === element){
			return i;
		}
	}
	return -1;
}

function format_date(a){
  a= new Date(a);
  var date = a.getDate() < 10 ? "0"+a.getDate() : a.getDate();
  var month = a.getMonth() <10 ? "0"+a.getMonth() : a.getMonth();
  var formatted_date = date + "/" + month + "/"+a.getFullYear();
 return formatted_date;
}

function date_diff(date){
	var now = new Date();
	var minutes = parseInt((now - date) /1000/60);
	return minutes;
}

function has_required_field(obj , field_list){
	for(var counter = 0 , length_of_field_list = field_list.length ; counter < length_of_field_list ; counter++ ){
		if( typeof obj[field_list[counter]] === "undefined" ){
			console.log(field_list[counter]);
			return false;
		}
	}
	return true;
}