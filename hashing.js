const bcrypt = require('bcrypt');
let saltrounds =10;
let hash = function(password, callback){
    bcrypt.hash(password,saltrounds,callback);
};
let compare= function(password,hash,callback)
{
    //console.log(password);
    bcrypt.compare(password,hash,callback);
};
module.exports={
    hash,
    compare
};