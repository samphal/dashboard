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

	app.get('/api/android/locations/:userid/:day/:month/:year',function(req,res){
		var date = req.params.day+"/"+req.params.month+"/"+req.params.year;
		Location.findOne({username : req.params.userid,date:date},{locations:1,_id:0},function(err,location){
			if(err){
				res.status(500);
				res.end("Internal Error");
			}else if(location === null){
				res.end(JSON.stringify([]));
			}else{
				// res.end(JSON.stringify(location.locations));
				console.log(JSON.stringify(minimum_15_minute_diff_locations(location.locations)));
				res.end(JSON.stringify(minimum_15_minute_diff_locations(location.locations)));
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

	app.get('/api/android/shops/:id/count/:day/:month/:year',function(req,res){
		var date = req.params.day+"/"+req.params.month+"/"+req.params.year;
		Location.findOne({date : date,username : req.params.id},{shops:1,_id:0,username:1})
		.populate('username','username -_id')
		.exec(function(err,location){
			if(err || location === null){
				res.json({code : 500 , message : "Internal Error"});
			}else{
				var data = {name : location.username.username , count : location.shops.length};
				res.json(data);
			}
		});
	});

	app.post('/api/android/login',function(req,res){
		var field_list = ['username','password'];
		var username_regex = new RegExp(["^",req.body.username,"$"].join(""),"i");

		if(has_required_field(req.body , field_list)){	
			User.findOne({username: username_regex},{password:1,_id:1,failed_attempts:1,last_login:1,role:1},function(err,user){
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

	app.post('/api/android/shops',function(req,res){

		console.log(JSON.stringify(req.body));

		var field_list = ['shops','email'];
		var shops = JSON.parse(req.body.shops);

		if(!has_required_field(req.body , field_list) || !reqired_format(shops)){	
			res.json({error:"Bad Request"});
			return;
		}

		var data = group_by_date(shops);

		for(var i = 0 , length = data.length ; i < length ; i++){
			(function(index){
				Location.update({username : req.body.email , date : data[index].date},{$pushAll : {shops : data[index].locations , locations : []}},{upsert:true},
					function(err){
						if(err){
							res.json({error : "Internal Error"});
							return;
						}else{
							console.log("updated" + index);
						}
						if(index === length-1){
							res.json({message : "updated"});
						}
					});
			})(i);
		}
	});

	app.post('/api/android/locations',function(req,res){

		var field_list = ['locations','email'];
		var locations = JSON.parse(req.body.locations);
		
		if(!has_required_field(req.body , field_list) || !reqired_format(locations)){
			console.log("SC1");	
			res.json({error:"Bad Request"});
			return;
		}

		var data = group_by_date(locations);

		for(var i = 0 , length = data.length ; i < length ; i++){
			(function(index){
				Location.update({username : req.body.email , date : data[index].date},{$pushAll : {locations : data[index].locations , shops : []}},{upsert:true},
					function(err){
						if(err){
							console.log(JSON.stringify(err));
							console.log("SC2");
							res.json({error : "Internal Error"});
							return;
						}else{
							console.log("SC4");
							console.log("updated" + index);
						}
						if(index === length-1){
							console.log("SC3");
							res.json({message : "updated"});
						}
					});
			})(i);
		}
	});

	function reqired_format(obj){
		for(var i = 0,length = obj.length;i<length;i++){
			if(typeof obj[i].datetime === 'undefined' || typeof obj[i].loc === 'undefined')
				return false;
			if(typeof obj[i].loc.latitude === 'undefined' || typeof obj[i].loc.longitude === 'undefined')
				return false;
		}
		return true;
	}

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

	app.get('/api/android/users/username',function(req,res){
		User.find({},{username:1},function(err,users){
			if(err){
				res.status(500);
				res.end("Internal Error");
			}else{
				res.end(JSON.stringify(users));
			}
		});
	});
};

function minimum_15_minute_diff_locations(locations){
	var newArray = [] , last_datetime = null;
	for(var i = 0,length = locations.length; i < length; i++){
		if(is_diff_is_15_minite_or_more(locations[i].datetime,last_datetime)){
			last_datetime = locations[i].datetime;
			locations[i].datetime = locations[i].datetime - (1000 * 60 * 60 * 4);
			newArray.push(locations[i]);
		}
	}
	return newArray;
}

function is_diff_is_15_minite_or_more(firsttime,secondtiem){
	if(secondtiem == null){
		return true;
	}

	var diff = (firsttime - secondtiem) / 1000 / 60;
	if(diff >= 15){
		return true;
	}
	return false;
}

function group_by_date(array){
	var group_by_date_array = [],obj={};
	for(var i = 0,length=array.length ; i<length ; i++){
		if(indexOf(group_by_date_array,format_date(array[i].datetime)) === -1){
			obj = {};
			obj.date = format_date(array[i].datetime);
			obj.locations = [];
			array[i].datetime = format_date(array[i].datetime);
			obj.locations.push(array[i]);
			group_by_date_array.push(obj);
		}else{
			var data = group_by_date_array[indexOf(group_by_date_array,format_date(array[i].datetime))]
			array[i].datetime = format_date(array[i].datetime);
			data.locations.push(array[i]);
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
  a= new Date(parseInt(a));
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